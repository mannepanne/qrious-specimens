// ABOUT: Tests for the magic link authentication page
// ABOUT: Covers idle state, form submission, sent confirmation, and error handling
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AuthPage } from './AuthPage'

// Mock useAuth so tests control sendMagicLink without a real Supabase connection
vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(),
}))

import { useAuth } from '@/hooks/useAuth'
const mockUseAuth = vi.mocked(useAuth)

function setupAuth(sendMagicLinkResult: { error: string | null }) {
  mockUseAuth.mockReturnValue({
    authState: { status: 'unauthenticated' },
    sendMagicLink: vi.fn().mockResolvedValue(sendMagicLinkResult),
    signOut: vi.fn(),
  })
}

// Expose the mock sendMagicLink for assertions
function getSendMagicLink() {
  return mockUseAuth.mock.results[0]?.value?.sendMagicLink as ReturnType<typeof vi.fn>
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('AuthPage', () => {
  it('renders email input and submit button', () => {
    setupAuth({ error: null })
    render(<AuthPage />)
    expect(screen.getByLabelText(/correspondence address/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /enter the field/i })).toBeInTheDocument()
  })

  it('submit button is disabled when email is empty', () => {
    setupAuth({ error: null })
    render(<AuthPage />)
    expect(screen.getByRole('button', { name: /enter the field/i })).toBeDisabled()
  })

  it('calls sendMagicLink with trimmed email on submit', async () => {
    setupAuth({ error: null })
    render(<AuthPage />)

    fireEvent.change(screen.getByLabelText(/correspondence address/i), {
      target: { value: '  naturalist@example.com  ' },
    })
    fireEvent.click(screen.getByRole('button', { name: /enter the field/i }))

    await waitFor(() => {
      expect(getSendMagicLink()).toHaveBeenCalledWith('naturalist@example.com')
    })
  })

  it('shows confirmation state after successful send', async () => {
    setupAuth({ error: null })
    render(<AuthPage />)

    fireEvent.change(screen.getByLabelText(/correspondence address/i), {
      target: { value: 'naturalist@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /enter the field/i }))

    await waitFor(() => {
      expect(screen.getByText(/check your correspondence/i)).toBeInTheDocument()
    })
    expect(screen.getByText(/naturalist@example.com/)).toBeInTheDocument()
  })

  it('shows error message when sendMagicLink fails', async () => {
    setupAuth({ error: 'Rate limit exceeded' })
    render(<AuthPage />)

    fireEvent.change(screen.getByLabelText(/correspondence address/i), {
      target: { value: 'naturalist@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /enter the field/i }))

    await waitFor(() => {
      expect(screen.getByText(/rate limit exceeded/i)).toBeInTheDocument()
    })
  })

  it('returns to idle when "use a different address" is clicked', async () => {
    setupAuth({ error: null })
    render(<AuthPage />)

    fireEvent.change(screen.getByLabelText(/correspondence address/i), {
      target: { value: 'naturalist@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /enter the field/i }))

    await waitFor(() => screen.getByText(/check your correspondence/i))

    fireEvent.click(screen.getByText(/use a different address/i))

    expect(screen.getByLabelText(/correspondence address/i)).toBeInTheDocument()
  })

  it('shows dispatching state while sending', async () => {
    mockUseAuth.mockReturnValue({
      authState: { status: 'unauthenticated' },
      sendMagicLink: vi.fn().mockImplementation(() => new Promise(() => {})),
      signOut: vi.fn(),
    })
    render(<AuthPage />)

    fireEvent.change(screen.getByLabelText(/correspondence address/i), {
      target: { value: 'naturalist@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /enter the field/i }))

    expect(await screen.findByRole('button', { name: /dispatching/i })).toBeDisabled()
  })
})
