// ABOUT: Tests for magic link authentication hook
// ABOUT: Verifies auth state transitions, sendMagicLink, and signOut behaviour
import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAuth } from './useAuth'

// Mock the supabase module so tests don't hit real network
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
  mockAuth.getSession.mockResolvedValue({ data: { session: null } })
  mockAuth.onAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  })
}

function setupWithSession() {
  mockAuth.getSession.mockResolvedValue({ data: { session: fakeSession } })
  mockAuth.onAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useAuth', () => {
  it('starts in loading state', () => {
    setupNoSession()
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
    mockAuth.getSession.mockResolvedValue({ data: { session: null } })
    mockAuth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe } },
    })

    const { unmount } = renderHook(() => useAuth())
    unmount()
    expect(unsubscribe).toHaveBeenCalledOnce()
  })
})
