// ABOUT: Corpus regression test for the tier-change body prompt
// ABOUT: Asserts in-voice invariants and modest variety on a fixed sample set

import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const repoRoot = join(__dirname, '..', '..')
const TRIAL_PATH = join(repoRoot, 'scripts/output/trial-tier-change-bodies.json')

type Tier = 'extraordinary' | 'notable' | 'common'

interface TrialSample {
  binomial: string
  old_tier: Tier
  new_tier: Tier
  new_discovery_count: number
  body: string
  first_word: string
  length_chars: number
  length_words: number
}

interface TrialOutput {
  sample_count: number
  samples: TrialSample[]
}

describe('Tier-change body corpus regression', () => {
  if (!existsSync(TRIAL_PATH)) {
    it.skip('trial-tier-change-bodies.json missing — run `npx tsx scripts/trial-tier-change-bodies.ts`', () => {})
    return
  }

  const trial = JSON.parse(readFileSync(TRIAL_PATH, 'utf-8')) as TrialOutput
  const samples = trial.samples

  it('has at least 16 samples to be statistically meaningful', () => {
    expect(samples.length).toBeGreaterThanOrEqual(16)
  })

  it('every sample contains its binomial verbatim (load-bearing for frontend extraction)', () => {
    // TierChangeDispatch uses body.indexOf(binomial) to underline + link the
    // species name. If the model abbreviates or modifies the binomial, the
    // dispatch silently fails to highlight it.
    const offenders = samples.filter((s) => !s.body.includes(s.binomial))
    expect(
      offenders,
      `Binomial-missing samples: ${offenders.map((s) => `${s.binomial} / "${s.body.slice(0, 60)}"`).join(' | ')}`,
    ).toEqual([])
  })

  it('every sample contains the new tier display name', () => {
    const tierLabel = { extraordinary: 'Extraordinary', notable: 'Notable', common: 'Common' } as const
    const offenders = samples.filter((s) => !s.body.includes(tierLabel[s.new_tier]))
    expect(
      offenders,
      `Tier-name-missing samples: ${offenders.map((s) => `${s.new_tier} / "${s.body.slice(0, 60)}"`).join(' | ')}`,
    ).toEqual([])
  })

  it('every sample uses the Society idiom verb-phrase for its direction', () => {
    // Forward direction is the only one the production code emits today; this
    // corpus is forward-only. If the harness ever covers reverse transitions
    // ("elevated to the Extraordinary"), the regex below needs updating.
    const idiomByNewTier: Record<Tier, RegExp> = {
      notable: /settled into the Notable/i,
      common: /lapsed into the Common/i,
      extraordinary: /elevated to the Extraordinary/i,
    }
    const offenders = samples.filter((s) => !idiomByNewTier[s.new_tier].test(s.body))
    expect(
      offenders,
      `Idiom-missing samples: ${offenders.map((s) => `${s.new_tier} / "${s.body.slice(0, 80)}"`).join(' | ')}`,
    ).toEqual([])
  })

  it('contains no exclamation marks (no breathless ad-copy)', () => {
    const offenders = samples.filter((s) => s.body.includes('!'))
    expect(offenders, `Exclamation samples: ${offenders.map((s) => `"${s.body.slice(0, 60)}"`).join(' | ')}`).toEqual([])
  })

  it('contains no causal speculation tokens', () => {
    // Spec §What a post says: "Never speculates about why the change happened."
    // We forbid the common cheating-tokens the model slips toward.
    const CAUSAL = /\b(because|due to|as the catalogue|as more explorers|with growing interest|owing to|in response to)\b/i
    const offenders = samples.filter((s) => CAUSAL.test(s.body))
    expect(
      offenders,
      `Causal-speculation samples: ${offenders.map((s) => `"${s.body.slice(0, 80)}"`).join(' | ')}`,
    ).toEqual([])
  })

  it('respects the 240-char / 40-word length cap', () => {
    const tooLong = samples.filter((s) => s.length_chars > 240 || s.length_words > 40)
    expect(
      tooLong,
      `Over-length samples: ${tooLong.map((s) => `${s.length_chars}c/${s.length_words}w "${s.body.slice(0, 60)}"`).join(' | ')}`,
    ).toEqual([])
  })

  it('produces distinct bodies across samples (model is not literally repeating itself)', () => {
    // The prompt is templated by design (the verb-phrase is fixed), but the
    // surrounding clause varies. If the model collapses to a single output
    // string repeated across binomials, this test catches it.
    const distinct = new Set(samples.map((s) => s.body.toLowerCase()))
    expect(distinct.size).toBeGreaterThanOrEqual(Math.floor(samples.length * 0.9))
  })

  it('uses at least 2 distinct post-idiom clauses per direction (modest variety)', () => {
    // Strip the templated lead ("{binomial} has settled into the Notable tier"
    // or "{binomial} has lapsed into the Common tier") and check that what
    // follows is not identical across all samples for that direction.
    function tailAfterIdiom(s: TrialSample): string {
      const lead = s.new_tier === 'notable' ? 'settled into the Notable tier' : 'lapsed into the Common tier'
      const idx = s.body.toLowerCase().indexOf(lead.toLowerCase())
      return idx >= 0 ? s.body.slice(idx + lead.length).trim().toLowerCase() : s.body.toLowerCase()
    }
    for (const direction of ['notable', 'common'] as const) {
      const tails = samples.filter((s) => s.new_tier === direction).map(tailAfterIdiom)
      const distinct = new Set(tails)
      expect(
        distinct.size,
        `${direction} direction has only ${distinct.size} distinct post-idiom clause(s) across ${tails.length} samples`,
      ).toBeGreaterThanOrEqual(2)
    }
  })
})
