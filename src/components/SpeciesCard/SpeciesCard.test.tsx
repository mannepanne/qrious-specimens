// ABOUT: Tests for SpeciesCard catalogue grid card
// ABOUT: Covers AI image vs sketch fallback, rarity badge, and click handler

import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import SpeciesCard from './SpeciesCard'
import type { CatalogueEntry } from '@/hooks/useCatalogue'

// CreatureRenderer is SVG-heavy; stub it out so tests don't depend on canvas
vi.mock('@/components/CreatureRenderer/CreatureRenderer', () => ({
  default: ({ dna }: { dna: { genus: string } }) => (
    <div data-testid="creature-sketch" data-genus={dna.genus} />
  ),
}))

function makeEntry(overrides: Partial<CatalogueEntry> = {}): CatalogueEntry {
  return {
    qr_hash: 'abc123def456abcd',
    genus: 'Testus',
    species: 'mockii',
    order: 'Testidae',
    family: 'Mockaceae',
    habitat: 'coastal',
    temperament: 'curious',
    estimated_size: '5–10 cm',
    symmetry: 'bilateral',
    body_shape: 'ovoid',
    limb_style: 'jointed',
    pattern_type: 'dots',
    image_url_512: null,
    image_url_256: null,
    field_notes: 'A curious specimen.',
    discovery_count: 3,
    first_discovered_at: '2026-01-01T00:00:00Z',
    first_discoverer_id: null,
    total_count: 1,
    ...overrides,
  }
}

describe('SpeciesCard', () => {
  it('renders binomial species name', () => {
    render(<SpeciesCard entry={makeEntry()} />)
    expect(screen.getByText('Testus mockii')).toBeInTheDocument()
  })

  it('shows AI thumbnail when image_url_256 is available', () => {
    render(<SpeciesCard entry={makeEntry({ image_url_256: 'https://example.com/256.png' })} />)
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('src', 'https://example.com/256.png')
    expect(img).toHaveAttribute('alt', 'Testus mockii')
    expect(screen.queryByTestId('creature-sketch')).not.toBeInTheDocument()
  })

  it('shows sketch fallback when no AI image is available', () => {
    render(<SpeciesCard entry={makeEntry({ image_url_256: null })} />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByTestId('creature-sketch')).toBeInTheDocument()
  })

  it('displays RARE badge for discovery_count ≤ 3', () => {
    render(<SpeciesCard entry={makeEntry({ discovery_count: 2 })} />)
    expect(screen.getByText('RARE')).toBeInTheDocument()
  })

  it('displays UNCOMMON badge for discovery_count 4–15', () => {
    render(<SpeciesCard entry={makeEntry({ discovery_count: 8 })} />)
    expect(screen.getByText('UNCOMMON')).toBeInTheDocument()
  })

  it('displays COMMON badge for discovery_count ≥ 16', () => {
    render(<SpeciesCard entry={makeEntry({ discovery_count: 20 })} />)
    expect(screen.getByText('COMMON')).toBeInTheDocument()
  })

  it('renders family name', () => {
    render(<SpeciesCard entry={makeEntry()} />)
    expect(screen.getByText('Mockaceae')).toBeInTheDocument()
  })

  it('calls onClick when card is clicked', () => {
    const onClick = vi.fn()
    render(<SpeciesCard entry={makeEntry()} onClick={onClick} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('renders without onClick prop without throwing', () => {
    expect(() => render(<SpeciesCard entry={makeEntry()} />)).not.toThrow()
  })
})
