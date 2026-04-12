// ABOUT: Tests for GazetteJoinPrompt component
// ABOUT: Verifies name field, sparkle generator, validation, public/private toggle, and submission

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import GazetteJoinPrompt from './GazetteJoinPrompt'

describe('GazetteJoinPrompt', () => {
  it('renders the form with name input and submit button', () => {
    render(<GazetteJoinPrompt onSubmit={vi.fn()} isSubmitting={false} />)
    expect(screen.getByLabelText(/display name/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /join the gazette/i })).toBeInTheDocument()
  })

  it('sparkle button populates the name field', () => {
    render(<GazetteJoinPrompt onSubmit={vi.fn()} isSubmitting={false} />)
    const sparkle = screen.getByRole('button', { name: /generate a random/i })
    fireEvent.click(sparkle)
    const input = screen.getByLabelText(/display name/i) as HTMLInputElement
    expect(input.value.length).toBeGreaterThan(3)
  })

  it('shows validation error for names under 2 characters', () => {
    render(<GazetteJoinPrompt onSubmit={vi.fn()} isSubmitting={false} />)
    fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: 'A' } })
    fireEvent.click(screen.getByRole('button', { name: /join the gazette/i }))
    expect(screen.getByRole('alert')).toHaveTextContent(/at least 2 characters/i)
  })

  it('shows validation error for names over 30 characters', () => {
    render(<GazetteJoinPrompt onSubmit={vi.fn()} isSubmitting={false} />)
    fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: 'A'.repeat(31) } })
    fireEvent.click(screen.getByRole('button', { name: /join the gazette/i }))
    expect(screen.getByRole('alert')).toHaveTextContent(/30 characters/i)
  })

  it('calls onSubmit with trimmed name and public flag when form is valid', () => {
    const onSubmit = vi.fn()
    render(<GazetteJoinPrompt onSubmit={onSubmit} isSubmitting={false} />)
    fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: '  Dr. Darwin  ' } })
    fireEvent.click(screen.getByRole('button', { name: /join the gazette/i }))
    expect(onSubmit).toHaveBeenCalledWith('Dr. Darwin', true)
  })

  it('passes false for isPublic when checkbox is unchecked', () => {
    const onSubmit = vi.fn()
    render(<GazetteJoinPrompt onSubmit={onSubmit} isSubmitting={false} />)
    fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: 'Prof. Huxley' } })
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: /join the gazette/i }))
    expect(onSubmit).toHaveBeenCalledWith('Prof. Huxley', false)
  })

  it('disables submit button while submitting', () => {
    render(<GazetteJoinPrompt onSubmit={vi.fn()} isSubmitting={true} />)
    fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: 'Dr. Test' } })
    expect(screen.getByRole('button', { name: /joining/i })).toBeDisabled()
  })

  it('disables submit button when name is empty', () => {
    render(<GazetteJoinPrompt onSubmit={vi.fn()} isSubmitting={false} />)
    expect(screen.getByRole('button', { name: /join the gazette/i })).toBeDisabled()
  })

  it('does not call onSubmit for empty input on submit', () => {
    const onSubmit = vi.fn()
    render(<GazetteJoinPrompt onSubmit={onSubmit} isSubmitting={false} />)
    fireEvent.click(screen.getByRole('button', { name: /join the gazette/i }))
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
