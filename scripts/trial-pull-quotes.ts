// ABOUT: Trial harness for the pull-quote prompt — runs generatePullQuote() over
// ABOUT: existing field notes and writes scripts/output/trial-pull-quotes.json

/**
 * Trial-and-score harness for the Gazette redesign pull-quotes.
 *
 * Reads the local DB dump (`downloads-claude-ship/qrious-database-2026-04-06.json`),
 * picks every species_images row that has field_notes, and runs each through
 * `generatePullQuote()` against Claude Haiku. Output is committed to
 * `scripts/output/trial-pull-quotes.json` so the corpus regression test
 * (`workers/generate-creature/pullQuote.test.ts`) can assert opener-shape
 * variety on a fixed sample.
 *
 * Required env:
 *   ANTHROPIC_API_KEY     — read from .dev.vars by default
 *
 * Run:
 *   npx tsx scripts/trial-pull-quotes.ts
 *
 * Optional:
 *   LIMIT=5 npx tsx scripts/trial-pull-quotes.ts    — first 5 samples only
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildPullQuotePrompt } from '../workers/generate-creature/prompt.ts'
import { generatePullQuote } from '../workers/generate-creature/claude.ts'
import { classifyOpenerShape } from '../workers/generate-creature/openerShape.ts'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const repoRoot = join(__dirname, '..')

const DB_DUMP = join(repoRoot, 'downloads-claude-ship/qrious-database-2026-04-06.json')
const OUTPUT_DIR = join(repoRoot, 'scripts/output')
const OUTPUT_FILE = join(OUTPUT_DIR, 'trial-pull-quotes.json')

interface SpeciesImageRow {
  qr_hash: string
  field_notes: string | null
}

interface CreatureRow {
  qr_hash: string
  dna: { genus: string; species: string; seed: number }
}

interface Dump {
  species_images: SpeciesImageRow[]
  creatures: CreatureRow[]
}

interface TrialSample {
  qr_hash: string
  genus_species: string
  seed: number
  lead_directive_index: number
  field_notes: string
  pull_quote: string
  first_word: string
  opener_shape: string
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
  // creatures.qr_hash is the 8-char prefix; species_images.qr_hash is the full 16.
  const dnaByPrefix = new Map<string, { genus: string; species: string; seed: number }>()
  for (const c of dump.creatures) dnaByPrefix.set(c.qr_hash, c.dna)

  const candidates = dump.species_images.filter((s) => s.field_notes && dnaByPrefix.has(s.qr_hash.slice(0, 8)))
  const limit = Number(env.LIMIT ?? candidates.length)
  const work = candidates.slice(0, limit)
  console.log(`Running pull-quote trial over ${work.length} samples...`)

  const samples: TrialSample[] = []
  for (const [i, row] of work.entries()) {
    const dna = dnaByPrefix.get(row.qr_hash.slice(0, 8))!
    const prompt = buildPullQuotePrompt(row.field_notes!, dna.seed)
    process.stdout.write(`  [${i + 1}/${work.length}] ${dna.genus} ${dna.species} (${row.qr_hash})... `)
    try {
      const pullQuote = await callWithRetry(() => generatePullQuote(prompt, apiKey))
      const firstWord = pullQuote.trim().split(/[\s,.]/)[0]
      const shape = classifyOpenerShape(pullQuote)
      samples.push({
        qr_hash: row.qr_hash,
        genus_species: `${dna.genus} ${dna.species}`,
        seed: dna.seed,
        lead_directive_index: Math.abs(Math.floor(dna.seed)) % 6,
        field_notes: row.field_notes!,
        pull_quote: pullQuote,
        first_word: firstWord,
        opener_shape: shape,
      })
      console.log(`ok [${shape}] "${pullQuote.slice(0, 60)}${pullQuote.length > 60 ? '…' : ''}"`)
    } catch (err) {
      console.log(`FAILED: ${(err as Error).message}`)
    }
    await new Promise((r) => setTimeout(r, 200))
  }

  if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true })
  const result = {
    generated_at: new Date().toISOString(),
    prompt_revision: 'Gazette redesign — pull-quote v3 (seeded directives + tightened length and lead-priority)',
    sample_count: samples.length,
    samples,
  }
  writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2) + '\n')
  console.log(`\nWrote ${samples.length} samples to ${OUTPUT_FILE}`)

  const shapeCounts: Record<string, number> = {}
  for (const s of samples) shapeCounts[s.opener_shape] = (shapeCounts[s.opener_shape] ?? 0) + 1
  console.log('\nOpener-shape distribution:')
  for (const [shape, n] of Object.entries(shapeCounts).sort(([, a], [, b]) => b - a)) {
    console.log(`  ${shape}: ${n} (${((n / samples.length) * 100).toFixed(0)}%)`)
  }

  const lengths = samples.map((s) => s.pull_quote.length)
  if (lengths.length) {
    const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length
    const max = Math.max(...lengths)
    const over200 = lengths.filter((n) => n > 200).length
    console.log(`\nLength: avg ${avg.toFixed(0)} chars, max ${max} chars, ${over200} over 200-char ceiling`)
  }
}

runTrial().catch((err) => {
  console.error(err)
  process.exit(1)
})
