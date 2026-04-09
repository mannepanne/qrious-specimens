// ABOUT: Tests for magic link authentication hook
// ABOUT: Verifies auth state transitions, error handling, URL cleanup, sendMagicLink, and signOut
import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAuth } from './useAuth'

vi.mock('@/lib/supabase', () => {
  const mockGetSession = vi.fn()
  const mockOnAuthStateChange = vi.fn()
  const mockSignInWithOtp = vi.fn()
  const mockSignOut = vi.fn()

  return {
    supabase: {
      auth: {
        getSession: mockGetSession,
        onAuthStateChange: mockOnAuthStateChange,
        signInWithOtp: mockSignInWithOtp,
        signOut: mockSignOut,
      },
    },
  }
})

import { supabase } from '@/lib/supabase'

const mockAuth = supabase.auth as unknown as {
  getSession: ReturnType<typeof vi.fn>
  onAuthStateChange: ReturnType<typeof vi.fn>
  signInWithOtp: ReturnType<typeof vi.fn>
  signOut: ReturnType<typeof vi.fn>
}

const fakeSession = {
  user: {
    id: 'user-123',
    email: 'naturalist@example.com',
    email_confirmed_at: '2026-01-01T00:00:00Z',
  },
  access_token: 'fake-token',
}

function setupNoSession() {
  mockAuth.getSession.mockResolvedValue({ data: { session: null }, error: null })
  mockAuth.onAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  })
}

function setupWithSession() {
  mockAuth.getSession.mockResolvedValue({ data: { session: fakeSession }, error: null })
  mockAuth.onAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  // Reset location for URL cleanup tests
  Object.defineProperty(window, 'location', {
    value: { hash: '', search: '', pathname: '/', origin: 'http://localhost:5173' },
    writable: true,
  })
  vi.spyOn(window.history, 'replaceState').mockImplementation(() => {})
})

describe('useAuth', () => {
  it('starts in loading state', () => {
    // Never resolves — holds the hook in loading state so we can assert it
    mockAuth.getSession.mockImplementation(() => new Promise(() => {}))
    mockAuth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    })
    const { result } = renderHook(() => useAuth())
    expect(result.current.authState.status).toBe('loading')
  })

  it('transitions to unauthenticated when no session exists', async () => {
    setupNoSession()
    const { result } = renderHook(() => useAuth())
    await waitFor(() => {
      expect(result.current.authState.status).toBe('unauthenticated')
    })
  })

  it('transitions to authenticated when session exists', async () => {
    setupWithSession()
    const { result } = renderHook(() => useAuth())
    await waitFor(() => {
      expect(result.current.authState.status).toBe('authenticated')
    })
    if (result.current.authState.status === 'authenticated') {
      expect(result.current.authState.session).toBe(fakeSession)
    }
  })

  it('transitions to error state when getSession returns an error', async () => {
    mockAuth.getSession.mockResolvedValue({
      data: { session: null },
      error: { message: 'JWT expired' },
    })
    mockAuth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    })

    const { result } = renderHook(() => useAuth())
    await waitFor(() => {
      expect(result.current.authState.status).toBe('error')
    })
    if (result.current.authState.status === 'error') {
      expect(result.current.authState.message).toBe('JWT expired')
    }
  })

  it('falls back to unauthenticated when getSession throws (network failure)', async () => {
    mockAuth.getSession.mockRejectedValue(new Error('network error'))
    mockAuth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    })

    const { result } = renderHook(() => useAuth())
    await waitFor(() => {
      expect(result.current.authState.status).toBe('unauthenticated')
    })
  })

  it('cleans URL fragment after magic link exchange', async () => {
    Object.defineProperty(window, 'location', {
      value: { hash: '#access_token=abc123', search: '', pathname: '/' },
      writable: true,
    })

    let capturedCallback: ((event: string, session: unknown) => void) | null = null
    mockAuth.getSession.mockResolvedValue({ data: { session: null }, error: null })
    mockAuth.onAuthStateChange.mockImplementation((cb) => {
      capturedCallback = cb
      return { data: { subscription: { unsubscribe: vi.fn() } } }
    })

    renderHook(() => useAuth())
    await waitFor(() => expect(capturedCallback).not.toBeNull())

    act(() => {
      capturedCallback!('SIGNED_IN', fakeSession)
    })

    expect(window.history.replaceState).toHaveBeenCalledWith(null, '', '/')
  })

  it('cleans PKCE code param after magic link exchange', async () => {
    Object.defineProperty(window, 'location', {
      value: { hash: '', search: '?code=xyz789', pathname: '/' },
      writable: true,
    })

    let capturedCallback: ((event: string, session: unknown) => void) | null = null
    mockAuth.getSession.mockResolvedValue({ data: { session: null }, error: null })
    mockAuth.onAuthStateChange.mockImplementation((cb) => {
      capturedCallback = cb
      return { data: { subscription: { unsubscribe: vi.fn() } } }
    })

    renderHook(() => useAuth())
    await waitFor(() => expect(capturedCallback).not.toBeNull())

    act(() => {
      capturedCallback!('SIGNED_IN', fakeSession)
    })

    expect(window.history.replaceState).toHaveBeenCalledWith(null, '', '/')
  })

  it('sendMagicLink returns null error on success', async () => {
    setupNoSession()
    mockAuth.signInWithOtp.mockResolvedValue({ error: null })

    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.authState.status).not.toBe('loading'))

    let response!: { error: string | null }
    await act(async () => {
      response = await result.current.sendMagicLink('naturalist@example.com')
    })

    expect(response.error).toBeNull()
    expect(mockAuth.signInWithOtp).toHaveBeenCalledWith({
      email: 'naturalist@example.com',
      options: { emailRedirectTo: expect.any(String) },
    })
  })

  it('sendMagicLink returns error message on failure', async () => {
    setupNoSession()
    mockAuth.signInWithOtp.mockResolvedValue({
      error: { message: 'Invalid email' },
    })

    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.authState.status).not.toBe('loading'))

    let response!: { error: string | null }
    await act(async () => {
      response = await result.current.sendMagicLink('bad')
    })

    expect(response.error).toBe('Invalid email')
  })

  it('signOut calls supabase.auth.signOut', async () => {
    setupWithSession()
    mockAuth.signOut.mockResolvedValue({})

    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.authState.status).toBe('authenticated'))

    await act(async () => {
      await result.current.signOut()
    })

    expect(mockAuth.signOut).toHaveBeenCalledOnce()
  })

  it('unsubscribes from auth state changes on unmount', async () => {
    const unsubscribe = vi.fn()
    mockAuth.getSession.mockResolvedValue({ data: { session: null }, error: null })
    mockAuth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe } },
    })

    const { unmount } = renderHook(() => useAuth())
    unmount()
    expect(unsubscribe).toHaveBeenCalledOnce()
  })
})
