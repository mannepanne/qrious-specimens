// ABOUT: Tests for the magic link authentication page
// ABOUT: Covers idle state, form submission, sent confirmation, and error handling
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { AuthPage } from './AuthPage'

function makeSendMagicLink(result: { error: string | null }) {
  return vi.fn().mockResolvedValue(result)
}

describe('AuthPage', () => {
  it('renders email input and submit button', () => {
    render(<AuthPage sendMagicLink={makeSendMagicLink({ error: null })} />)
    expect(screen.getByLabelText(/electronic mail/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /send magic link/i })).toBeInTheDocument()
  })

  it('submit button is disabled when email is empty', () => {
    render(<AuthPage sendMagicLink={makeSendMagicLink({ error: null })} />)
    expect(screen.getByRole('button', { name: /send magic link/i })).toBeDisabled()
  })

  it('calls sendMagicLink with trimmed email on submit', async () => {
    const sendMagicLink = makeSendMagicLink({ error: null })
    render(<AuthPage sendMagicLink={sendMagicLink} />)

    fireEvent.change(screen.getByLabelText(/electronic mail/i), {
      target: { value: '  naturalist@example.com  ' },
    })
    fireEvent.click(screen.getByRole('button', { name: /send magic link/i }))

    await waitFor(() => {
      expect(sendMagicLink).toHaveBeenCalledWith('naturalist@example.com')
    })
  })

  it('shows confirmation state after successful send', async () => {
    render(<AuthPage sendMagicLink={makeSendMagicLink({ error: null })} />)

    fireEvent.change(screen.getByLabelText(/electronic mail/i), {
      target: { value: 'naturalist@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /send magic link/i }))

    await waitFor(() => {
      expect(screen.getByText(/check your correspondence/i)).toBeInTheDocument()
    })
    expect(screen.getByText(/naturalist@example.com/)).toBeInTheDocument()
  })

  it('shows error message when sendMagicLink fails', async () => {
    render(
      <AuthPage sendMagicLink={makeSendMagicLink({ error: 'Rate limit exceeded' })} />
    )

    fireEvent.change(screen.getByLabelText(/electronic mail/i), {
      target: { value: 'naturalist@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /send magic link/i }))

    await waitFor(() => {
      expect(screen.getByText(/rate limit exceeded/i)).toBeInTheDocument()
    })
  })

  it('returns to idle when "use a different address" is clicked', async () => {
    render(<AuthPage sendMagicLink={makeSendMagicLink({ error: null })} />)

    fireEvent.change(screen.getByLabelText(/electronic mail/i), {
      target: { value: 'naturalist@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /send magic link/i }))

    await waitFor(() => screen.getByText(/check your correspondence/i))

    fireEvent.click(screen.getByText(/use a different address/i))

    expect(screen.getByLabelText(/electronic mail/i)).toBeInTheDocument()
  })

  it('shows dispatching state while sending', async () => {
    // Never resolves — holds the sending state
    const sendMagicLink = vi.fn().mockImplementation(() => new Promise(() => {}))
    render(<AuthPage sendMagicLink={sendMagicLink} />)

    fireEvent.change(screen.getByLabelText(/electronic mail/i), {
      target: { value: 'naturalist@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /send magic link/i }))

    expect(await screen.findByRole('button', { name: /dispatching/i })).toBeDisabled()
  })
})
