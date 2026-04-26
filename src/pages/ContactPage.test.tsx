// ABOUT: Tests for the contact page
// ABOUT: Covers field validation, captcha gating, honeypot forwarding, and success/error states

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the submission hook so tests control the mutation outcome
vi.mock('@/hooks/useCommunity', () => ({
  useSubmitContact: vi.fn(),
}))

// Mock the captcha — expose a "Verify" button that fires onVerified, so tests
// don't have to deal with the random challenge or success-delay timers.
vi.mock('@/components/VictorianCaptcha/VictorianCaptcha', () => ({
  VictorianCaptcha: ({ onVerified }: { onVerified: () => void }) => (
    <button type="button" data-testid="mock-captcha-verify" onClick={onVerified}>
      verify-stub
    </button>
  ),
}))

// Mock sonner toast so we can assert error toasts without rendering them
vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

import { ContactPage } from './ContactPage'
import { useSubmitContact } from '@/hooks/useCommunity'
import { toast } from 'sonner'

const mockUseSubmitContact = vi.mocked(useSubmitContact)
const mockToastError = vi.mocked(toast.error)

interface MutationStub {
  mutateAsync: ReturnType<typeof vi.fn>
  isPending: boolean
}

function setupMutation(stub: Partial<MutationStub> = {}): MutationStub {
  const mutation: MutationStub = {
    mutateAsync: stub.mutateAsync ?? vi.fn().mockResolvedValue(undefined),
    isPending: stub.isPending ?? false,
  }
  // The hook returns a useMutation result; we only consume mutateAsync + isPending,
  // so the cast below is safe for the test surface area.
  mockUseSubmitContact.mockReturnValue(mutation as unknown as ReturnType<typeof useSubmitContact>)
  return mutation
}

function fillForm(opts: { name?: string; email: string; message: string }) {
  if (opts.name !== undefined) {
    fireEvent.change(screen.getByLabelText(/name \(optional\)/i), {
      target: { value: opts.name },
    })
  }
  fireEvent.change(screen.getByLabelText(/correspondence address/i), {
    target: { value: opts.email },
  })
  fireEvent.change(screen.getByLabelText(/^message/i), { target: { value: opts.message } })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ContactPage — rendering', () => {
  it('renders all form fields and the dispatch button', () => {
    setupMutation()
    render(<ContactPage />)

    expect(screen.getByLabelText(/name \(optional\)/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/correspondence address/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^message/i)).toBeInTheDocument()
    expect(screen.getByTestId('mock-captcha-verify')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /send correspondence/i })).toBeInTheDocument()
  })

  it('renders the correspondence-desk heading', () => {
    setupMutation()
    render(<ContactPage />)
    expect(screen.getByRole('heading', { name: /^contact$/i })).toBeInTheDocument()
    expect(screen.getByText(/correspondence desk/i)).toBeInTheDocument()
  })

  it('shows the live character counter for the message', () => {
    setupMutation()
    render(<ContactPage />)
    expect(screen.getByText('0/2000')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/^message/i), { target: { value: 'hello' } })
    expect(screen.getByText('5/2000')).toBeInTheDocument()
  })
})

describe('ContactPage — captcha gating', () => {
  it('blocks submission and toasts when captcha is not verified', async () => {
    const mutation = setupMutation()
    render(<ContactPage />)

    fillForm({ email: 'naturalist@example.com', message: 'Greetings.' })
    fireEvent.click(screen.getByRole('button', { name: /send correspondence/i }))

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        expect.stringMatching(/complete the naturalist verification/i),
      )
    })
    expect(mutation.mutateAsync).not.toHaveBeenCalled()
  })

  it('submits once captcha is verified', async () => {
    const mutation = setupMutation()
    render(<ContactPage />)

    fillForm({
      name: '  Mary  ',
      email: '  naturalist@example.com  ',
      message: '  A specimen of note.  ',
    })
    fireEvent.click(screen.getByTestId('mock-captcha-verify'))
    fireEvent.click(screen.getByRole('button', { name: /send correspondence/i }))

    await waitFor(() => {
      expect(mutation.mutateAsync).toHaveBeenCalledWith({
        sender_email: 'naturalist@example.com',
        sender_name: 'Mary',
        message: 'A specimen of note.',
        honeypot: undefined,
      })
    })
  })

  it('omits sender_name when the name field is left blank', async () => {
    const mutation = setupMutation()
    render(<ContactPage />)

    fillForm({ email: 'naturalist@example.com', message: 'hi' })
    fireEvent.click(screen.getByTestId('mock-captcha-verify'))
    fireEvent.click(screen.getByRole('button', { name: /send correspondence/i }))

    await waitFor(() => {
      expect(mutation.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ sender_name: undefined }),
      )
    })
  })
})

describe('ContactPage — honeypot', () => {
  it('forwards the honeypot value to the worker when it is filled', async () => {
    const mutation = setupMutation()
    const { container } = render(<ContactPage />)

    const honeypot = container.querySelector<HTMLInputElement>('#contact-website')
    expect(honeypot).not.toBeNull()
    // Field is type="url"; use a value that passes browser URL validation so the
    // form actually submits in jsdom. The worker only checks truthiness.
    fireEvent.change(honeypot!, { target: { value: 'http://bot.example' } })

    fillForm({ email: 'spam@example.com', message: 'spam payload' })
    fireEvent.click(screen.getByTestId('mock-captcha-verify'))
    fireEvent.click(screen.getByRole('button', { name: /send correspondence/i }))

    await waitFor(() => {
      expect(mutation.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ honeypot: 'http://bot.example' }),
      )
    })
  })

  it('keeps honeypot undefined when the field is untouched', async () => {
    const mutation = setupMutation()
    render(<ContactPage />)

    fillForm({ email: 'naturalist@example.com', message: 'hi' })
    fireEvent.click(screen.getByTestId('mock-captcha-verify'))
    fireEvent.click(screen.getByRole('button', { name: /send correspondence/i }))

    await waitFor(() => {
      expect(mutation.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ honeypot: undefined }),
      )
    })
  })
})

describe('ContactPage — submit states', () => {
  it('shows the success state after a successful submission', async () => {
    setupMutation()
    render(<ContactPage />)

    fillForm({ email: 'naturalist@example.com', message: 'hi' })
    fireEvent.click(screen.getByTestId('mock-captcha-verify'))
    fireEvent.click(screen.getByRole('button', { name: /send correspondence/i }))

    await waitFor(() => {
      expect(screen.getByText(/your correspondence has been received/i)).toBeInTheDocument()
    })
    expect(screen.queryByRole('button', { name: /send correspondence/i })).not.toBeInTheDocument()
  })

  it('shows an error toast and stays on the form when submission fails', async () => {
    const mutateAsync = vi.fn().mockRejectedValue(new Error('network down'))
    setupMutation({ mutateAsync })
    render(<ContactPage />)

    fillForm({ email: 'naturalist@example.com', message: 'hi' })
    fireEvent.click(screen.getByTestId('mock-captcha-verify'))
    fireEvent.click(screen.getByRole('button', { name: /send correspondence/i }))

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        expect.stringMatching(/could not be delivered/i),
      )
    })
    expect(screen.queryByText(/your correspondence has been received/i)).not.toBeInTheDocument()
  })

  it('shows the dispatching label and disables the button while pending', () => {
    setupMutation({ isPending: true })
    render(<ContactPage />)

    const button = screen.getByRole('button', { name: /dispatching/i })
    expect(button).toBeDisabled()
  })
})
