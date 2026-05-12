// ABOUT: Trial harness for the tier-change body prompt — runs generateTierChangeBody()
// ABOUT: over real binomials and writes scripts/output/trial-tier-change-bodies.json

/**
 * Trial-and-score harness for the rarity-and-census tier-change Gazette notices.
 *
 * Reads the local DB dump (`downloads-claude-ship/qrious-database-2026-04-06.json`),
 * picks unique binomials from the creatures table, and runs each through
 * `generateTierChangeBody()` for both forward tier transitions:
 *   - extraordinary → notable (count = 4)
 *   - notable → common (count = 16)
 *
 * Output is committed to `scripts/output/trial-tier-change-bodies.json` so the
 * corpus regression test (`workers/generate-creature/tierChangeBody.test.ts`)
 * can assert in-voice qualities and first-word variety on a fixed sample.
 *
 * Required env:
 *   ANTHROPIC_API_KEY     — read from .dev.vars by default
 *
 * Run:
 *   npx tsx scripts/trial-tier-change-bodies.ts
 *
 * Optional:
 *   LIMIT=4 npx tsx scripts/trial-tier-change-bodies.ts    — first 4 binomials only
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildTierChangeBodyPrompt } from '../workers/generate-creature/prompt.ts'
import { generateTierChangeBody } from '../workers/generate-creature/claude.ts'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const repoRoot = join(__dirname, '..')

const DB_DUMP = join(repoRoot, 'downloads-claude-ship/qrious-database-2026-04-06.json')
const OUTPUT_DIR = join(repoRoot, 'scripts/output')
const OUTPUT_FILE = join(OUTPUT_DIR, 'trial-tier-change-bodies.json')

interface CreatureRow {
  qr_hash: string
  dna: { genus: string; species: string; seed: number }
}

interface Dump {
  creatures: CreatureRow[]
}

type Tier = 'extraordinary' | 'notable' | 'common'

interface Transition {
  oldTier: Tier
  newTier: Tier
  newDiscoveryCount: number
}

const FORWARD_TRANSITIONS: Transition[] = [
  { oldTier: 'extraordinary', newTier: 'notable', newDiscoveryCount: 4 },
  { oldTier: 'notable', newTier: 'common', newDiscoveryCount: 16 },
]

interface TrialSample {
  binomial: string
  seed: number
  old_tier: Tier
  new_tier: Tier
  new_discovery_count: number
  body: string
  first_word: string
  length_chars: number
  length_words: number
}

function loadDevVars(): Record<string, string> {
  const path = join(repoRoot, '.dev.vars')
  if (!existsSync(path)) return {}
  const out: Record<string, string> = {}
  for (const line of readFileSync(path, 'utf-8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    out[key] = value
  }
  return out
}

async function callWithRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      const last = i === attempts - 1
      if (last) throw err
      const wait = 1000 * Math.pow(2, i)
      process.stdout.write(`(retry ${i + 1}/${attempts - 1} after ${wait}ms) `)
      await new Promise((r) => setTimeout(r, wait))
    }
  }
  throw new Error('unreachable')
}

async function runTrial(): Promise<void> {
  const env = { ...loadDevVars(), ...process.env }
  const apiKey = env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY missing from .dev.vars or environment')
    process.exit(1)
  }

  const dump = JSON.parse(readFileSync(DB_DUMP, 'utf-8')) as Dump
  // De-duplicate by binomial so we don't hammer the same species twice.
  const uniqueByBinomial = new Map<string, CreatureRow>()
  for (const c of dump.creatures) {
    const key = `${c.dna.genus} ${c.dna.species}`
    if (!uniqueByBinomial.has(key)) uniqueByBinomial.set(key, c)
  }
  const creatures = Array.from(uniqueByBinomial.values())
  const limit = Number(env.LIMIT ?? creatures.length)
  const work = creatures.slice(0, limit)
  console.log(`Running tier-change trial over ${work.length} binomials × ${FORWARD_TRANSITIONS.length} transitions = ${work.length * FORWARD_TRANSITIONS.length} samples...`)

  const samples: TrialSample[] = []
  let i = 0
  for (const c of work) {
    const binomial = `${c.dna.genus} ${c.dna.species}`
    for (const t of FORWARD_TRANSITIONS) {
      i += 1
      const prompt = buildTierChangeBodyPrompt({
        binomial,
        oldTier: t.oldTier,
        newTier: t.newTier,
        newDiscoveryCount: t.newDiscoveryCount,
      })
      process.stdout.write(`  [${i}/${work.length * FORWARD_TRANSITIONS.length}] ${binomial} ${t.oldTier}→${t.newTier}... `)
      try {
        const body = await callWithRetry(() => generateTierChangeBody(prompt, apiKey))
        const firstWord = body.trim().split(/[\s,.]/)[0]
        samples.push({
          binomial,
          seed: c.dna.seed,
          old_tier: t.oldTier,
          new_tier: t.newTier,
          new_discovery_count: t.newDiscoveryCount,
          body,
          first_word: firstWord,
          length_chars: body.length,
          length_words: body.trim().split(/\s+/).length,
        })
        console.log(`ok (${body.length} chars) "${body.slice(0, 70)}${body.length > 70 ? '…' : ''}"`)
      } catch (err) {
        console.log(`FAILED: ${(err as Error).message}`)
      }
      await new Promise((r) => setTimeout(r, 200))
    }
  }

  if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true })
  const result = {
    generated_at: new Date().toISOString(),
    prompt_revision: 'rarity-and-census — tier-change body v1',
    sample_count: samples.length,
    samples,
  }
  writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2) + '\n')
  console.log(`\nWrote ${samples.length} samples to ${OUTPUT_FILE}`)

  const firstWordCounts: Record<string, number> = {}
  for (const s of samples) {
    const key = s.first_word.toLowerCase()
    firstWordCounts[key] = (firstWordCounts[key] ?? 0) + 1
  }
  console.log('\nFirst-word distribution:')
  for (const [w, n] of Object.entries(firstWordCounts).sort(([, a], [, b]) => b - a)) {
    console.log(`  ${w}: ${n} (${((n / samples.length) * 100).toFixed(0)}%)`)
  }

  const lengths = samples.map((s) => s.length_chars)
  if (lengths.length) {
    const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length
    const max = Math.max(...lengths)
    const over240 = lengths.filter((n) => n > 240).length
    console.log(`\nLength: avg ${avg.toFixed(0)} chars, max ${max} chars, ${over240} over 240-char ceiling`)
  }
}

runTrial().catch((err) => {
  console.error(err)
  process.exit(1)
})
