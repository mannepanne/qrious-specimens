// ABOUT: Tests for rarity computation from discovery counts

import { describe, it, expect } from 'vitest'
import {
  EXTRAORDINARY_MAX,
  NOTABLE_MAX,
  getRarityFromCount,
  getRarityLabel,
  getRarityColor,
} from './rarity'

describe('threshold constants', () => {
  it('matches the documented Extraordinary/Notable boundaries', () => {
    expect(EXTRAORDINARY_MAX).toBe(3)
    expect(NOTABLE_MAX).toBe(15)
  })
})

describe('getRarityFromCount', () => {
  it('returns extraordinary for 1 discoverer', () => {
    expect(getRarityFromCount(1)).toBe('extraordinary')
  })

  it('returns extraordinary for 3 discoverers', () => {
    expect(getRarityFromCount(3)).toBe('extraordinary')
  })

  it('returns notable for 4 discoverers', () => {
    expect(getRarityFromCount(4)).toBe('notable')
  })

  it('returns notable for 15 discoverers', () => {
    expect(getRarityFromCount(15)).toBe('notable')
  })

  it('returns common for 16 discoverers', () => {
    expect(getRarityFromCount(16)).toBe('common')
  })

  it('returns common for large counts', () => {
    expect(getRarityFromCount(1000)).toBe('common')
  })

  it('returns extraordinary for 0 discoverers', () => {
    expect(getRarityFromCount(0)).toBe('extraordinary')
  })

  it('returns extraordinary for undefined', () => {
    expect(getRarityFromCount(undefined)).toBe('extraordinary')
  })
})

describe('getRarityLabel', () => {
  it('returns uppercase label', () => {
    expect(getRarityLabel('extraordinary')).toBe('EXTRAORDINARY')
    expect(getRarityLabel('notable')).toBe('NOTABLE')
    expect(getRarityLabel('common')).toBe('COMMON')
  })
})

describe('getRarityColor', () => {
  it('returns a string for each rarity', () => {
    expect(typeof getRarityColor('extraordinary')).toBe('string')
    expect(typeof getRarityColor('notable')).toBe('string')
    expect(typeof getRarityColor('common')).toBe('string')
  })

  it('returns distinct colours', () => {
    const colors = [
      getRarityColor('extraordinary'),
      getRarityColor('notable'),
      getRarityColor('common'),
    ]
    expect(new Set(colors).size).toBe(3)
  })
})
