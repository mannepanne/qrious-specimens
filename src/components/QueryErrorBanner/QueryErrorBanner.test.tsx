// ABOUT: Tests for the inline QueryErrorBanner component

import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import QueryErrorBanner from './QueryErrorBanner'

describe('QueryErrorBanner', () => {
  it('renders the default Victorian-style copy when no overrides are given', () => {
    render(<QueryErrorBanner />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(/dispatch could not be retrieved/i)).toBeInTheDocument()
    expect(screen.getByText(/momentarily out of reach/i)).toBeInTheDocument()
  })

  it('uses custom headline and body when supplied', () => {
    render(<QueryErrorBanner headline="The cabinet is shuttered." body="Try again presently." />)
    expect(screen.getByText('The cabinet is shuttered.')).toBeInTheDocument()
    expect(screen.getByText('Try again presently.')).toBeInTheDocument()
  })

  it('omits the retry button when onRetry is not provided', () => {
    render(<QueryErrorBanner />)
    expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument()
  })

  it('shows a retry button that calls onRetry when clicked', () => {
    const onRetry = vi.fn()
    render(<QueryErrorBanner onRetry={onRetry} />)
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    expect(onRetry).toHaveBeenCalledOnce()
  })
})
