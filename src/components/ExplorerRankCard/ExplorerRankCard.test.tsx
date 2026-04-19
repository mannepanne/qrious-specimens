// ABOUT: Tests for ExplorerRankCard — rank display, progress bar, stats, Platinum special case
// ABOUT: Uses static rank data objects; no network calls

import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import ExplorerRankCard from './ExplorerRankCard'
import { RANK_DISPLAY } from '@/hooks/useBadges'
import type { ExplorerRank } from '@/hooks/useBadges'

function makeRank(overrides: Partial<ExplorerRank> = {}): ExplorerRank {
  return {
    rank: 'bronze',
    rank_icon: '♞',
    score: 12.5,
    next_rank: 'silver',
    next_threshold: 35,
    progress: 0.36,
    breakdown: { badges: 2, specimens: 5, species: 3, rare: 0, firsts: 0, days_active: 7 },
    ...overrides,
  }
}

describe('ExplorerRankCard', () => {
  it('renders the tier label for each tier', () => {
    const tiers: ExplorerRank['rank'][] = ['bronze', 'silver', 'gold', 'platinum']
    for (const rank of tiers) {
      const { unmount } = render(<ExplorerRankCard rank={makeRank({ rank })} />)
      expect(screen.getByText(new RegExp(`${RANK_DISPLAY[rank].label} RANK`))).toBeInTheDocument()
      unmount()
    }
  })

  it('renders the rank icon', () => {
    render(<ExplorerRankCard rank={makeRank({ rank_icon: '♞' })} />)
    expect(screen.getByText(/♞/)).toBeInTheDocument()
  })

  it('renders the score', () => {
    render(<ExplorerRankCard rank={makeRank({ score: 12.5 })} />)
    expect(screen.getByText('12.5')).toBeInTheDocument()
  })

  it('shows progress bar with correct width for non-platinum ranks', () => {
    const { container } = render(<ExplorerRankCard rank={makeRank({ progress: 0.36 })} />)
    const bar = container.querySelector('[style*="width: 36%"]')
    expect(bar).not.toBeNull()
  })

  it('shows MAX RANK text for platinum instead of progress bar', () => {
    render(<ExplorerRankCard rank={makeRank({ rank: 'platinum', progress: 1, next_threshold: 250 })} />)
    expect(screen.getByText(/max rank/i)).toBeInTheDocument()
    expect(screen.queryByText(/progress to/i)).not.toBeInTheDocument()
  })

  it('shows progress label with score / threshold for non-platinum', () => {
    render(<ExplorerRankCard rank={makeRank({ score: 12.5, next_threshold: 35, next_rank: 'silver' })} />)
    expect(screen.getByText(/12\.5 \/ 35/)).toBeInTheDocument()
  })

  it('renders all six stat labels', () => {
    render(<ExplorerRankCard rank={makeRank()} />)
    expect(screen.getByText('SPECIMENS')).toBeInTheDocument()
    expect(screen.getByText('SPECIES')).toBeInTheDocument()
    expect(screen.getByText('BADGES')).toBeInTheDocument()
    expect(screen.getByText('RARE FINDS')).toBeInTheDocument()
    expect(screen.getByText('FIRSTS')).toBeInTheDocument()
    expect(screen.getByText('DAYS ACTIVE')).toBeInTheDocument()
  })

  it('renders stat values', () => {
    render(<ExplorerRankCard rank={makeRank({ breakdown: { badges: 2, specimens: 5, species: 3, rare: 1, firsts: 0, days_active: 7 } })} />)
    expect(screen.getByText('5')).toBeInTheDocument() // specimens
    expect(screen.getByText('3')).toBeInTheDocument() // species
    expect(screen.getByText('2')).toBeInTheDocument() // badges
    expect(screen.getByText('1')).toBeInTheDocument() // rare
    expect(screen.getByText('7')).toBeInTheDocument() // days_active
  })

  it('renders nothing when rank is null', () => {
    const { container } = render(<ExplorerRankCard rank={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders loading skeleton when isLoading is true', () => {
    const { container } = render(<ExplorerRankCard rank={null} isLoading />)
    expect(container.querySelector('.animate-pulse')).not.toBeNull()
  })
})
