// ABOUT: Trial harness for the field-notes prompt — generates fresh notes for the
// ABOUT: 18 local (DNA, image) pairs and writes results to scripts/output/

/**
 * One-shot trial-and-score harness for TD-031.
 *
 * Reads the local DB dump (`downloads-claude-ship/qrious-database-2026-04-06.json`)
 * and the matching image set (`downloads-claude-ship/qrious-images-2026-04-06/original/`),
 * pairs each species_image with its creature DNA, and re-generates field notes using
 * the current `buildClaudePrompt()` + `generateFieldNotes()` against Claude Haiku.
 *
 * Output: `scripts/output/trial-field-notes.json` — the artifact the classifier test
 * runs against. The JSON is committed so future prompt drift is caught mechanically.
 *
 * Required env:
 *   ANTHROPIC_API_KEY     — read from .dev.vars by default
 *
 * Run:
 *   npx tsx scripts/trial-field-notes.ts
 *
 * Optional:
 *   LIMIT=3 npx tsx scripts/trial-field-notes.ts    — first 3 samples only
 *   CONCURRENCY=4 npx tsx scripts/trial-field-notes.ts
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { CreatureDNA } from '../src/types/creature.ts'
import { buildClaudePrompt } from '../workers/generate-creature/prompt.ts'
import { generateFieldNotes } from '../workers/generate-creature/claude.ts'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const repoRoot = join(__dirname, '..')

const DB_DUMP = join(repoRoot, 'downloads-claude-ship/qrious-database-2026-04-06.json')
const IMAGE_DIR = join(repoRoot, 'downloads-claude-ship/qrious-images-2026-04-06/original')
const OUTPUT_DIR = join(repoRoot, 'scripts/output')
const OUTPUT_FILE = join(OUTPUT_DIR, 'trial-field-notes.json')

interface SpeciesImageRow {
  qr_hash: string
  field_notes: string | null
  image_url: string
}

interface CreatureRow {
  qr_hash: string
  dna: CreatureDNA
}

interface Dump {
  species_images: SpeciesImageRow[]
  creatures: CreatureRow[]
}

interface TrialSample {
  qr_hash: string
  genus_species: string
  original_field_notes: string
  new_field_notes: string
  first_word: string
  first_sentence: string
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

function imageToBase64(qrHash: string): { data: string; mimeType: 'image/png' } {
  const path = join(IMAGE_DIR, `${qrHash}.png`)
  if (!existsSync(path)) {
    throw new Error(`Missing local image for ${qrHash}: ${path}`)
  }
  const buf = readFileSync(path)
  return { data: buf.toString('base64'), mimeType: 'image/png' }
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

function firstSentence(text: string): string {
  const trimmed = text.trim()
  const match = trimmed.match(/^[^.!?]+[.!?]/)
  return (match?.[0] ?? trimmed).trim()
}

async function runTrial(): Promise<void> {
  const env = { ...loadDevVars(), ...process.env }
  const apiKey = env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY missing from .dev.vars or environment')
    process.exit(1)
  }

  const dump = JSON.parse(readFileSync(DB_DUMP, 'utf-8')) as Dump
  // creatures.qr_hash is the 8-char prefix; species_images.qr_hash is the full 16-char.
  // Pair by prefix so a single DNA covers multiple discoverers of the same species.
  const dnaByPrefix = new Map<string, CreatureDNA>()
  for (const c of dump.creatures) dnaByPrefix.set(c.qr_hash, c.dna)

  const candidates = dump.species_images.filter(
    (s) => s.field_notes && dnaByPrefix.has(s.qr_hash.slice(0, 8)) && existsSync(join(IMAGE_DIR, `${s.qr_hash}.png`)),
  )

  const limit = Number(env.LIMIT ?? candidates.length)
  const work = candidates.slice(0, limit)
  console.log(`Running trial over ${work.length} samples...`)

  const samples: TrialSample[] = []
  for (const [i, row] of work.entries()) {
    const dna = dnaByPrefix.get(row.qr_hash.slice(0, 8))!
    const { data, mimeType } = imageToBase64(row.qr_hash)
    const prompt = buildClaudePrompt(dna, true)
    process.stdout.write(`  [${i + 1}/${work.length}] ${dna.genus} ${dna.species} (${row.qr_hash})... `)
    try {
      const newNotes = await callWithRetry(() => generateFieldNotes(prompt, apiKey, data, mimeType))
      const sentence = firstSentence(newNotes)
      const firstWord = sentence.split(/[\s,.]/)[0]
      samples.push({
        qr_hash: row.qr_hash,
        genus_species: `${dna.genus} ${dna.species}`,
        original_field_notes: row.field_notes!,
        new_field_notes: newNotes,
        first_word: firstWord,
        first_sentence: sentence,
      })
      console.log(`ok (opens with "${firstWord}")`)
    } catch (err) {
      console.log(`FAILED: ${(err as Error).message}`)
    }
  }

  if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true })
  const result = {
    generated_at: new Date().toISOString(),
    prompt_revision: 'TD-031 — six opener-directives rotated by dna.seed % 6',
    sample_count: samples.length,
    samples,
  }
  writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2) + '\n')
  console.log(`\nWrote ${samples.length} samples to ${OUTPUT_FILE}`)

  const firstWords = samples.map((s) => s.first_word)
  const counts: Record<string, number> = {}
  for (const w of firstWords) counts[w] = (counts[w] ?? 0) + 1
  console.log('\nFirst-word distribution (raw):')
  for (const [w, n] of Object.entries(counts).sort(([, a], [, b]) => b - a)) {
    console.log(`  ${w}: ${n} (${((n / samples.length) * 100).toFixed(0)}%)`)
  }
}

runTrial().catch((err) => {
  console.error(err)
  process.exit(1)
})
