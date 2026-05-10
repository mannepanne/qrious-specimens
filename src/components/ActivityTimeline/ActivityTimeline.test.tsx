// ABOUT: Tests for ActivityTimeline composition (UTC-day grouping, dispatch-of-the-day pick, alternation, click pass-through)
// ABOUT: Per-component visual contracts live in FeaturedDispatch.test, CompactDispatch.test, BadgeDispatch.test

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import ActivityTimeline from './ActivityTimeline'
import type { FeedEntry } from '@/hooks/useCommunity'

function makeEntry(overrides: Partial<FeedEntry> = {}): FeedEntry {
  return {
    id: 'e1',
    event_type: 'discovery',
    species_name: 'Venoma rex',
    badge_slug: null,
    badge_name: null,
    badge_icon: null,
    rarity: 'common',
    display_name: 'Dr. A. Darwin',
    created_at: '2026-05-10T12:00:00Z',
    qr_hash: 'abc123',
    species_image_url: 'https://example.com/img.png',
    field_notes: null,
    pull_quote: 'A radial geometry of quiet certainty.',
    badge_tier: null,
    ...overrides,
  }
}

describe('ActivityTimeline', () => {
  it('renders loading skeletons while loading', () => {
    render(<ActivityTimeline entries={[]} isLoading={true} />)
    expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
  })

  it('renders the empty-state message when no entries', () => {
    render(<ActivityTimeline entries={[]} isLoading={false} />)
    expect(screen.getByText(/no activity recorded yet/i)).toBeInTheDocument()
  })

  it('emits the section landmark with the activity-timeline label', () => {
    render(<ActivityTimeline entries={[makeEntry()]} isLoading={false} />)
    expect(screen.getByRole('region', { name: /activity timeline/i })).toBeInTheDocument()
  })

  it('promotes the first_discovery to dispatch-of-the-day even when an ordinary discovery is more recent', () => {
    const entries = [
      makeEntry({ id: 'd', event_type: 'discovery',       species_name: 'Recent discovery',    created_at: '2026-05-10T18:00:00Z' }),
      makeEntry({ id: 'f', event_type: 'first_discovery', species_name: 'Earlier first sight', created_at: '2026-05-10T08:00:00Z' }),
    ]
    render(<ActivityTimeline entries={entries} isLoading={false} />)
    expect(screen.getByText(/dispatch of the day/i)).toBeInTheDocument()
    // Featured dispatch renders an <h2>; compact ones do not.
    const featured = screen.getByRole('heading', { level: 2 })
    expect(featured).toHaveTextContent('Earlier first sight')
  })

  it('falls back to the most recent ordinary discovery when no first_discovery exists that day', () => {
    const entries = [
      makeEntry({ id: 'd1', event_type: 'discovery', species_name: 'Late', created_at: '2026-05-10T20:00:00Z' }),
      makeEntry({ id: 'd2', event_type: 'discovery', species_name: 'Early', created_at: '2026-05-10T06:00:00Z' }),
    ]
    render(<ActivityTimeline entries={entries} isLoading={false} />)
    const featured = screen.getByRole('heading', { level: 2 })
    expect(featured).toHaveTextContent('Late')
  })

  it('groups entries by UTC day with one DatelineHeader per day', () => {
    const entries = [
      makeEntry({ id: 'a', species_name: 'A', created_at: '2026-05-10T12:00:00Z' }),
      makeEntry({ id: 'b', species_name: 'B', created_at: '2026-05-09T12:00:00Z' }),
    ]
    render(<ActivityTimeline entries={entries} isLoading={false} />)
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(2)
  })

  it('alternates featured-dispatch image side across the feed', () => {
    const entries = [
      makeEntry({ id: 'a', species_name: 'Day-one feature', created_at: '2026-05-10T12:00:00Z' }),
      makeEntry({ id: 'b', species_name: 'Day-two feature', created_at: '2026-05-09T12:00:00Z' }),
    ]
    const { container } = render(<ActivityTimeline entries={entries} isLoading={false} />)
    const articles = container.querySelectorAll('article')
    expect(articles).toHaveLength(2)
    // First featured: not mirrored. Second featured: mirrored (sm:flex-row-reverse).
    expect(articles[0].className).not.toMatch(/sm:flex-row-reverse/)
    expect(articles[1].className).toMatch(/sm:flex-row-reverse/)
  })

  it('compact dispatches do not become featured even if first in their group', () => {
    // Only badges in the group → no featured. Two compacts in another group with
    // the badge alongside should still render as compact.
    const entries = [
      makeEntry({ id: 'd', event_type: 'discovery', created_at: '2026-05-10T12:00:00Z' }),
      makeEntry({ id: 'b', event_type: 'badge_earned', badge_name: 'Pioneer', badge_icon: '⭐', species_name: null, created_at: '2026-05-10T11:00:00Z' }),
    ]
    render(<ActivityTimeline entries={entries} isLoading={false} />)
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(1) // exactly one featured per day
  })

  it('passes onViewSpecies through to clickable dispatches', () => {
    const onViewSpecies = vi.fn()
    render(<ActivityTimeline entries={[makeEntry()]} isLoading={false} onViewSpecies={onViewSpecies} />)
    fireEvent.click(screen.getByRole('button', { name: /view venoma rex/i }))
    expect(onViewSpecies).toHaveBeenCalledWith('abc123')
  })

  it('dispatches without qr_hash are not rendered as buttons', () => {
    render(<ActivityTimeline entries={[makeEntry({ qr_hash: null })]} isLoading={false} onViewSpecies={vi.fn()} />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('badge dispatches are never clickable, even with qr_hash', () => {
    render(
      <ActivityTimeline
        entries={[makeEntry({ event_type: 'badge_earned', badge_name: 'First Steps', badge_icon: '🌱', species_name: null })]}
        isLoading={false}
        onViewSpecies={vi.fn()}
      />,
    )
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('falls back to a field-notes excerpt when pull_quote is null', () => {
    const entry = makeEntry({
      pull_quote: null,
      field_notes: 'A peculiar specimen, retrieved from the marshes. Notes continue here.',
    })
    render(<ActivityTimeline entries={[entry]} isLoading={false} />)
    const featured = screen.getByRole('heading', { level: 2 })
    const article = featured.closest('article')!
    expect(within(article).getByText(/peculiar specimen, retrieved from the marshes/i)).toBeInTheDocument()
  })
})
