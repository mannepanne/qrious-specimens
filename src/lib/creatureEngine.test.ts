// ABOUT: Tests for deterministic creature DNA generation

import { describe, it, expect } from 'vitest'
import { generateCreatureDNA } from './creatureEngine'

const VALID_BODY_SHAPES = ['ovoid', 'elongated', 'spherical', 'bell', 'star', 'diamond']
const VALID_SYMMETRIES = ['radial', 'bilateral', 'spiral', 'fractal']
const VALID_LIMB_STYLES = ['tentacle', 'jointed', 'branching', 'flowing', 'spike']
const VALID_EYE_STYLES = ['round', 'slit', 'compound', 'stalk']
const VALID_PATTERN_TYPES = ['dots', 'stripes', 'rings', 'mesh', 'scales', 'none']

describe('generateCreatureDNA', () => {
  describe('determinism', () => {
    it('produces identical DNA for the same input', () => {
      const a = generateCreatureDNA('https://example.com/qr/123')
      const b = generateCreatureDNA('https://example.com/qr/123')
      expect(a).toEqual(b)
    })

    it('produces different DNA for different inputs', () => {
      const a = generateCreatureDNA('alpha')
      const b = generateCreatureDNA('beta')
      expect(a.hash).not.toBe(b.hash)
    })

    it('produces different DNA for 10 distinct inputs', () => {
      const inputs = Array.from({ length: 10 }, (_, i) => `test-input-${i}`)
      const hashes = inputs.map(s => generateCreatureDNA(s).hash)
      expect(new Set(hashes).size).toBe(10)
    })
  })

  describe('hash', () => {
    it('is exactly 16 hex characters', () => {
      const dna = generateCreatureDNA('test')
      expect(dna.hash).toMatch(/^[0-9a-f]{16}$/)
    })

    it('hash is 16 hex chars for empty string', () => {
      const dna = generateCreatureDNA('')
      expect(dna.hash).toMatch(/^[0-9a-f]{16}$/)
    })

    it('hash is 16 hex chars for very long input', () => {
      const dna = generateCreatureDNA('x'.repeat(10000))
      expect(dna.hash).toMatch(/^[0-9a-f]{16}$/)
    })

    it('hash is 16 hex chars for non-ASCII content', () => {
      const dna = generateCreatureDNA('こんにちは 🦑 مرحبا')
      expect(dna.hash).toMatch(/^[0-9a-f]{16}$/)
    })
  })

  describe('required fields', () => {
    const dna = generateCreatureDNA('required-fields-test')

    it('has a numeric seed', () => {
      expect(typeof dna.seed).toBe('number')
    })

    it('has a valid symmetry', () => {
      expect(VALID_SYMMETRIES).toContain(dna.symmetry)
    })

    it('has a valid body shape', () => {
      expect(VALID_BODY_SHAPES).toContain(dna.bodyShape)
    })

    it('has bodyScale within range', () => {
      expect(dna.bodyScale).toBeGreaterThanOrEqual(0.7)
      expect(dna.bodyScale).toBeLessThanOrEqual(1.3)
    })

    it('has a positive limbCount', () => {
      expect(dna.limbCount).toBeGreaterThanOrEqual(0)
    })

    it('has a valid limb style', () => {
      expect(VALID_LIMB_STYLES).toContain(dna.limbStyle)
    })

    it('has limbLength within range', () => {
      expect(dna.limbLength).toBeGreaterThanOrEqual(0.4)
      expect(dna.limbLength).toBeLessThanOrEqual(1.2)
    })

    it('has a valid pattern type', () => {
      expect(VALID_PATTERN_TYPES).toContain(dna.patternType)
    })

    it('has a valid eye style', () => {
      expect(VALID_EYE_STYLES).toContain(dna.eyeStyle)
    })

    it('has hue values within 0–360', () => {
      expect(dna.hue1).toBeGreaterThanOrEqual(0)
      expect(dna.hue1).toBeLessThanOrEqual(360)
      expect(dna.hue2).toBeGreaterThanOrEqual(0)
      expect(dna.hue2).toBeLessThanOrEqual(360)
    })

    it('has saturation within 0–100', () => {
      expect(dna.saturation).toBeGreaterThanOrEqual(0)
      expect(dna.saturation).toBeLessThanOrEqual(100)
    })

    it('has lightness within 0–100', () => {
      expect(dna.lightness).toBeGreaterThanOrEqual(0)
      expect(dna.lightness).toBeLessThanOrEqual(100)
    })

    it('has boolean feature flags', () => {
      expect(typeof dna.hasAntennae).toBe('boolean')
      expect(typeof dna.hasTail).toBe('boolean')
      expect(typeof dna.hasShell).toBe('boolean')
      expect(typeof dna.hasCrown).toBe('boolean')
    })

    it('has non-empty classification strings', () => {
      expect(dna.genus.length).toBeGreaterThan(0)
      expect(dna.species.length).toBeGreaterThan(0)
      expect(dna.order.length).toBeGreaterThan(0)
      expect(dna.family.length).toBeGreaterThan(0)
      expect(dna.habitat.length).toBeGreaterThan(0)
      expect(dna.temperament.length).toBeGreaterThan(0)
      expect(dna.estimatedSize.length).toBeGreaterThan(0)
    })
  })

  describe('edge cases', () => {
    it('handles empty string', () => {
      expect(() => generateCreatureDNA('')).not.toThrow()
    })

    it('handles very long string', () => {
      expect(() => generateCreatureDNA('a'.repeat(100000))).not.toThrow()
    })

    it('handles non-ASCII content', () => {
      expect(() => generateCreatureDNA('日本語テスト 🦑 ñoño')).not.toThrow()
    })

    it('handles URL content', () => {
      const dna = generateCreatureDNA('https://qrious.hultberg.org/scan/abc123')
      expect(dna.hash).toMatch(/^[0-9a-f]{16}$/)
    })

    it('handles plain text content', () => {
      const dna = generateCreatureDNA('WIFI:T:WPA;S:MyNetwork;P:password123;;')
      expect(dna.hash).toMatch(/^[0-9a-f]{16}$/)
    })
  })
})
