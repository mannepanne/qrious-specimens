// ABOUT: Tests for the email confirmation banner component
// ABOUT: Verifies dismiss behaviour, resend success, and resend error handling
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EmailConfirmBanner } from './EmailConfirmBanner'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      resend: vi.fn(),
    },
  },
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

const mockResend = supabase.auth.resend as ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
})

describe('EmailConfirmBanner', () => {
  it('renders the confirmation prompt', () => {
    render(<EmailConfirmBanner email="naturalist@example.com" />)
    expect(screen.getByText(/please confirm your address/i)).toBeInTheDocument()
  })

  it('disappears after clicking dismiss', () => {
    render(<EmailConfirmBanner email="naturalist@example.com" />)
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }))
    expect(screen.queryByText(/please confirm your address/i)).not.toBeInTheDocument()
  })

  it('calls supabase resend with the correct email on click', async () => {
    mockResend.mockResolvedValue({ error: null })
    render(<EmailConfirmBanner email="naturalist@example.com" />)

    fireEvent.click(screen.getByText(/resend link/i))

    await waitFor(() => {
      expect(mockResend).toHaveBeenCalledWith({
        type: 'signup',
        email: 'naturalist@example.com',
      })
    })
  })

  it('shows success toast after successful resend', async () => {
    mockResend.mockResolvedValue({ error: null })
    render(<EmailConfirmBanner email="naturalist@example.com" />)

    fireEvent.click(screen.getByText(/resend link/i))

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        expect.stringMatching(/confirmation link sent/i)
      )
    })
  })

  it('shows error toast when resend fails', async () => {
    mockResend.mockResolvedValue({ error: { message: 'Something went wrong' } })
    render(<EmailConfirmBanner email="naturalist@example.com" />)

    fireEvent.click(screen.getByText(/resend link/i))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringMatching(/could not resend/i)
      )
    })
  })
})
