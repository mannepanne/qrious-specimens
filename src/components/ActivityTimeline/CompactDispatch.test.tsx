// ABOUT: Tests for CompactDispatch — thumb, italic species name, pull-quote excerpt, signature, first-sighting eyebrow, click target

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CompactDispatch } from './CompactDispatch'
import type { FeedEntry } from '@/hooks/useCommunity'

function makeEntry(overrides: Partial<FeedEntry> = {}): FeedEntry {
  return {
    id: 'c1',
    event_type: 'discovery',
    species_name: 'Concha occidentalis',
    badge_slug: null,
    badge_name: null,
    badge_icon: null,
    rarity: null,
    display_name: 'Bea Coverdale',
    created_at: '2026-05-10T08:48:00Z',
    qr_hash: 'xyz',
    species_image_url: 'https://example.com/specimen.jpg',
    field_notes: null,
    pull_quote: 'A pleasing iridescence to the carapace, much in the manner of a midsummer beetle.',
    badge_tier: null,
    ...overrides,
  }
}

describe('CompactDispatch', () => {
  it('renders species name, pull-quote excerpt, and explorer signature', () => {
    render(<CompactDispatch entry={makeEntry()} />)
    expect(screen.getByText(/concha occidentalis/i)).toBeInTheDocument()
    expect(screen.getByText(/a pleasing iridescence/i)).toBeInTheDocument()
    expect(screen.getByText(/bea coverdale/i)).toBeInTheDocument()
  })

  it('renders the "First sighting" eyebrow on first_discovery events', () => {
    render(<CompactDispatch entry={makeEntry({ event_type: 'first_discovery' })} />)
    expect(screen.getByText(/first sighting/i)).toBeInTheDocument()
  })

  it('omits the "First sighting" eyebrow on ordinary discoveries', () => {
    render(<CompactDispatch entry={makeEntry({ event_type: 'discovery' })} />)
    expect(screen.queryByText(/first sighting/i)).toBeNull()
  })

  it('falls back to a field-notes excerpt when pull_quote is null', () => {
    render(
      <CompactDispatch
        entry={makeEntry({
          pull_quote: null,
          field_notes: 'A short opening line. The rest follows after.',
        })}
      />,
    )
    expect(screen.getByText(/a short opening line\./i)).toBeInTheDocument()
  })

  it('is a button when qr_hash and onViewSpecies are provided', () => {
    const onViewSpecies = vi.fn()
    render(<CompactDispatch entry={makeEntry()} onViewSpecies={onViewSpecies} />)
    fireEvent.click(screen.getByRole('button', { name: /view concha occidentalis/i }))
    expect(onViewSpecies).toHaveBeenCalledWith('xyz')
  })

  it('is not a button when qr_hash is null', () => {
    render(<CompactDispatch entry={makeEntry({ qr_hash: null })} onViewSpecies={vi.fn()} />)
    expect(screen.queryByRole('button')).toBeNull()
  })
})
