// ABOUT: Tests for FeaturedDispatch — eyebrow + species heading + pull-quote + signature, mirrored layout, click target

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FeaturedDispatch } from './FeaturedDispatch'
import type { FeedEntry } from '@/hooks/useCommunity'

function makeEntry(overrides: Partial<FeedEntry> = {}): FeedEntry {
  return {
    id: 'f1',
    event_type: 'first_discovery',
    species_name: 'Aurelia somnifera',
    badge_slug: null,
    badge_name: null,
    badge_icon: null,
    rarity: null,
    display_name: 'Lyra of Holloway',
    created_at: '2026-05-10T18:42:00Z',
    qr_hash: 'abc',
    species_image_url: 'https://example.com/specimen.jpg',
    field_notes: null,
    pull_quote: 'Its crest pulses in slow, deliberate rhythm — as though dreaming the world into being.',
    badge_tier: null,
    tier_change_body: null,
    ...overrides,
  }
}

describe('FeaturedDispatch', () => {
  it('renders the dispatch-of-the-day eyebrow, species name, pull-quote, and explorer signature', () => {
    render(<FeaturedDispatch entry={makeEntry()} mirrored={false} />)
    expect(screen.getByText(/dispatch of the day/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /aurelia somnifera/i })).toBeInTheDocument()
    expect(screen.getByText(/its crest pulses/i)).toBeInTheDocument()
    expect(screen.getByText(/lyra of holloway/i)).toBeInTheDocument()
  })

  it('renders the time-of-day phrase derived from created_at (UTC)', () => {
    render(<FeaturedDispatch entry={makeEntry({ created_at: '2026-05-10T07:30:00Z' })} mirrored={false} />)
    expect(screen.getByText(/at first light/i)).toBeInTheDocument()
  })

  it('mirrors the layout when `mirrored` is true', () => {
    const { container, rerender } = render(<FeaturedDispatch entry={makeEntry()} mirrored={false} />)
    const defaultArticle = container.querySelector('article')!
    expect(defaultArticle.className).not.toMatch(/sm:flex-row-reverse/)

    rerender(<FeaturedDispatch entry={makeEntry()} mirrored={true} />)
    const mirroredArticle = container.querySelector('article')!
    expect(mirroredArticle.className).toMatch(/sm:flex-row-reverse/)
  })

  it('falls back to a field-notes excerpt when pull_quote is null', () => {
    render(
      <FeaturedDispatch
        entry={makeEntry({
          pull_quote: null,
          field_notes: 'A creature of grave music. Its mandibles tuned, it seems, to some lyre we cannot hear.',
        })}
        mirrored={false}
      />,
    )
    expect(screen.getByText(/a creature of grave music\./i)).toBeInTheDocument()
  })

  it('omits the blockquote entirely when both pull_quote and field_notes are null', () => {
    const { container } = render(
      <FeaturedDispatch entry={makeEntry({ pull_quote: null, field_notes: null })} mirrored={false} />,
    )
    expect(container.querySelector('blockquote')).toBeNull()
  })

  it('is wrapped in a clickable button when qr_hash and onViewSpecies are provided', () => {
    const onViewSpecies = vi.fn()
    render(<FeaturedDispatch entry={makeEntry()} mirrored={false} onViewSpecies={onViewSpecies} />)
    fireEvent.click(screen.getByRole('button', { name: /view aurelia somnifera/i }))
    expect(onViewSpecies).toHaveBeenCalledWith('abc')
  })

  it('is not a button when qr_hash is null', () => {
    render(<FeaturedDispatch entry={makeEntry({ qr_hash: null })} mirrored={false} onViewSpecies={vi.fn()} />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('is not a button when onViewSpecies is omitted', () => {
    render(<FeaturedDispatch entry={makeEntry()} mirrored={false} />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  describe('first-sighting treatment', () => {
    it('shows the "New to science" eyebrow when event_type is first_discovery', () => {
      render(<FeaturedDispatch entry={makeEntry({ event_type: 'first_discovery' })} mirrored={false} />)
      expect(screen.getByText(/new to science/i)).toBeInTheDocument()
      expect(screen.queryByText(/^dispatch of the day$/i)).toBeNull()
    })

    it('shows the "First sighting in the world" caption when first_discovery', () => {
      render(<FeaturedDispatch entry={makeEntry({ event_type: 'first_discovery' })} mirrored={false} />)
      expect(screen.getByText(/first sighting in the world/i)).toBeInTheDocument()
    })

    it('credits the discoverer with "first documented by" when first_discovery', () => {
      render(<FeaturedDispatch entry={makeEntry({ event_type: 'first_discovery' })} mirrored={false} />)
      expect(screen.getByText(/first documented by/i)).toBeInTheDocument()
      expect(screen.queryByText(/^—\s*recorded by/i)).toBeNull()
    })

    it('falls back to plain "Dispatch of the day" and "recorded by" on ordinary discoveries', () => {
      render(<FeaturedDispatch entry={makeEntry({ event_type: 'discovery' })} mirrored={false} />)
      expect(screen.getByText(/^dispatch of the day$/i)).toBeInTheDocument()
      expect(screen.queryByText(/new to science/i)).toBeNull()
      expect(screen.queryByText(/first sighting in the world/i)).toBeNull()
      expect(screen.getByText(/recorded by/i)).toBeInTheDocument()
      expect(screen.queryByText(/first documented by/i)).toBeNull()
    })

    it('applies the amber accent frame when first_discovery', () => {
      const { container } = render(
        <FeaturedDispatch entry={makeEntry({ event_type: 'first_discovery' })} mirrored={false} />,
      )
      const article = container.querySelector('article')!
      expect(article.className).toMatch(/border-amber/)
    })

    it('uses the default border when not first_discovery', () => {
      const { container } = render(
        <FeaturedDispatch entry={makeEntry({ event_type: 'discovery' })} mirrored={false} />,
      )
      const article = container.querySelector('article')!
      expect(article.className).not.toMatch(/border-amber/)
    })
  })
})
