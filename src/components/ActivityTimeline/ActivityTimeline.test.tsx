// ABOUT: Tests for ActivityTimeline component
// ABOUT: Verifies event rendering, colour dots, click navigation, loading and empty states

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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
    created_at: new Date(Date.now() - 60_000).toISOString(), // 1 minute ago
    qr_hash: 'abc123',
    species_image_url: null,
    ...overrides,
  }
}

describe('ActivityTimeline', () => {
  it('shows loading skeletons while loading', () => {
    render(<ActivityTimeline entries={[]} isLoading={true} />)
    // Skeletons render as div elements with animate-pulse
    const skeletons = document.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('shows empty state message when no entries', () => {
    render(<ActivityTimeline entries={[]} isLoading={false} />)
    expect(screen.getByText(/no activity recorded yet/i)).toBeInTheDocument()
  })

  it('renders discovery entry text', () => {
    render(<ActivityTimeline entries={[makeEntry()]} isLoading={false} />)
    expect(screen.getByText('Dr. A. Darwin')).toBeInTheDocument()
    expect(screen.getByText(/venoma rex/i)).toBeInTheDocument()
  })

  it('renders rare_discovery entry text', () => {
    render(<ActivityTimeline entries={[makeEntry({ event_type: 'rare_discovery' })]} isLoading={false} />)
    expect(screen.getByText(/discovered a rare/i)).toBeInTheDocument()
  })

  it('renders first_discovery entry text', () => {
    render(<ActivityTimeline entries={[makeEntry({ event_type: 'first_discovery' })]} isLoading={false} />)
    expect(screen.getByText(/first to discover/i)).toBeInTheDocument()
  })

  it('renders badge_earned entry text', () => {
    render(
      <ActivityTimeline
        entries={[makeEntry({ event_type: 'badge_earned', badge_name: 'First Steps', badge_icon: '🌱', species_name: null })]}
        isLoading={false}
      />,
    )
    expect(screen.getByText(/earned/i)).toBeInTheDocument()
    expect(screen.getByText(/First Steps/)).toBeInTheDocument()
  })

  it('shows time-ago for entries', () => {
    render(<ActivityTimeline entries={[makeEntry()]} isLoading={false} />)
    expect(screen.getByText(/ago/i)).toBeInTheDocument()
  })

  it('clicking discovery entry calls onViewSpecies with qr_hash', () => {
    const onViewSpecies = vi.fn()
    render(<ActivityTimeline entries={[makeEntry()]} isLoading={false} onViewSpecies={onViewSpecies} />)
    fireEvent.click(screen.getByRole('button', { name: /view venoma rex/i }))
    expect(onViewSpecies).toHaveBeenCalledWith('abc123')
  })

  it('discovery entries without qr_hash are not clickable buttons', () => {
    render(<ActivityTimeline entries={[makeEntry({ qr_hash: null })]} isLoading={false} onViewSpecies={vi.fn()} />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('badge entries are not clickable buttons', () => {
    render(
      <ActivityTimeline
        entries={[makeEntry({ event_type: 'badge_earned', qr_hash: null, badge_icon: '🌱', badge_name: 'First Steps' })]}
        isLoading={false}
        onViewSpecies={vi.fn()}
      />,
    )
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('renders species thumbnail when species_image_url provided', () => {
    const entry = makeEntry({ species_image_url: 'https://example.com/img.png' })
    const { container } = render(<ActivityTimeline entries={[entry]} isLoading={false} />)
    const img = container.querySelector('img')
    expect(img).not.toBeNull()
    expect(img).toHaveAttribute('src', 'https://example.com/img.png')
  })

  it('renders list with correct aria label', () => {
    render(<ActivityTimeline entries={[makeEntry()]} isLoading={false} />)
    expect(screen.getByRole('list', { name: /activity timeline/i })).toBeInTheDocument()
  })
})
