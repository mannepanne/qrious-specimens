// ABOUT: One-off backfill — generates illustration + field notes for creatures missing a species_images row
// ABOUT: Uses service role key directly; bypasses the worker's JWT path. Idempotent on re-run.

/**
 * Why this exists: between 2026-04-08 and the JWT fix in PR #47, every fresh QR scan
 * resulted in a worker 401 (HS256 vs ES256 mismatch). The frontend silently fell back
 * to the SVG sketch — so creatures got rows but species_images did not. This script
 * generates the missing species_images entries for those creatures.
 *
 * Required environment variables:
 *   SUPABASE_URL                  e.g. https://tdegawvgtrpvtiqwaoxx.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY     Service role key (RLS bypass)
 *   GEMINI_API_KEY                Google Gemini API key
 *   ANTHROPIC_API_KEY             Anthropic API key
 *   CF_ACCOUNT_ID                 Cloudflare account ID
 *   CF_IMAGES_TOKEN               CF API token with Images:Edit permission
 *   CF_IMAGES_DELIVERY_HASH       Delivery hash for imagedelivery.net URLs
 *
 * Run:
 *   env $(cat .env.backfill) bun run scripts/backfill-broken-specimens.ts
 *
 * Dry run (lists rows without generating):
 *   DRY_RUN=1 env $(cat .env.backfill) bun run scripts/backfill-broken-specimens.ts
 */

import type { CreatureDNA } from '@/types/creature'
import { generateIllustration } from '../workers/generate-creature/gemini'
import { generateFieldNotes } from '../workers/generate-creature/claude'
import { buildGeminiPrompt, buildClaudePrompt } from '../workers/generate-creature/prompt'
import { uploadToCloudflareImages } from '../workers/cloudflare-images/index'

const env = {
  SUPABASE_URL: requireEnv('SUPABASE_URL'),
  SUPABASE_SERVICE_ROLE_KEY: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
  GEMINI_API_KEY: requireEnv('GEMINI_API_KEY'),
  ANTHROPIC_API_KEY: requireEnv('ANTHROPIC_API_KEY'),
  CF_ACCOUNT_ID: requireEnv('CF_ACCOUNT_ID'),
  CF_IMAGES_TOKEN: requireEnv('CF_IMAGES_TOKEN'),
  CF_IMAGES_DELIVERY_HASH: requireEnv('CF_IMAGES_DELIVERY_HASH'),
}

const DRY_RUN = process.env.DRY_RUN === '1'

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) {
    console.error(`Error: missing env var ${name}`)
    process.exit(1)
  }
  return v
}

interface BrokenCreature {
  id: string
  user_id: string
  qr_hash: string  // 16-char post-PR-#50
  dna: CreatureDNA
}

function supabaseHeaders(): Record<string, string> {
  return {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  }
}

/**
 * Find creatures whose qr_hash has no matching species_images row.
 * Uses the PostgREST embedded select with !inner+is.null trick:
 *   creatures?select=...,species_images!left(qr_hash)&species_images.qr_hash=is.null
 * Equivalent to LEFT JOIN ... WHERE species_images.qr_hash IS NULL.
 */
async function findBrokenCreatures(): Promise<BrokenCreature[]> {
  // Embedded resource needs an FK relationship in PostgREST. species_images and
  // creatures share `qr_hash` as a string but no FK is declared, so we do this
  // via two queries instead: list all species_images.qr_hash, then filter.
  const [creaturesRes, imagesRes] = await Promise.all([
    fetch(
      `${env.SUPABASE_URL}/rest/v1/creatures?select=id,user_id,qr_hash,dna`,
      { headers: supabaseHeaders() },
    ),
    fetch(
      `${env.SUPABASE_URL}/rest/v1/species_images?select=qr_hash`,
      { headers: supabaseHeaders() },
    ),
  ])
  if (!creaturesRes.ok) throw new Error(`creatures select failed (${creaturesRes.status})`)
  if (!imagesRes.ok) throw new Error(`species_images select failed (${imagesRes.status})`)

  const creatures = (await creaturesRes.json()) as BrokenCreature[]
  const imageHashes = new Set(
    ((await imagesRes.json()) as { qr_hash: string }[]).map((r) => r.qr_hash),
  )

  // Dedup by qr_hash — multiple users may scan the same QR; we only need one
  // generation pass per species. Keep the row whose user_id we'll attribute as
  // first_discoverer (oldest creature wins).
  const grouped = new Map<string, BrokenCreature>()
  for (const c of creatures) {
    if (imageHashes.has(c.qr_hash)) continue
    if (!grouped.has(c.qr_hash)) grouped.set(c.qr_hash, c)
  }
  return [...grouped.values()]
}

