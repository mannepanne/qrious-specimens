// ABOUT: Tests for the VictorianCaptcha naturalist verification component
// ABOUT: Covers question rendering, correct/wrong answer flows, and the verified callback

import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { VictorianCaptcha } from './VictorianCaptcha'

// Force the first challenge: "which of these is a genuine order of insects?" (answer: Coleoptera).
// Math.random() = 0 → CHALLENGES[0].
beforeEach(() => {
  vi.spyOn(Math, 'random').mockReturnValue(0)
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('VictorianCaptcha', () => {
  it('renders the challenge question and four options', () => {
    render(<VictorianCaptcha onVerified={vi.fn()} />)
    expect(screen.getByText(/genuine order of insects/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Coleoptera' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Fragmentosa' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Spiralidae' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Nocturvia' })).toBeInTheDocument()
  })

  it('shows the verification header', () => {
    render(<VictorianCaptcha onVerified={vi.fn()} />)
    expect(screen.getByText(/naturalist verification/i)).toBeInTheDocument()
  })

  it('calls onVerified after the success delay when the correct option is picked', () => {
    const onVerified = vi.fn()
    render(<VictorianCaptcha onVerified={onVerified} />)

    fireEvent.click(screen.getByRole('button', { name: 'Coleoptera' }))
    expect(screen.getByText(/verified — welcome, fellow naturalist/i)).toBeInTheDocument()
    expect(onVerified).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(600)
    })
    expect(onVerified).toHaveBeenCalledOnce()
  })

  it('shows the error message and clears selection when a wrong option is picked', () => {
    const onVerified = vi.fn()
    render(<VictorianCaptcha onVerified={onVerified} />)

    fireEvent.click(screen.getByRole('button', { name: 'Fragmentosa' }))
    expect(screen.getByText(/incorrect — please try again/i)).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(800)
    })
    expect(screen.queryByText(/incorrect/i)).not.toBeInTheDocument()
    expect(onVerified).not.toHaveBeenCalled()
  })

  it('allows a second attempt after a wrong answer resets', () => {
    const onVerified = vi.fn()
    render(<VictorianCaptcha onVerified={onVerified} />)

    fireEvent.click(screen.getByRole('button', { name: 'Spiralidae' }))
    act(() => {
      vi.advanceTimersByTime(800)
    })

    fireEvent.click(screen.getByRole('button', { name: 'Coleoptera' }))
    act(() => {
      vi.advanceTimersByTime(600)
    })
    expect(onVerified).toHaveBeenCalledOnce()
  })

  it('disables further clicks once the correct answer is given', () => {
    const onVerified = vi.fn()
    render(<VictorianCaptcha onVerified={onVerified} />)

    fireEvent.click(screen.getByRole('button', { name: 'Coleoptera' }))
    act(() => {
      vi.advanceTimersByTime(600)
    })

    const wrongButton = screen.getByRole('button', { name: 'Nocturvia' })
    expect(wrongButton).toBeDisabled()
    fireEvent.click(wrongButton)
    expect(onVerified).toHaveBeenCalledOnce()
  })

  it('does not call onVerified before the success delay elapses', () => {
    const onVerified = vi.fn()
    render(<VictorianCaptcha onVerified={onVerified} />)

    fireEvent.click(screen.getByRole('button', { name: 'Coleoptera' }))
    act(() => {
      vi.advanceTimersByTime(599)
    })
    expect(onVerified).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(onVerified).toHaveBeenCalledOnce()
  })
})
