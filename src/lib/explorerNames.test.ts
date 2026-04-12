// ABOUT: Tests for Victorian explorer name generator
// ABOUT: Verifies format, determinism, and character of generated names

import { describe, it, expect } from 'vitest'
import { generateExplorerName, randomExplorerName } from './explorerNames'

describe('generateExplorerName', () => {
  it('returns a string', () => {
    expect(typeof generateExplorerName()).toBe('string')
  })

  it('follows "Title I. Surname" format for typical names', () => {
    // Run many iterations to reduce chance of hitting the Easter egg
    const names = Array.from({ length: 50 }, (_, i) => generateExplorerName(i + 100))
    const pattern = /^[A-Za-z.]+\s[A-Z]\.\s[A-Z][a-z]+$/
    // Allow a few Easter egg hits — check that >90% match the pattern
    const matching = names.filter(n => n === 'A. Anning' || pattern.test(n))
    expect(matching.length).toBe(names.length)
  })

  it('is deterministic when given the same seed', () => {
    expect(generateExplorerName(42)).toBe(generateExplorerName(42))
    expect(generateExplorerName(999)).toBe(generateExplorerName(999))
  })

  it('produces different names for different seeds', () => {
    const names = new Set(Array.from({ length: 20 }, (_, i) => generateExplorerName(i)))
    // Expect at least 10 distinct names from 20 seeds
    expect(names.size).toBeGreaterThan(10)
  })

  it('length is reasonable', () => {
    for (let i = 0; i < 30; i++) {
      const name = generateExplorerName(i * 7)
      expect(name.length).toBeGreaterThanOrEqual(5)
      expect(name.length).toBeLessThanOrEqual(40)
    }
  })

  it('includes a known title from the list', () => {
    const titles = ['Dr.', 'Prof.', 'Captain', 'Sir', 'Rev.', 'Lt.', 'Col.', 'Major', 'Lady', 'Dame']
    const names = Array.from({ length: 50 }, (_, i) => generateExplorerName(i + 200))
    const nonEasterEgg = names.filter(n => n !== 'A. Anning')
    nonEasterEgg.forEach(name => {
      expect(titles.some(t => name.startsWith(t))).toBe(true)
    })
  })
})

describe('randomExplorerName', () => {
  it('returns a string', () => {
    expect(typeof randomExplorerName()).toBe('string')
  })

  it('produces names that look like explorer names', () => {
    const name = randomExplorerName()
    // Either Easter egg or standard pattern
    const pattern = /^[A-Za-z.]+\s[A-Z]\.\s[A-Z][a-z]+$/
    expect(name === 'A. Anning' || pattern.test(name)).toBe(true)
  })
})
