// ABOUT: Corpus regression test for the Gazette pull-quote prompt
// ABOUT: Sibling to the TD-031 field-notes guard — same uniformity-detection contract

import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import { distributionByShape, type OpenerShape } from './openerShape'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const repoRoot = join(__dirname, '..', '..')
const TRIAL_PATH = join(repoRoot, 'scripts/output/trial-pull-quotes.json')

interface TrialSample {
  qr_hash: string
  pull_quote: string
}

interface TrialOutput {
  sample_count: number
  samples: TrialSample[]
}

describe('Pull-quote corpus uniformity guard', () => {
  if (!existsSync(TRIAL_PATH)) {
    it.skip('trial-pull-quotes.json missing — run `npx tsx scripts/trial-pull-quotes.ts`', () => {})
    return
  }

  const trial = JSON.parse(readFileSync(TRIAL_PATH, 'utf-8')) as TrialOutput
  const quotes = trial.samples.map((s) => s.pull_quote)

  it('has at least 10 samples to be statistically meaningful', () => {
    expect(quotes.length).toBeGreaterThanOrEqual(10)
  })

  it('keeps every templated opener-shape under 35% of the corpus', () => {
    // Same calibration as the TD-031 field-notes guard: under 6-way directive
    // rotation, expected per-shape share is ~16–25% with sampling noise at
    // n=16. The 35% cap is loose enough for noise, tight enough to fail
    // noisily if the prompt drifts back toward a single attractor (the
    // pre-rotation pull-quote disease was 38–63% "Three…" / "Four…" leads).
    const counts = distributionByShape(quotes)
    const total = quotes.length
    const templated: OpenerShape[] = [
      'temporal-prepositional',
      'generic-introduction',
      'body-part-first',
      'numeric-feature',
      'setting-first',
      'mistaken-identity',
      'rhetorical-question',
    ]
    for (const shape of templated) {
      const share = counts[shape] / total
      expect(
        share,
        `${shape} = ${counts[shape]}/${total} = ${(share * 100).toFixed(0)}% (limit 35%)`,
      ).toBeLessThanOrEqual(0.35)
    }
  })

  it('uses at least 4 distinct opener shapes across the corpus', () => {
    const counts = distributionByShape(quotes)
    const shapesUsed = Object.values(counts).filter((n) => n > 0).length
    expect(shapesUsed).toBeGreaterThanOrEqual(4)
  })

  it('keeps the most-common first word under 35% of the corpus', () => {
    const firstWords = quotes.map((q) => q.trim().split(/[\s,.]/)[0].toLowerCase())
    const counts: Record<string, number> = {}
    for (const w of firstWords) counts[w] = (counts[w] ?? 0) + 1
    const top = Math.max(...Object.values(counts))
    expect(top / firstWords.length).toBeLessThanOrEqual(0.35)
  })

  it('contains no rarity vocabulary (forward-compat with rarity-and-census.md)', () => {
    // The pull-quote prompt forbids rarity language so the catalogue's rarity
    // treatment can layer on cleanly. If the model leaks a rarity word, the
    // prompt's hard rule has slipped.
    const RARITY_TERMS = /\b(rare|rarest|rarity|common|uncommon|extraordinary|first of its kind|one of a kind)\b/i
    const offenders = quotes.filter((q) => RARITY_TERMS.test(q))
    expect(offenders, `Rarity vocabulary found: ${offenders.map((q) => q.slice(0, 60)).join(' | ')}`).toEqual([])
  })
})
