// ABOUT: Tests for rarity computation from discovery counts

import { describe, it, expect } from 'vitest'
import { getRarityFromCount, getRarityLabel, getRarityColor } from './rarity'

describe('getRarityFromCount', () => {
  it('returns rare for 1 discoverer', () => {
    expect(getRarityFromCount(1)).toBe('rare')
  })

  it('returns rare for 3 discoverers', () => {
    expect(getRarityFromCount(3)).toBe('rare')
  })

  it('returns uncommon for 4 discoverers', () => {
    expect(getRarityFromCount(4)).toBe('uncommon')
  })

  it('returns uncommon for 15 discoverers', () => {
    expect(getRarityFromCount(15)).toBe('uncommon')
  })

  it('returns common for 16 discoverers', () => {
    expect(getRarityFromCount(16)).toBe('common')
  })

  it('returns common for large counts', () => {
    expect(getRarityFromCount(1000)).toBe('common')
  })

  it('returns rare for 0 discoverers', () => {
    expect(getRarityFromCount(0)).toBe('rare')
  })

  it('returns rare for undefined', () => {
    expect(getRarityFromCount(undefined)).toBe('rare')
  })
})

describe('getRarityLabel', () => {
  it('returns uppercase label', () => {
    expect(getRarityLabel('rare')).toBe('RARE')
    expect(getRarityLabel('uncommon')).toBe('UNCOMMON')
    expect(getRarityLabel('common')).toBe('COMMON')
  })
})

describe('getRarityColor', () => {
  it('returns a string for each rarity', () => {
    expect(typeof getRarityColor('rare')).toBe('string')
    expect(typeof getRarityColor('uncommon')).toBe('string')
    expect(typeof getRarityColor('common')).toBe('string')
  })

  it('returns distinct colours', () => {
    const colors = [
      getRarityColor('rare'),
      getRarityColor('uncommon'),
      getRarityColor('common'),
    ]
    expect(new Set(colors).size).toBe(3)
  })
})
