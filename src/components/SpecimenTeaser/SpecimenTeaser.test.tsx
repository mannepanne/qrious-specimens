// ABOUT: Tests for the SpecimenTeaser cabinet grid card

import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import SpecimenTeaser from './SpecimenTeaser'
import type { CreatureRow } from '@/types/creature'

vi.mock('@/components/CreatureRenderer/CreatureRenderer', () => ({
  default: ({ dna }: { dna: { genus: string } }) => (
    <div data-testid="creature-sketch" data-genus={dna.genus} />
  ),
}))

vi.mock('@/hooks/useSpeciesImage', () => ({
  useSpeciesImage: vi.fn(() => ({
    imageUrl: null,
    imageUrl512: null,
    imageUrl256: null,
    fieldNotes: null,
    isFirstDiscoverer: false,
    isLoading: false,
    error: null,
    retry: vi.fn(),
  })),
}))

const fakeDna: CreatureRow['dna'] = {
  seed: 1,
  hash: 'abc123def456abcd',
  symmetry: 'bilateral',
  symmetryOrder: 2,
  bodyShape: 'ovoid',
  bodyScale: 1,
  limbCount: 4,
  limbStyle: 'jointed',
  limbLength: 0.8,
  limbCurvature: 0.5,
  patternType: 'dots',
  patternDensity: 0.6,
  eyeCount: 2,
  eyeSize: 0.5,
  eyeStyle: 'round',
  hue1: 180,
  hue2: 200,
  saturation: 70,
  lightness: 50,
  hasAntennae: false,
  hasTail: false,
  hasShell: false,
  hasCrown: false,
  genus: 'Corderma',
  species: 'gracilis',
  order: 'Arctus',
  family: 'Arcturidae',
  habitat: 'coastal',
  temperament: 'curious',
  estimatedSize: 'small',
}

function makeCreature(overrides: Partial<CreatureRow> = {}): CreatureRow {
  return {
    id: 'creature-1',
    qr_content: 'qr',
    qr_hash: fakeDna.hash,
    dna: fakeDna,
    nickname: null,
    discovered_at: '2026-04-01T00:00:00Z',
    is_first_discoverer: false,
    ...overrides,
  }
}

describe('SpecimenTeaser', () => {
  it('shows binomial + family when no nickname is set', () => {
    render(<SpecimenTeaser creature={makeCreature()} discoveryCount={3} />)
    expect(screen.getByText('Corderma gracilis')).toBeInTheDocument()
    expect(screen.getByText('Arcturidae')).toBeInTheDocument()
    // The genus alone should not appear as a standalone line
    expect(screen.queryByText(/^Corderma$/)).not.toBeInTheDocument()
  })

  it('stacks the discoverer nickname above the binomial when set', () => {
    render(
      <SpecimenTeaser
        creature={makeCreature({ nickname: 'Sir Wiggles' })}
        discoveryCount={3}
      />,
    )
    // All three lines visible
    expect(screen.getByText('Sir Wiggles')).toBeInTheDocument()
    expect(screen.getByText('Corderma gracilis')).toBeInTheDocument()
    expect(screen.getByText('Arcturidae')).toBeInTheDocument()
  })

  it('shows rarity label as plain coloured text (not a bordered pill)', () => {
    render(<SpecimenTeaser creature={makeCreature()} discoveryCount={2} />)
    const rarity = screen.getByText('RARE')
    // Style is set inline; assert no border declared on the element
    expect(rarity).toBeInTheDocument()
    expect(rarity.style.border).toBe('')
  })

  it('renders the first-discoverer pineapple when is_first_discoverer is true', () => {
    const { container } = render(
      <SpecimenTeaser
        creature={makeCreature({ is_first_discoverer: true })}
        discoveryCount={3}
      />,
    )
    // The Pineapple component renders as an svg with its own classes
    expect(container.querySelector('svg.text-amber-600')).toBeInTheDocument()
  })

  it('omits the pineapple when is_first_discoverer is false', () => {
    const { container } = render(
      <SpecimenTeaser creature={makeCreature()} discoveryCount={3} />,
    )
    expect(container.querySelector('svg.text-amber-600')).not.toBeInTheDocument()
  })

  it('calls onClick when the card is clicked', () => {
    const onClick = vi.fn()
    render(<SpecimenTeaser creature={makeCreature()} discoveryCount={3} onClick={onClick} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledOnce()
  })
})
