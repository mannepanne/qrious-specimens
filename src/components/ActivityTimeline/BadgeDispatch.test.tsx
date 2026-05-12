// ABOUT: Tests for BadgeDispatch — emoji icon, tier-tinted ring, smallcaps prose

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BadgeDispatch } from './BadgeDispatch'
import type { FeedEntry } from '@/hooks/useCommunity'

function makeEntry(overrides: Partial<FeedEntry> = {}): FeedEntry {
  return {
    id: 'b1',
    event_type: 'badge_earned',
    species_name: null,
    badge_slug: 'pioneer',
    badge_name: 'Pioneer',
    badge_icon: '⭐',
    rarity: null,
    display_name: 'Aldous Finch',
    created_at: '2026-05-10T08:50:00Z',
    qr_hash: null,
    species_image_url: null,
    field_notes: null,
    pull_quote: null,
    badge_tier: 'silver',
    tier_change_body: null,
    ...overrides,
  }
}

describe('BadgeDispatch', () => {
  it('renders the explorer name, badge name, and icon', () => {
    render(<BadgeDispatch entry={makeEntry()} />)
    expect(screen.getByText(/aldous finch/i)).toBeInTheDocument()
    expect(screen.getByText(/pioneer/i)).toBeInTheDocument()
    expect(screen.getByText('⭐')).toBeInTheDocument()
  })

  it('renders the tier label when badge_tier is set', () => {
    render(<BadgeDispatch entry={makeEntry({ badge_tier: 'gold' })} />)
    expect(screen.getByText(/gold tier/i)).toBeInTheDocument()
  })

  it('omits the tier label when badge_tier is null', () => {
    render(<BadgeDispatch entry={makeEntry({ badge_tier: null })} />)
    expect(screen.queryByText(/tier$/i)).toBeNull()
  })

  it('applies tier-tinted ring classes per tier', () => {
    const tiers = [
      ['bronze', 'ring-amber-700/30'],
      ['silver', 'ring-slate-400/40'],
      ['gold',   'ring-amber-500/40'],
    ] as const

    for (const [tier, expectedRing] of tiers) {
      const { container, unmount } = render(<BadgeDispatch entry={makeEntry({ badge_tier: tier })} />)
      const ringEl = container.querySelector('span[aria-hidden="true"]')
      expect(ringEl?.className).toContain(expectedRing)
      unmount()
    }
  })
})
