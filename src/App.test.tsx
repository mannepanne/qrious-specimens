// ABOUT: Integration tests for App — auth gating, tab navigation, error state, public browse
// ABOUT: Catalogue and Gazette are public; Cabinet requires auth
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { App } from './App'

vi.mock('@/lib/supabase', () => {
  const mockGetSession = vi.fn()
  const mockOnAuthStateChange = vi.fn()

  return {
    supabase: {
      auth: {
        getSession: mockGetSession,
        onAuthStateChange: mockOnAuthStateChange,
        signInWithOtp: vi.fn().mockResolvedValue({ error: null }),
        signOut: vi.fn().mockResolvedValue({}),
      },
    },
  }
})

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
  Toaster: () => null,
}))

import { supabase } from '@/lib/supabase'

const mockAuth = supabase.auth as unknown as {
  getSession: ReturnType<typeof vi.fn>
  onAuthStateChange: ReturnType<typeof vi.fn>
}

const fakeSession = {
  user: {
    id: 'user-123',
    email: 'naturalist@example.com',
    email_confirmed_at: '2026-01-01T00:00:00Z',
  },
  access_token: 'fake-token',
}

function setupUnauthenticated() {
  mockAuth.getSession.mockResolvedValue({ data: { session: null }, error: null })
  mockAuth.onAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  })
}

function setupAuthenticated() {
  mockAuth.getSession.mockResolvedValue({ data: { session: fakeSession }, error: null })
  mockAuth.onAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  Object.defineProperty(window, 'location', {
    value: { hash: '', search: '', pathname: '/', origin: 'http://localhost:5173' },
    writable: true,
  })
  vi.spyOn(window.history, 'replaceState').mockImplementation(() => {})
})

describe('App', () => {
  it('shows loading state initially', () => {
    mockAuth.getSession.mockImplementation(() => new Promise(() => {}))
    mockAuth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    })

    render(<App />)
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('shows error state when session load fails', async () => {
    mockAuth.getSession.mockResolvedValue({
      data: { session: null },
      error: { message: 'Storage corrupted' },
    })
    mockAuth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    })

    render(<App />)
    await waitFor(() => {
      expect(screen.getByText(/could not connect/i)).toBeInTheDocument()
    })
    expect(screen.getByText('Storage corrupted')).toBeInTheDocument()
  })

  it('shows Catalogue tab (public) when unauthenticated — no auth wall', async () => {
    setupUnauthenticated()
    render(<App />)

    await waitFor(() => {
      expect(screen.getByRole('navigation', { name: /main navigation/i })).toBeInTheDocument()
    })
    expect(screen.getByText(/species catalogue/i)).toBeInTheDocument()
  })

  it('shows tab navigation with spec-defined three tabs', async () => {
    setupUnauthenticated()
    render(<App />)

    await waitFor(() => screen.getByRole('navigation', { name: /main navigation/i }))
    expect(screen.getByText('Catalogue')).toBeInTheDocument()
    expect(screen.getByText('Gazette')).toBeInTheDocument()
    expect(screen.getByText('Cabinet')).toBeInTheDocument()
  })

  it('defaults to Catalogue tab', async () => {
    setupUnauthenticated()
    render(<App />)

    await waitFor(() => screen.getByRole('navigation', { name: /main navigation/i }))
    expect(screen.getByText(/species catalogue/i)).toBeInTheDocument()
  })

  it('unauthenticated user can browse Gazette', async () => {
    setupUnauthenticated()
    render(<App />)

    await waitFor(() => screen.getByRole('navigation', { name: /main navigation/i }))
    fireEvent.click(screen.getByText('Gazette'))
    expect(screen.getByText(/the gazette/i)).toBeInTheDocument()
  })

  it('unauthenticated user clicking Cabinet sees AuthPage', async () => {
    setupUnauthenticated()
    render(<App />)

    await waitFor(() => screen.getByRole('navigation', { name: /main navigation/i }))
    fireEvent.click(screen.getByText('Cabinet'))

    expect(screen.getByLabelText(/electronic mail/i)).toBeInTheDocument()
  })

  it('shows Cabinet content when authenticated', async () => {
    setupAuthenticated()
    render(<App />)

    await waitFor(() => screen.getByRole('navigation', { name: /main navigation/i }))
    fireEvent.click(screen.getByText('Cabinet'))
    expect(screen.getByText(/cabinet of curiosities/i)).toBeInTheDocument()
  })

  it('shows email on Cabinet page when authenticated', async () => {
    setupAuthenticated()
    render(<App />)

    await waitFor(() => screen.getByRole('navigation', { name: /main navigation/i }))
    fireEvent.click(screen.getByText('Cabinet'))
    expect(screen.getByText('naturalist@example.com')).toBeInTheDocument()
  })

  it('tab switching works across all three tabs when authenticated', async () => {
    setupAuthenticated()
    render(<App />)

    await waitFor(() => screen.getByRole('navigation', { name: /main navigation/i }))

    fireEvent.click(screen.getByText('Gazette'))
    expect(screen.getByText(/the gazette/i)).toBeInTheDocument()

    fireEvent.click(screen.getByText('Cabinet'))
    expect(screen.getByText(/cabinet of curiosities/i)).toBeInTheDocument()

    fireEvent.click(screen.getByText('Catalogue'))
    expect(screen.getByText(/species catalogue/i)).toBeInTheDocument()
  })

  // NOTE: the overlayNeedsAuth branch (App.tsx:65) cannot be triggered via Phase 2 UI —
  // there are no overlay-opening actions yet. Phase 3 adds the scanner CTA that sets
  // nav.overlay = 'scanner'. Add a test here when that trigger lands:
  //   it('unauthenticated user opening scanner overlay sees AuthPage', ...)

  it('tab bar is visible when no overlay is open', async () => {
    setupAuthenticated()
    render(<App />)

    await waitFor(() => screen.getByRole('navigation', { name: /main navigation/i }))
    expect(screen.getByRole('navigation', { name: /main navigation/i })).toBeInTheDocument()
  })
})
