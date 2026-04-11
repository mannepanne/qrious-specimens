// ABOUT: Tests for CreatureRendererSketch — Victorian ink-on-parchment SVG renderer
// ABOUT: Verifies deterministic output, valid SVG structure, and anatomical variant coverage

import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import CreatureRendererSketch from './CreatureRendererSketch'
import { generateCreatureDNA } from '@/lib/creatureEngine'
import type { CreatureDNA } from '@/types/creature'

// Base DNA for structural tests — generated deterministically
const BASE_DNA: CreatureDNA = generateCreatureDNA('https://example.com/qr/test')

// A spread of inputs to exercise different code paths
const TEST_INPUTS = [
  'short',
  'https://example.com/a-normal-url',
  'WIFI:T:WPA;S:Network;P:pass123;;',
  'x'.repeat(500),
  'こんにちは 🦑',
]

describe('CreatureRendererSketch', () => {
  describe('renders without throwing', () => {
    it('renders with base DNA', () => {
      expect(() => render(<CreatureRendererSketch dna={BASE_DNA} />)).not.toThrow()
    })

    it('renders at different sizes', () => {
      for (const size of [80, 120, 200, 400]) {
        expect(() => render(<CreatureRendererSketch dna={BASE_DNA} size={size} />)).not.toThrow()
      }
    })

    it('renders with showAnnotations', () => {
      expect(() => render(<CreatureRendererSketch dna={BASE_DNA} showAnnotations />)).not.toThrow()
    })

    it('renders with animated prop', () => {
      expect(() => render(<CreatureRendererSketch dna={BASE_DNA} animated />)).not.toThrow()
    })

    it('renders with custom inkColor', () => {
      expect(() => render(<CreatureRendererSketch dna={BASE_DNA} inkColor="#003366" />)).not.toThrow()
    })

    it('renders for all test inputs', () => {
      for (const input of TEST_INPUTS) {
        const dna = generateCreatureDNA(input)
        expect(() => render(<CreatureRendererSketch dna={dna} />)).not.toThrow()
      }
    })
  })

  describe('SVG structure', () => {
    it('renders an svg element', () => {
      const { container } = render(<CreatureRendererSketch dna={BASE_DNA} size={200} />)
      const svg = container.querySelector('svg')
      expect(svg).not.toBeNull()
    })

    it('svg has correct width and height', () => {
      const { container } = render(<CreatureRendererSketch dna={BASE_DNA} size={160} />)
      const svg = container.querySelector('svg')
      expect(svg?.getAttribute('width')).toBe('160')
      expect(svg?.getAttribute('height')).toBe('160')
    })

    it('renders path elements (body and limbs)', () => {
      const { container } = render(<CreatureRendererSketch dna={BASE_DNA} />)
      const paths = container.querySelectorAll('path')
      expect(paths.length).toBeGreaterThan(0)
    })
  })

  describe('anatomical variant coverage', () => {
    const BODY_SHAPES = ['ovoid', 'elongated', 'spherical', 'bell', 'star', 'diamond'] as const
    const LIMB_STYLES = ['tentacle', 'jointed', 'branching', 'flowing', 'spike'] as const
    const PATTERN_TYPES = ['dots', 'stripes', 'rings', 'mesh', 'scales', 'none'] as const

    for (const bodyShape of BODY_SHAPES) {
      it(`renders body shape: ${bodyShape}`, () => {
        const dna: CreatureDNA = { ...BASE_DNA, bodyShape }
        expect(() => render(<CreatureRendererSketch dna={dna} />)).not.toThrow()
      })
    }

    for (const limbStyle of LIMB_STYLES) {
      it(`renders limb style: ${limbStyle}`, () => {
        const dna: CreatureDNA = { ...BASE_DNA, limbStyle }
        expect(() => render(<CreatureRendererSketch dna={dna} />)).not.toThrow()
      })
    }

    for (const patternType of PATTERN_TYPES) {
      it(`renders pattern type: ${patternType}`, () => {
        const dna: CreatureDNA = { ...BASE_DNA, patternType }
        expect(() => render(<CreatureRendererSketch dna={dna} />)).not.toThrow()
      })
    }

    it('renders with all optional features enabled', () => {
      const dna: CreatureDNA = { ...BASE_DNA, hasAntennae: true, hasTail: true, hasShell: true, hasCrown: true }
      expect(() => render(<CreatureRendererSketch dna={dna} />)).not.toThrow()
    })

    it('renders with all optional features disabled', () => {
      const dna: CreatureDNA = { ...BASE_DNA, hasAntennae: false, hasTail: false, hasShell: false, hasCrown: false }
      expect(() => render(<CreatureRendererSketch dna={dna} />)).not.toThrow()
    })
  })

  describe('determinism', () => {
    it('produces identical output for the same DNA', () => {
      const { container: a } = render(<CreatureRendererSketch dna={BASE_DNA} size={200} />)
      const { container: b } = render(<CreatureRendererSketch dna={BASE_DNA} size={200} />)
      expect(a.innerHTML).toBe(b.innerHTML)
    })
  })
})
