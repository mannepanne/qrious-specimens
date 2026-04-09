// ABOUT: Integration tests for the App component — auth gating and tab navigation
// ABOUT: Mocks Supabase auth; verifies loading → auth page → authenticated shell transitions
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
  mockAuth.getSession.mockResolvedValue({ data: { session: null } })
  mockAuth.onAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  })
}

function setupAuthenticated() {
  mockAuth.getSession.mockResolvedValue({ data: { session: fakeSession } })
  mockAuth.onAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('App', () => {
  it('shows loading state initially', () => {
    // getSession never resolves — holds loading state
    mockAuth.getSession.mockImplementation(() => new Promise(() => {}))
    mockAuth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    })

    render(<App />)
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('shows AuthPage when unauthenticated', async () => {
    setupUnauthenticated()
    render(<App />)

    await waitFor(() => {
      expect(screen.getByText(/qrious specimens/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/electronic mail/i)).toBeInTheDocument()
    })
  })

  it('shows tab navigation when authenticated', async () => {
    setupAuthenticated()
    render(<App />)

    await waitFor(() => {
      expect(screen.getByRole('navigation', { name: /main navigation/i })).toBeInTheDocument()
    })
    expect(screen.getByText('Scan')).toBeInTheDocument()
    expect(screen.getByText('Cabinet')).toBeInTheDocument()
  })

  it('defaults to Scan tab when authenticated', async () => {
    setupAuthenticated()
    render(<App />)

    await waitFor(() => screen.getByRole('navigation'))
    expect(screen.getByText(/qr scanner arrives/i)).toBeInTheDocument()
  })

  it('switches tabs when tab bar buttons are clicked', async () => {
    setupAuthenticated()
    render(<App />)

    await waitFor(() => screen.getByRole('navigation'))

    fireEvent.click(screen.getByText('Cabinet'))
    expect(screen.getByText(/cabinet of curiosities/i)).toBeInTheDocument()

    fireEvent.click(screen.getByText('Community'))
    expect(screen.getByText(/society of naturalists/i)).toBeInTheDocument()

    fireEvent.click(screen.getByText('Profile'))
    expect(screen.getByText(/your field journal/i)).toBeInTheDocument()
  })

  it('shows email address on Profile tab', async () => {
    setupAuthenticated()
    render(<App />)

    await waitFor(() => screen.getByRole('navigation'))
    fireEvent.click(screen.getByText('Profile'))

    expect(screen.getByText('naturalist@example.com')).toBeInTheDocument()
  })

  it('does not show email confirmation banner when email is confirmed', async () => {
    setupAuthenticated()
    render(<App />)

    await waitFor(() => screen.getByRole('navigation'))
    expect(screen.queryByText(/please confirm your address/i)).not.toBeInTheDocument()
  })

  it('shows email confirmation banner when email is unconfirmed', async () => {
    mockAuth.getSession.mockResolvedValue({
      data: {
        session: {
          ...fakeSession,
          user: { ...fakeSession.user, email_confirmed_at: null },
        },
      },
    })
    mockAuth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    })
    // Mock resend for the banner
    ;(supabase.auth as unknown as { resend?: ReturnType<typeof vi.fn> }).resend = vi.fn().mockResolvedValue({ error: null })

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText(/please confirm your address/i)).toBeInTheDocument()
    })
  })
})
