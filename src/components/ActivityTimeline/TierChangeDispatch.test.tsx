// ABOUT: Tests for TierChangeDispatch — Society notice rendering, tier accent, body fallback, click target

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TierChangeDispatch } from './TierChangeDispatch'
import type { FeedEntry } from '@/hooks/useCommunity'

function makeEntry(overrides: Partial<FeedEntry> = {}): FeedEntry {
  return {
    id: 't1',
    event_type: 'tier_change',
    species_name: 'Concha occidentalis',
    badge_slug: null,
    badge_name: null,
    badge_icon: null,
    rarity: 'notable',
    display_name: 'system',
    created_at: '2026-05-10T08:48:00Z',
    qr_hash: 'xyz',
    species_image_url: null,
    field_notes: null,
    pull_quote: null,
    badge_tier: null,
    tier_change_body:
      'Concha occidentalis has settled into the Notable tier this morning, the eighth specimen retrieved from the eastern shores.',
    ...overrides,
  }
}

describe('TierChangeDispatch', () => {
  it('renders the worker-generated body when tier_change_body is set', () => {
    render(<TierChangeDispatch entry={makeEntry()} />)
    expect(screen.getByText(/eighth specimen retrieved/i)).toBeInTheDocument()
  })

  it('renders the Society-notice eyebrow with the new tier label', () => {
    render(<TierChangeDispatch entry={makeEntry({ rarity: 'extraordinary' })} />)
    expect(screen.getByText(/society notice · extraordinary/i)).toBeInTheDocument()
  })

  it('pulls the binomial out as an italic underlined span', () => {
    const { container } = render(<TierChangeDispatch entry={makeEntry()} />)
    const binomial = container.querySelector('span.italic.underline')
    expect(binomial).not.toBeNull()
    expect(binomial?.textContent).toBe('Concha occidentalis')
  })

  it('falls back to a hand-written body when tier_change_body is null (extraordinary)', () => {
    render(
      <TierChangeDispatch
        entry={makeEntry({
          rarity: 'extraordinary',
          tier_change_body: null,
          species_name: 'Larva nocturnalis',
        })}
      />,
    )
    expect(screen.getByText(/elevated to the extraordinary tier/i)).toBeInTheDocument()
    expect(screen.getByText(/larva nocturnalis/i)).toBeInTheDocument()
  })

  it('falls back with "settled into" wording for notable', () => {
    render(
      <TierChangeDispatch
        entry={makeEntry({ rarity: 'notable', tier_change_body: null })}
      />,
    )
    expect(screen.getByText(/settled into the notable tier/i)).toBeInTheDocument()
  })

  it('falls back with "lapsed into" wording for common', () => {
    render(
      <TierChangeDispatch
        entry={makeEntry({ rarity: 'common', tier_change_body: null })}
      />,
    )
    expect(screen.getByText(/lapsed into the common tier/i)).toBeInTheDocument()
  })

  it('applies a tier-specific accent class on the fleuron glyph', () => {
    const cases: Array<[FeedEntry['rarity'], string]> = [
      ['extraordinary', 'text-violet-700/80'],
      ['notable',       'text-sky-700/80'],
      ['common',        'text-stone-600/80'],
    ]
    for (const [rarity, expectedAccent] of cases) {
      const { container, unmount } = render(<TierChangeDispatch entry={makeEntry({ rarity })} />)
      const glyph = container.querySelector('span[aria-hidden="true"]')
      expect(glyph?.className).toContain(expectedAccent)
      unmount()
    }
  })

  it('treats an unrecognised rarity value as notable', () => {
    render(<TierChangeDispatch entry={makeEntry({ rarity: null, tier_change_body: null })} />)
    expect(screen.getByText(/settled into the notable tier/i)).toBeInTheDocument()
  })

  it('is a button when qr_hash and onViewSpecies are provided', () => {
    const onViewSpecies = vi.fn()
    render(<TierChangeDispatch entry={makeEntry()} onViewSpecies={onViewSpecies} />)
    fireEvent.click(screen.getByRole('button', { name: /view concha occidentalis/i }))
    expect(onViewSpecies).toHaveBeenCalledWith('xyz')
  })

  it('is not a button when qr_hash is null', () => {
    render(<TierChangeDispatch entry={makeEntry({ qr_hash: null })} onViewSpecies={vi.fn()} />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('renders the body as-is when the binomial is missing from it (no underlined span)', () => {
    const { container } = render(
      <TierChangeDispatch
        entry={makeEntry({
          tier_change_body: 'A change has been noted by the Society.',
          species_name: 'Concha occidentalis',
        })}
      />,
    )
    expect(container.querySelector('span.italic.underline')).toBeNull()
    expect(screen.getByText(/a change has been noted/i)).toBeInTheDocument()
  })
})
