// ABOUT: Tests for BadgeCollection — earned/locked states, tier labels, sort order, loading skeleton
// ABOUT: Pure rendering tests; no network calls

import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import BadgeCollection from './BadgeCollection'
import type { BadgeDefinition, ExplorerBadge } from '@/hooks/useBadges'

const definitions: BadgeDefinition[] = [
  { slug: 'first-specimen',  name: 'First Find',      description: 'Collect your first specimen', icon: '🔬', tier: 'bronze', sort_order: 1 },
  { slug: 'five-specimens',  name: 'Handful of Finds', description: 'Collect 5 specimens',       icon: '🧪', tier: 'bronze', sort_order: 2 },
  { slug: 'rare-find',       name: 'Coastal Naturalist', description: 'Find a rare specimen',   icon: '🦀', tier: 'silver', sort_order: 3 },
  { slug: 'first-discoverer', name: 'Pioneer',         description: 'First discoverer',          icon: '⚑',  tier: 'gold',   sort_order: 4 },
]

const earned: ExplorerBadge[] = [
  { badge_slug: 'first-specimen',  earned_at: '2026-01-01T00:00:00Z' },
  { badge_slug: 'first-discoverer', earned_at: '2026-01-02T00:00:00Z' },
]

describe('BadgeCollection', () => {
  it('renders all badge definitions', () => {
    render(<BadgeCollection definitions={definitions} earnedBadges={[]} />)
    expect(screen.getByText('First Find')).toBeInTheDocument()
    expect(screen.getByText('Handful of Finds')).toBeInTheDocument()
    expect(screen.getByText('Coastal Naturalist')).toBeInTheDocument()
    expect(screen.getByText('Pioneer')).toBeInTheDocument()
  })

  it('shows earned badge icons for earned badges', () => {
    render(<BadgeCollection definitions={definitions} earnedBadges={earned} />)
    expect(screen.getByText('🔬')).toBeInTheDocument()
    expect(screen.getByText('⚑')).toBeInTheDocument()
  })

  it('shows lock icon for unearned badges', () => {
    render(<BadgeCollection definitions={definitions} earnedBadges={[]} />)
    // All badges locked — four lock icons
    expect(screen.getAllByText('🔒')).toHaveLength(4)
  })

  it('shows tier label for earned badges', () => {
    render(<BadgeCollection definitions={definitions} earnedBadges={earned} />)
    expect(screen.getByText('BRONZE')).toBeInTheDocument() // first-specimen is bronze
    expect(screen.getByText('GOLD')).toBeInTheDocument()   // first-discoverer is gold
  })

  it('shows LOCKED for unearned badges', () => {
    render(<BadgeCollection definitions={definitions} earnedBadges={[]} />)
    expect(screen.getAllByText('LOCKED')).toHaveLength(4)
  })

  it('shows SILVER tier label for silver badges', () => {
    render(<BadgeCollection definitions={definitions} earnedBadges={[{ badge_slug: 'rare-find', earned_at: '' }]} />)
    expect(screen.getByText('SILVER')).toBeInTheDocument()
  })

  it('respects sort order of definitions', () => {
    render(<BadgeCollection definitions={definitions} earnedBadges={[]} />)
    const names = screen.getAllByText(/Find|Finds|Naturalist|Pioneer/).map(el => el.textContent)
    expect(names[0]).toBe('First Find')
    expect(names[1]).toBe('Handful of Finds')
  })

  it('renders loading skeleton when isLoading is true', () => {
    const { container } = render(<BadgeCollection definitions={[]} earnedBadges={[]} isLoading />)
    expect(container.querySelector('.animate-pulse')).not.toBeNull()
  })

  it('renders empty grid when definitions list is empty', () => {
    const { container } = render(<BadgeCollection definitions={[]} earnedBadges={[]} />)
    expect(container.querySelector('[class*="grid"]')?.children).toHaveLength(0)
  })
})
