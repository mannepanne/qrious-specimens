// ABOUT: Tests for CommunityStats component
// ABOUT: Covers loading state and stat values rendering

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import CommunityStats from './CommunityStats'
import type { CommunityStats as CommunityStatsType } from '@/hooks/useCommunity'

describe('CommunityStats', () => {
  it('shows loading skeletons while loading', () => {
    const { container } = render(<CommunityStats stats={undefined} isLoading={true} />)
    const skeletons = container.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('shows loading skeletons when stats is undefined', () => {
    const { container } = render(<CommunityStats stats={undefined} isLoading={false} />)
    const skeletons = container.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('renders total explorers', () => {
    const stats: CommunityStatsType = { total_explorers: 12, total_specimens: 84, total_species: 31 }
    render(<CommunityStats stats={stats} isLoading={false} />)
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText(/explorers/i)).toBeInTheDocument()
  })

  it('renders total specimens', () => {
    const stats: CommunityStatsType = { total_explorers: 1, total_specimens: 42, total_species: 18 }
    render(<CommunityStats stats={stats} isLoading={false} />)
    expect(screen.getByText('42')).toBeInTheDocument()
    expect(screen.getByText(/specimens/i)).toBeInTheDocument()
  })

  it('renders total species', () => {
    const stats: CommunityStatsType = { total_explorers: 1, total_specimens: 1, total_species: 7 }
    render(<CommunityStats stats={stats} isLoading={false} />)
    expect(screen.getByText('7')).toBeInTheDocument()
    expect(screen.getByText(/species/i)).toBeInTheDocument()
  })

  it('renders zero values correctly', () => {
    const stats: CommunityStatsType = { total_explorers: 0, total_specimens: 0, total_species: 0 }
    render(<CommunityStats stats={stats} isLoading={false} />)
    const zeros = screen.getAllByText('0')
    expect(zeros.length).toBe(3)
  })
})
