// ABOUT: Integration tests for App routing — auth gating, tab navigation, error state
// ABOUT: Catalogue and Gazette are public; Cabinet and Specimen require auth
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppRoutes } from './App'

vi.mock('@/lib/supabase', () => {
  const mockGetSession = vi.fn()
  const mockOnAuthStateChange = vi.fn()

  // Default from() chain — returns empty data for all table queries
  const makeFromChain = () => ({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  })

  return {
    supabase: {
      auth: {
        getSession: mockGetSession,
        onAuthStateChange: mockOnAuthStateChange,
        signInWithOtp: vi.fn().mockResolvedValue({ error: null }),
        signOut: vi.fn().mockResolvedValue({}),
      },
      // Gazette community RPCs return empty results by default
      rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
      from: vi.fn().mockImplementation(makeFromChain),
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

function renderApp({ initialPath = '/' } = {}) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[initialPath]}>
        <AppRoutes />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  // Clean up jsdom's history state between tests
  window.history.replaceState(null, '', '/')
})

describe('App', () => {
  it('shows loading state initially', () => {
    mockAuth.getSession.mockImplementation(() => new Promise(() => {}))
    mockAuth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    })

    renderApp()
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

    renderApp()
    await waitFor(() => {
      expect(screen.getByText(/could not connect/i)).toBeInTheDocument()
    })
    expect(screen.getByText('Storage corrupted')).toBeInTheDocument()
  })

  it('shows Catalogue at /catalogue (public) when unauthenticated — no auth wall', async () => {
    setupUnauthenticated()
    renderApp({ initialPath: '/catalogue' })

    await waitFor(() => {
      expect(screen.getByRole('navigation', { name: /main navigation/i })).toBeInTheDocument()
    })
    expect(screen.getByRole('heading', { name: /catalogue of known species/i })).toBeInTheDocument()
  })

  it('shows tab navigation with spec-defined three tabs', async () => {
    setupUnauthenticated()
    renderApp()

    await waitFor(() => screen.getByRole('navigation', { name: /main navigation/i }))
    expect(screen.getByText('CATALOGUE')).toBeInTheDocument()
    expect(screen.getByText('GAZETTE')).toBeInTheDocument()
    expect(screen.getByText('CABINET')).toBeInTheDocument()
  })

  it('root path redirects to /catalogue and shows Catalogue', async () => {
    setupUnauthenticated()
    renderApp({ initialPath: '/' })

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /catalogue of known species/i })).toBeInTheDocument()
    })
  })

  it('unauthenticated user can browse Gazette', async () => {
    setupUnauthenticated()
    renderApp({ initialPath: '/gazette' })

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /the explorer's gazette/i })).toBeInTheDocument()
    })
  })

  it('unauthenticated user visiting /cabinet is redirected to /enter', async () => {
    setupUnauthenticated()
    renderApp({ initialPath: '/cabinet' })

    // Auth guard is synchronous Navigate — wait for AuthPage to render
    await waitFor(
      () => { expect(screen.getByRole('heading', { name: /qrious specimens/i })).toBeInTheDocument() },
      { timeout: 3000 }
    )
  })

  it('unauthenticated user visiting /settings is redirected to /enter', async () => {
    setupUnauthenticated()
    renderApp({ initialPath: '/settings' })

    await waitFor(
      () => { expect(screen.getByRole('heading', { name: /qrious specimens/i })).toBeInTheDocument() },
      { timeout: 3000 }
    )
  })

  it('stub pages render at /about, /privacy, /contact', async () => {
    setupUnauthenticated()
    const { unmount } = renderApp({ initialPath: '/about' })
    await waitFor(() => expect(screen.getByRole('heading', { name: /qrious specimens/i })).toBeInTheDocument())
    unmount()

    renderApp({ initialPath: '/privacy' })
    await waitFor(() => expect(screen.getByRole('heading', { name: /privacy/i })).toBeInTheDocument())
    unmount()

    renderApp({ initialPath: '/contact' })
    await waitFor(() => expect(screen.getByRole('heading', { name: /contact/i })).toBeInTheDocument())
  })

  it('shows Cabinet content when authenticated', async () => {
    setupAuthenticated()
    renderApp({ initialPath: '/cabinet' })

    await waitFor(() => {
      expect(screen.getByText(/cabinet of curiosities/i)).toBeInTheDocument()
    })
  })

  it('shows scan CTA on Cabinet page when authenticated', async () => {
    setupAuthenticated()
    renderApp({ initialPath: '/cabinet' })

    await waitFor(() => {
      expect(screen.getByLabelText(/excavate new specimen/i)).toBeInTheDocument()
    })
  })

  it('tab navigation links are rendered as anchor elements', async () => {
    setupUnauthenticated()
    renderApp()

    await waitFor(() => screen.getByRole('navigation', { name: /main navigation/i }))

    // NavLink renders as <a>, not <button>
    expect(screen.getByText('CATALOGUE').closest('a')).toHaveAttribute('href', '/catalogue')
    expect(screen.getByText('GAZETTE').closest('a')).toHaveAttribute('href', '/gazette')
    expect(screen.getByText('CABINET').closest('a')).toHaveAttribute('href', '/cabinet')
  })

  it('tab bar is visible on main pages', async () => {
    setupAuthenticated()
    renderApp({ initialPath: '/' })

    await waitFor(() => screen.getByRole('navigation', { name: /main navigation/i }))
    expect(screen.getByRole('navigation', { name: /main navigation/i })).toBeInTheDocument()
  })

  it('tab bar is visible on the auth page /enter', async () => {
    setupUnauthenticated()
    renderApp({ initialPath: '/enter' })

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /qrious specimens/i })).toBeInTheDocument()
    })
    expect(screen.getByRole('navigation', { name: /main navigation/i })).toBeInTheDocument()
  })

  it("Gazette route renders The Explorer's Gazette heading", async () => {
    setupAuthenticated()
    renderApp({ initialPath: '/gazette' })

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /the explorer's gazette/i })).toBeInTheDocument()
    })
  })
})
