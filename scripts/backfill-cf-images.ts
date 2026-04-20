// ABOUT: One-off backfill — move species_images originals from R2 to Cloudflare Images
// ABOUT: Idempotent (uses qr_hash as CF Images custom ID); safe to re-run

// STATUS: Completed 2026-04-20 (18 rows migrated). Retained for audit/reference.
// Do not re-run without reviewing the SELECT filter on line "selectR2Rows" — the
// `image_url=not.like.*imagedelivery.net*` predicate is load-bearing for re-run safety.

/**
 * Required environment variables:
 *   SUPABASE_URL                  e.g. https://tdegawvgtrpvtiqwaoxx.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY     Service role key for Supabase (RLS bypass)
 *   CF_ACCOUNT_ID                 Cloudflare account ID
 *   CF_IMAGES_TOKEN               CF API token with Images:Edit permission
 *   CF_IMAGES_DELIVERY_HASH       Delivery hash for imagedelivery.net URLs
 *
 * Run (avoids persistent shell export of SUPABASE_SERVICE_ROLE_KEY):
 *   env $(cat .env.backfill) bun run scripts/backfill-cf-images.ts
 *
 * Dry run (inspect rows without writing):
 *   DRY_RUN=1 bun run scripts/backfill-cf-images.ts
 */

import { uploadToCloudflareImages } from '../workers/cloudflare-images/index'

type SpeciesImageRow = {
  qr_hash: string
  image_url: string | null
  image_url_512: string | null
  image_url_256: string | null
}

const env = {
  SUPABASE_URL: requireEnv('SUPABASE_URL'),
  SUPABASE_SERVICE_ROLE_KEY: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
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

async function selectR2Rows(): Promise<SpeciesImageRow[]> {
  // Rows where image_url is NOT on imagedelivery.net (i.e. still on R2).
  // This predicate is load-bearing for re-run safety — don't change it without
  // thinking through idempotency.
  const url =
    `${env.SUPABASE_URL}/rest/v1/species_images` +
    `?select=qr_hash,image_url,image_url_512,image_url_256` +
    `&image_url=not.like.*imagedelivery.net*`
  const res = await fetch(url, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  })
  if (!res.ok) throw new Error(`Supabase select failed (${res.status}): ${await res.text()}`)
  return (await res.json()) as SpeciesImageRow[]
}

async function fetchOriginal(url: string): Promise<{ bytes: Uint8Array; mimeType: string }> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Fetch ${url} failed (${res.status})`)
  const mimeType = res.headers.get('content-type') ?? 'image/png'
  const buf = await res.arrayBuffer()
  return { bytes: new Uint8Array(buf), mimeType }
}

async function updateRow(
  qrHash: string,
  urls: { original: string; url512: string; url256: string },
): Promise<void> {
  const url = `${env.SUPABASE_URL}/rest/v1/species_images?qr_hash=eq.${encodeURIComponent(qrHash)}`
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      image_url: urls.original,
      image_url_512: urls.url512,
      image_url_256: urls.url256,
    }),
  })
  if (!res.ok) throw new Error(`Supabase PATCH failed (${res.status}): ${await res.text()}`)
}

async function main() {
  console.log(`[backfill] mode=${DRY_RUN ? 'DRY_RUN' : 'WRITE'}`)

  const rows = await selectR2Rows()
  console.log(`[backfill] found ${rows.length} species_images row(s) still on R2`)

  if (DRY_RUN) {
    rows.forEach((r) => console.log(`  - ${r.qr_hash} :: ${r.image_url}`))
    return
  }

  let ok = 0
  let fail = 0
  for (const row of rows) {
    if (!row.image_url) {
      console.warn(`  [skip] ${row.qr_hash} has no image_url`)
      continue
    }
    try {
      process.stdout.write(`  [..] ${row.qr_hash} `)
      const { bytes, mimeType } = await fetchOriginal(row.image_url)
      const urls = await uploadToCloudflareImages(
        env.CF_ACCOUNT_ID,
        env.CF_IMAGES_TOKEN,
        env.CF_IMAGES_DELIVERY_HASH,
        row.qr_hash,
        bytes,
        mimeType,
      )
      await updateRow(row.qr_hash, urls)
      console.log(`-> ${urls.original}`)
      ok++
    } catch (err) {
      console.error(`FAIL: ${(err as Error).message}`)
      fail++
    }
  }

  console.log(`[backfill] done. ok=${ok} fail=${fail}`)
  if (fail > 0) process.exit(1)
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
