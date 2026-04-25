// ABOUT: Tests for the SpecimenImageError inline banner

import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import SpecimenImageError from './SpecimenImageError'
import { WorkerError } from '@/types/worker'

describe('SpecimenImageError', () => {
  it('shows a re-login message and hides retry for 401', () => {
    const err = new WorkerError(401, 'Invalid token', 'corr-12345678', 'Worker error 401')
    render(<SpecimenImageError error={err} onRetry={vi.fn()} />)

    expect(screen.getByText(/credentials have lapsed/i)).toBeInTheDocument()
    expect(screen.getByText(/sign in again/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument()
  })

  it('shows a temporary-failure message and offers retry for 5xx', () => {
    const onRetry = vi.fn()
    const err = new WorkerError(503, 'Auth provider unavailable', 'corr-abc', 'Worker error 503')
    render(<SpecimenImageError error={err} onRetry={onRetry} />)

    expect(screen.getByText(/atelier is temporarily closed/i)).toBeInTheDocument()
    const retry = screen.getByRole('button', { name: /try again/i })
    fireEvent.click(retry)
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('shows a generic message for non-WorkerError exceptions', () => {
    const err = new Error('Something went wrong')
    render(<SpecimenImageError error={err} onRetry={vi.fn()} />)

    expect(screen.getByText(/could not commit this specimen/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })

  it('renders a short correlation reference when available', () => {
    const err = new WorkerError(503, 'Auth provider unavailable', 'corr-deadbeef-9999', 'Worker error')
    render(<SpecimenImageError error={err} onRetry={vi.fn()} />)
    expect(screen.getByText(/Ref corr-dea/)).toBeInTheDocument()
  })

  it('omits the correlation reference when null', () => {
    const err = new WorkerError(500, 'Unknown', null, 'Worker error 500')
    render(<SpecimenImageError error={err} onRetry={vi.fn()} />)
    expect(screen.queryByText(/^Ref /)).not.toBeInTheDocument()
  })
})
