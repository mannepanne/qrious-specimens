// ABOUT: Tests for SpeciesDetail species detail view
// ABOUT: Covers illustration, taxonomy, field notes auth-gating, discovery metadata, and navigation

import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import SpeciesDetail from './SpeciesDetail'
import type { CatalogueEntry } from '@/hooks/useCatalogue'

vi.mock('@/components/CreatureRenderer/CreatureRenderer', () => ({
  default: () => <div data-testid="creature-sketch" />,
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
    field_notes: 'A small but remarkable specimen.',
    discovery_count: 5,
    first_discovered_at: '2026-01-15T12:00:00Z',
    first_discoverer_id: null,
    total_count: 1,
    ...overrides,
  }
}

describe('SpeciesDetail', () => {
  it('renders binomial name as heading', () => {
    render(
      <SpeciesDetail
        entry={makeEntry()}
        isAuthenticated={true}
        onPrev={null}
        onNext={null}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByRole('heading', { name: /Testus mockii/i })).toBeInTheDocument()
  })

  it('shows AI illustration when image_url_512 is available', () => {
    render(
      <SpeciesDetail
        entry={makeEntry({ image_url_512: 'https://example.com/512.png' })}
        isAuthenticated={true}
        onPrev={null}
        onNext={null}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.com/512.png')
    expect(screen.queryByTestId('creature-sketch')).not.toBeInTheDocument()
  })

  it('shows sketch fallback when no AI image is available', () => {
    render(
      <SpeciesDetail
        entry={makeEntry({ image_url_512: null })}
        isAuthenticated={true}
        onPrev={null}
        onNext={null}
        onClose={vi.fn()}
      />,
    )
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByTestId('creature-sketch')).toBeInTheDocument()
  })

  it('renders taxonomy metadata', () => {
    render(
      <SpeciesDetail
        entry={makeEntry()}
        isAuthenticated={true}
        onPrev={null}
        onNext={null}
        onClose={vi.fn()}
      />,
    )
    // Family appears in both the heading area and the taxonomy table — use getAllByText
    expect(screen.getAllByText('Mockaceae').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Testidae').length).toBeGreaterThan(0)
    expect(screen.getByText('coastal')).toBeInTheDocument()
    expect(screen.getByText('curious')).toBeInTheDocument()
    expect(screen.getByText('5–10 cm')).toBeInTheDocument()
  })

  it('renders morphological traits', () => {
    render(
      <SpeciesDetail
        entry={makeEntry()}
        isAuthenticated={true}
        onPrev={null}
        onNext={null}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByText('bilateral')).toBeInTheDocument()
    expect(screen.getByText('ovoid')).toBeInTheDocument()
    expect(screen.getByText('jointed')).toBeInTheDocument()
    expect(screen.getByText('dots')).toBeInTheDocument()
  })

  it('shows full field notes for authenticated users', () => {
    const notes = 'A most curious specimen was observed along the rocky shoreline at low tide, exhibiting remarkable bilateral symmetry and an unusual crown of iridescent filaments.'
    render(
      <SpeciesDetail
        entry={makeEntry({ field_notes: notes })}
        isAuthenticated={true}
        onPrev={null}
        onNext={null}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByText(notes)).toBeInTheDocument()
    expect(screen.queryByText(/sign in to read/i)).not.toBeInTheDocument()
  })

  it('shows teaser and sign-in prompt for unauthenticated users when notes exceed 120 chars', () => {
    // Notes longer than FIELD_NOTES_TEASER_LENGTH (120) so teaser is triggered
    const longNotes = 'A most curious specimen was observed along the rocky shoreline at low tide, exhibiting remarkable bilateral symmetry and an unusual crown of iridescent filaments.'
    render(
      <SpeciesDetail
        entry={makeEntry({ field_notes: longNotes })}
        isAuthenticated={false}
        onPrev={null}
        onNext={null}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByText(/sign in to read/i)).toBeInTheDocument()
    // Full text should not appear (it's longer than the teaser cutoff)
    expect(screen.queryByText(longNotes)).not.toBeInTheDocument()
  })

  it('shows full notes for unauthenticated users when notes are within teaser length', () => {
    // Short notes (≤120 chars) are shown in full — no need to tease
    const shortNotes = 'A small specimen.'
    render(
      <SpeciesDetail
        entry={makeEntry({ field_notes: shortNotes })}
        isAuthenticated={false}
        onPrev={null}
        onNext={null}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByText(shortNotes)).toBeInTheDocument()
    expect(screen.queryByText(/sign in to read/i)).not.toBeInTheDocument()
  })

  it('shows discovery count in discovery record', () => {
    render(
      <SpeciesDetail
        entry={makeEntry({ discovery_count: 5 })}
        isAuthenticated={true}
        onPrev={null}
        onNext={null}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByText('5 explorers')).toBeInTheDocument()
  })

  it('uses singular "explorer" for discovery_count of 1', () => {
    render(
      <SpeciesDetail
        entry={makeEntry({ discovery_count: 1 })}
        isAuthenticated={true}
        onPrev={null}
        onNext={null}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByText('1 explorer')).toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn()
    render(
      <SpeciesDetail
        entry={makeEntry()}
        isAuthenticated={true}
        onPrev={null}
        onNext={null}
        onClose={onClose}
      />,
    )
    fireEvent.click(screen.getByLabelText('Close species detail'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('prev button is disabled when onPrev is null', () => {
    render(
      <SpeciesDetail
        entry={makeEntry()}
        isAuthenticated={true}
        onPrev={null}
        onNext={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByLabelText('Previous species')).toBeDisabled()
  })

  it('next button is disabled when onNext is null', () => {
    render(
      <SpeciesDetail
        entry={makeEntry()}
        isAuthenticated={true}
        onPrev={vi.fn()}
        onNext={null}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByLabelText('Next species')).toBeDisabled()
  })

  it('calls onPrev when prev button is clicked', () => {
    const onPrev = vi.fn()
    render(
      <SpeciesDetail
        entry={makeEntry()}
        isAuthenticated={true}
        onPrev={onPrev}
        onNext={null}
        onClose={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByLabelText('Previous species'))
    expect(onPrev).toHaveBeenCalledOnce()
  })

  it('calls onNext when next button is clicked', () => {
    const onNext = vi.fn()
    render(
      <SpeciesDetail
        entry={makeEntry()}
        isAuthenticated={true}
        onPrev={null}
        onNext={onNext}
        onClose={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByLabelText('Next species'))
    expect(onNext).toHaveBeenCalledOnce()
  })
})
