// ABOUT: Tests for DatelineHeader — italic dateline copy with hairline rules

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DatelineHeader } from './DatelineHeader'

describe('DatelineHeader', () => {
  it('renders "Today" copy when date matches now', () => {
    const now = new Date('2026-05-10T12:00:00Z')
    render(<DatelineHeader date={new Date('2026-05-10T18:00:00Z')} now={now} />)
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent(/today, on the 10th of may/i)
  })

  it('renders "Yesterday" copy for the previous UTC day', () => {
    const now = new Date('2026-05-10T12:00:00Z')
    render(<DatelineHeader date={new Date('2026-05-09T18:00:00Z')} now={now} />)
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent(/yesterday, on the 9th of may/i)
  })

  it('renders "On" copy for older dates', () => {
    const now = new Date('2026-05-10T12:00:00Z')
    render(<DatelineHeader date={new Date('2026-05-01T18:00:00Z')} now={now} />)
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent(/on the 1st of may/i)
  })
})
