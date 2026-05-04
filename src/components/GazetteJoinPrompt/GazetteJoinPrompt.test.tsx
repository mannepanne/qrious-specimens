// ABOUT: Tests for GazetteJoinPrompt component
// ABOUT: Verifies auto-generated name, regenerate action, public/private toggle, and submission

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import GazetteJoinPrompt from './GazetteJoinPrompt'

describe('GazetteJoinPrompt', () => {
  it('renders with an auto-generated display name and submit button', () => {
    render(<GazetteJoinPrompt onSubmit={vi.fn()} isSubmitting={false} />)
    const name = screen.getByTestId('explorer-name')
    expect(name.textContent ?? '').toMatch(/.{3,}/)
    expect(screen.getByRole('button', { name: /join the gazette/i })).toBeInTheDocument()
  })

  it('does not expose a free-text display-name input — privacy promise enforcement', () => {
    render(<GazetteJoinPrompt onSubmit={vi.fn()} isSubmitting={false} />)
    // No textbox for the display name. The only input is the public/private checkbox.
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('regenerate button replaces the displayed name with a fresh one', () => {
    render(<GazetteJoinPrompt onSubmit={vi.fn()} isSubmitting={false} />)
    const initial = screen.getByTestId('explorer-name').textContent
    // Click regenerate up to 5 times — collisions are possible (small name space)
    // but extremely unlikely to repeat 5× in a row.
    let changed = false
    for (let i = 0; i < 5; i++) {
      fireEvent.click(screen.getByRole('button', { name: /generate a new explorer name/i }))
      if (screen.getByTestId('explorer-name').textContent !== initial) {
        changed = true
        break
      }
    }
    expect(changed).toBe(true)
  })

  it('calls onSubmit with the generated name and isPublic=true by default', () => {
    const onSubmit = vi.fn()
    render(<GazetteJoinPrompt onSubmit={onSubmit} isSubmitting={false} />)
    const name = screen.getByTestId('explorer-name').textContent ?? ''
    fireEvent.click(screen.getByRole('button', { name: /join the gazette/i }))
    expect(onSubmit).toHaveBeenCalledWith(name, true)
  })

  it('passes false for isPublic when checkbox is unchecked', () => {
    const onSubmit = vi.fn()
    render(<GazetteJoinPrompt onSubmit={onSubmit} isSubmitting={false} />)
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: /join the gazette/i }))
    expect(onSubmit).toHaveBeenCalledWith(expect.any(String), false)
  })

  it('disables submit button while submitting', () => {
    render(<GazetteJoinPrompt onSubmit={vi.fn()} isSubmitting={true} />)
    expect(screen.getByRole('button', { name: /joining/i })).toBeDisabled()
  })
})
