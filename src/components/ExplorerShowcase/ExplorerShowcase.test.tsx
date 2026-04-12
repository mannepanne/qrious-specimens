// ABOUT: Tests for ExplorerShowcase component
// ABOUT: Covers loading state, empty state, profile cards, initials, badge display

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ExplorerShowcase from './ExplorerShowcase'
import type { ShowcaseExplorer } from '@/hooks/useCommunity'

function makeExplorer(overrides: Partial<ShowcaseExplorer> = {}): ShowcaseExplorer {
  return {
    user_id: 'u1',
    display_name: 'Dr. A. Darwin',
    specimen_count: 7,
    rare_count: 1,
    first_discovery_count: 0,
    badges: [],
    joined_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('ExplorerShowcase', () => {
  it('shows loading skeletons while loading', () => {
    const { container } = render(<ExplorerShowcase explorers={[]} isLoading={true} />)
    const skeletons = container.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('shows empty state when no explorers', () => {
    render(<ExplorerShowcase explorers={[]} isLoading={false} />)
    expect(screen.getByText(/no explorers have joined/i)).toBeInTheDocument()
  })

  it('renders explorer display name', () => {
    render(<ExplorerShowcase explorers={[makeExplorer()]} isLoading={false} />)
    expect(screen.getByText('Dr. A. Darwin')).toBeInTheDocument()
  })

  it('renders specimen count', () => {
    render(<ExplorerShowcase explorers={[makeExplorer({ specimen_count: 3 })]} isLoading={false} />)
    expect(screen.getByText('3 specimens')).toBeInTheDocument()
  })

  it('uses singular "specimen" for count of 1', () => {
    render(<ExplorerShowcase explorers={[makeExplorer({ specimen_count: 1 })]} isLoading={false} />)
    expect(screen.getByText('1 specimen')).toBeInTheDocument()
  })

  it('renders initials correctly for dotted title (Dr. → AD)', () => {
    const { container } = render(
      <ExplorerShowcase explorers={[makeExplorer({ display_name: 'Dr. A. Darwin' })]} isLoading={false} />,
    )
    const avatar = container.querySelector('[aria-hidden="true"]')
    expect(avatar?.textContent).toBe('AD')
  })

  it('renders initials correctly for non-dotted title (Captain → RH)', () => {
    const { container } = render(
      <ExplorerShowcase explorers={[makeExplorer({ display_name: 'Captain R. Huxley' })]} isLoading={false} />,
    )
    const avatar = container.querySelector('[aria-hidden="true"]')
    expect(avatar?.textContent).toBe('RH')
  })

  it('renders initials correctly for Easter egg name (A. Anning → AA)', () => {
    const { container } = render(
      <ExplorerShowcase explorers={[makeExplorer({ display_name: 'A. Anning' })]} isLoading={false} />,
    )
    const avatar = container.querySelector('[aria-hidden="true"]')
    expect(avatar?.textContent).toBe('AA')
  })

  it('renders badge icons when present', () => {
    const badges = [
      { slug: 'first_steps', name: 'First Steps', icon: '🌱', tier: 'bronze' },
      { slug: 'rare_find', name: 'Rare Find', icon: '💎', tier: 'bronze' },
    ]
    render(<ExplorerShowcase explorers={[makeExplorer({ badges })]} isLoading={false} />)
    expect(screen.getByLabelText('First Steps')).toBeInTheDocument()
    expect(screen.getByLabelText('Rare Find')).toBeInTheDocument()
  })

  it('shows overflow count when more than 5 badges', () => {
    const badges = Array.from({ length: 7 }, (_, i) => ({
      slug: `badge-${i}`, name: `Badge ${i}`, icon: '🌱', tier: 'bronze',
    }))
    render(<ExplorerShowcase explorers={[makeExplorer({ badges })]} isLoading={false} />)
    expect(screen.getByText('+2')).toBeInTheDocument()
  })

  it('renders multiple explorer cards', () => {
    const explorers = [
      makeExplorer({ user_id: 'u1', display_name: 'Dr. A. Darwin' }),
      makeExplorer({ user_id: 'u2', display_name: 'Prof. B. Huxley' }),
    ]
    render(<ExplorerShowcase explorers={explorers} isLoading={false} />)
    expect(screen.getByText('Dr. A. Darwin')).toBeInTheDocument()
    expect(screen.getByText('Prof. B. Huxley')).toBeInTheDocument()
  })
})
