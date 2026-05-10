// ABOUT: One-off backfill — populate species_images.pull_quote for rows that have
// ABOUT: field_notes but no pull_quote yet. Idempotent (WHERE pull_quote IS NULL).

/**
 * Required environment variables:
 *   SUPABASE_URL                  e.g. https://tdegawvgtrpvtiqwaoxx.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY     Service role key for Supabase (RLS bypass)
 *   ANTHROPIC_API_KEY             Anthropic API key for Claude Haiku
 *
 * Run (avoids persistent shell export of SUPABASE_SERVICE_ROLE_KEY):
 *   env $(cat .env.backfill) bun run scripts/backfill-pull-quotes.ts
 *
 * Dry run (inspect rows without writing or calling Claude):
 *   DRY_RUN=1 bun run scripts/backfill-pull-quotes.ts
 *
 * Idempotency:
 *   The SELECT predicate is `pull_quote=is.null&field_notes=not.is.null` —
 *   re-runs only touch rows that haven't been backfilled yet. Rows whose
 *   field_notes are themselves null are skipped (no input to distil from).
 *
 * Throttling:
 *   200ms sleep between API calls. Anthropic Haiku has generous limits but
 *   serial backfill of ~20 rows takes 4–5s anyway; the sleep is cheap insurance.
 */

import { generatePullQuote } from '../workers/generate-creature/claude'
import { buildPullQuotePrompt } from '../workers/generate-creature/prompt'

interface SpeciesImageRow {
  qr_hash: string
  field_notes: string
}

interface CreatureRow {
  qr_hash: string
  dna: { seed: number }
}

const env = {
  SUPABASE_URL: requireEnv('SUPABASE_URL'),
  SUPABASE_SERVICE_ROLE_KEY: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
  ANTHROPIC_API_KEY: requireEnv('ANTHROPIC_API_KEY'),
}

const DRY_RUN = process.env.DRY_RUN === '1'
const SLEEP_MS = 200

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) {
    console.error(`Error: missing env var ${name}`)
    process.exit(1)
  }
  return v
}

function supabaseHeaders(): Record<string, string> {
  return {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  }
}

async function selectRowsNeedingBackfill(): Promise<SpeciesImageRow[]> {
  const url =
    `${env.SUPABASE_URL}/rest/v1/species_images` +
    `?select=qr_hash,field_notes` +
    `&pull_quote=is.null` +
    `&field_notes=not.is.null`
  const res = await fetch(url, { headers: supabaseHeaders() })
  if (!res.ok) throw new Error(`Supabase select failed (${res.status}): ${await res.text()}`)
  return (await res.json()) as SpeciesImageRow[]
}

async function fetchSeedMap(qrHashes: string[]): Promise<Map<string, number>> {
  // Pull-quote prompt's lead-directive rotation is keyed by dna.seed for
  // reproducibility — without the seed the rotation degrades to "always
  // directive 0". Joining via the creatures table keeps the backfill output
  // statistically comparable to the live worker output.
  if (qrHashes.length === 0) return new Map()
  const inList = qrHashes.map((h) => `"${h}"`).join(',')
  const url =
    `${env.SUPABASE_URL}/rest/v1/creatures` +
    `?select=qr_hash,dna` +
    `&qr_hash=in.(${inList})`
  const res = await fetch(url, { headers: supabaseHeaders() })
  if (!res.ok) throw new Error(`Supabase creatures select failed (${res.status}): ${await res.text()}`)
  const rows = (await res.json()) as CreatureRow[]
  const map = new Map<string, number>()
  for (const r of rows) {
    if (typeof r.dna?.seed === 'number') map.set(r.qr_hash, r.dna.seed)
  }
  return map
}

async function updatePullQuote(qrHash: string, pullQuote: string): Promise<void> {
  const url = `${env.SUPABASE_URL}/rest/v1/species_images?qr_hash=eq.${encodeURIComponent(qrHash)}`
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { ...supabaseHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify({ pull_quote: pullQuote }),
  })
  if (!res.ok) throw new Error(`Supabase PATCH failed (${res.status}): ${await res.text()}`)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function main(): Promise<void> {
  console.log(`[backfill-pull-quotes] mode=${DRY_RUN ? 'DRY_RUN' : 'WRITE'}`)

  const rows = await selectRowsNeedingBackfill()
  console.log(`[backfill-pull-quotes] found ${rows.length} row(s) needing pull-quote`)

  if (rows.length === 0) {
    console.log('[backfill-pull-quotes] nothing to do')
    return
  }

  const seedMap = await fetchSeedMap(rows.map((r) => r.qr_hash))
  console.log(`[backfill-pull-quotes] resolved seeds for ${seedMap.size}/${rows.length} row(s)`)

  if (DRY_RUN) {
    rows.forEach((r) => {
      const seed = seedMap.get(r.qr_hash)
      console.log(`  - ${r.qr_hash} (seed=${seed ?? 'unknown'}) :: ${r.field_notes.slice(0, 60)}…`)
    })
    return
  }

  let ok = 0
  let fail = 0
  for (const row of rows) {
    const seed = seedMap.get(row.qr_hash) ?? 0
    process.stdout.write(`  [..] ${row.qr_hash} `)
    try {
      const prompt = buildPullQuotePrompt(row.field_notes, seed)
      const pullQuote = await generatePullQuote(prompt, env.ANTHROPIC_API_KEY)
      await updatePullQuote(row.qr_hash, pullQuote)
      console.log(`✓ ${pullQuote.slice(0, 80)}`)
      ok++
    } catch (err) {
      console.log(`✗ ${(err as Error).message}`)
      fail++
    }
    await sleep(SLEEP_MS)
  }

  console.log(`[backfill-pull-quotes] done — ${ok} succeeded, ${fail} failed`)
  if (fail > 0) process.exit(1)
}

main().catch((err) => {
  console.error('[backfill-pull-quotes] fatal:', err)
  process.exit(1)
})