async function insertSpeciesImage(row: {
  qr_hash: string
  image_url: string
  image_url_512: string
  image_url_256: string
  field_notes: string
  prompt_used: string
  first_discoverer_id: string
  discovery_count: number
}): Promise<void> {
  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/species_images?on_conflict=qr_hash`,
    {
      method: 'POST',
      headers: { ...supabaseHeaders(), Prefer: 'return=minimal,resolution=ignore-duplicates' },
      body: JSON.stringify(row),
    },
  )
  if (!res.ok) {
    throw new Error(`species_images insert failed (${res.status}): ${await res.text()}`)
  }
}

async function callRegisterDiscovery(qrHash: string, userId: string): Promise<void> {
  // Triggers the same RPC the worker uses, so creatures.is_first_discoverer
  // gets set the same way it would in the live flow.
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/register_discovery`, {
    method: 'POST',
    headers: supabaseHeaders(),
    body: JSON.stringify({ p_qr_hash: qrHash, p_user_id: userId }),
  })
  if (!res.ok) {
    console.warn(`  register_discovery failed (${res.status}) — non-fatal`)
  }
}

async function processCreature(c: BrokenCreature): Promise<void> {
  const label = `${c.dna.genus} ${c.dna.species} (${c.qr_hash})`
  console.log(`→ ${label} ...`)
  if (DRY_RUN) {
    console.log(`  [DRY_RUN] skipping`)
    return
  }

  // Step 1: Gemini illustration
  const geminiPrompt = buildGeminiPrompt(c.dna)
  const { imageBase64, mimeType } = await generateIllustration(geminiPrompt, env.GEMINI_API_KEY)
  console.log(`  ✓ Gemini ${(imageBase64.length / 1024).toFixed(0)} KB`)

  // Step 2: CF Images upload
  const imageBytes = Uint8Array.from(atob(imageBase64), (ch) => ch.charCodeAt(0))
  const urls = await uploadToCloudflareImages(
    env.CF_ACCOUNT_ID,
    env.CF_IMAGES_TOKEN,
    env.CF_IMAGES_DELIVERY_HASH,
    c.qr_hash,
    imageBytes,
    mimeType,
  )
  console.log(`  ✓ CF Images ${urls.url256}`)

  // Step 3: Claude field notes (multimodal — uses the freshly-generated image)
  let fieldNotes = ''
  try {
    fieldNotes = await generateFieldNotes(
      buildClaudePrompt(c.dna, true),
      env.ANTHROPIC_API_KEY,
      imageBase64,
      mimeType,
    )
    console.log(`  ✓ Claude ${fieldNotes.length} chars`)
  } catch (err) {
    console.warn(`  ⚠ Claude failed — continuing without notes: ${(err as Error).message}`)
  }

  // Step 4: insert species_images row
  await insertSpeciesImage({
    qr_hash: c.qr_hash,
    image_url: urls.original,
    image_url_512: urls.url512,
    image_url_256: urls.url256,
    field_notes: fieldNotes,
    prompt_used: geminiPrompt,
    first_discoverer_id: c.user_id,
    discovery_count: 1,
  })
  console.log(`  ✓ DB row inserted`)

  // Step 5: register discovery — sets creatures.is_first_discoverer via the RPC
  await callRegisterDiscovery(c.qr_hash, c.user_id)
  console.log(`  ✓ register_discovery`)
}

async function main(): Promise<void> {
  console.log(`Backfill broken specimens — ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)
  const broken = await findBrokenCreatures()
  console.log(`Found ${broken.length} unique species missing species_images rows.\n`)

  let ok = 0
  let fail = 0
  for (const c of broken) {
    try {
      await processCreature(c)
      ok++
    } catch (err) {
      fail++
      console.error(`  ✗ FAILED: ${(err as Error).message}\n`)
    }
  }

  console.log(`\nDone. ok=${ok} fail=${fail} total=${broken.length}`)
  if (fail > 0) process.exit(1)
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
