// ABOUT: Cloudflare Worker handler — generates Victorian naturalist illustrations via Gemini + Claude
// ABOUT: Verifies Supabase JWT, checks species_images cache, uploads to Cloudflare Images, calls register_discovery RPC

/// <reference types="@cloudflare/workers-types" />

import type { CreatureDNA } from '@/types/creature'
import { buildGeminiPrompt, buildClaudePrompt } from './prompt'
import { generateIllustration } from './gemini'
import { generateFieldNotes } from './claude'
import { uploadToCloudflareImages } from '../cloudflare-images/index'
import { verifyJWT, JwksUnavailableError, __resetJwksCache } from '../shared/jwt'
import { enforceRateLimit } from '../shared/rateLimit'
import type { Env } from '../shared/env'

export { JwksUnavailableError, __resetJwksCache }
export type { Env } from '../shared/env'

interface SpeciesImageRow {
  image_url: string
  image_url_512: string | null
  image_url_256: string | null
  field_notes: string | null
  discovery_count: number | null
  first_discoverer_id: string | null
}

/** Shape of one row returned by the `register_discovery` Postgres function. */
interface RegisterDiscoveryRow {
  is_first: boolean
  total_count: number
  scan_count: number
}

interface RegisterDiscoveryResult {
  is_first_discoverer: boolean
  discovery_count: number
}

// ── Supabase REST helpers ───────────────────────────────────────────────────

function supabaseHeaders(serviceKey: string): Record<string, string> {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  }
}

async function getSpeciesImage(
  supabaseUrl: string,
  serviceKey: string,
  qrHash: string,
): Promise<SpeciesImageRow | null> {
  const url = `${supabaseUrl}/rest/v1/species_images?qr_hash=eq.${encodeURIComponent(qrHash)}&select=image_url,image_url_512,image_url_256,field_notes,discovery_count,first_discoverer_id&limit=1`
  const res = await fetch(url, { headers: supabaseHeaders(serviceKey) })
  if (!res.ok) return null
  const rows = (await res.json()) as SpeciesImageRow[]
  return rows[0] ?? null
}

async function insertSpeciesImage(
  supabaseUrl: string,
  serviceKey: string,
  row: {
    qr_hash: string
    image_url: string
    image_url_512: string
    image_url_256: string
    field_notes: string
    prompt_used: string
    first_discoverer_id: string
    discovery_count: number
  },
): Promise<void> {
  // Upsert with ignore-duplicates: if a concurrent request already inserted the row,
  // this becomes a no-op (preserving the first discoverer's data). Concurrent uploads
  // to Cloudflare Images collapse on the shared `qr_hash` custom ID, so there are no
  // orphan objects from the losing race (see ADR 2026-04-20).
  const res = await fetch(`${supabaseUrl}/rest/v1/species_images?on_conflict=qr_hash`, {
    method: 'POST',
    headers: { ...supabaseHeaders(serviceKey), Prefer: 'return=minimal,resolution=ignore-duplicates' },
    body: JSON.stringify(row),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Failed to insert species_images: ${res.status} ${body}`)
  }
}

async function callRegisterDiscovery(
  supabaseUrl: string,
  serviceKey: string,
  qrHash: string,
  userId: string,
): Promise<RegisterDiscoveryResult> {
  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/register_discovery`, {
    method: 'POST',
    headers: supabaseHeaders(serviceKey),
    body: JSON.stringify({ p_qr_hash: qrHash, p_user_id: userId }),
  })
  if (!res.ok) {
    // RPC failure is non-fatal — discovery data is best-effort
    return { is_first_discoverer: false, discovery_count: 1 }
  }
  // PostgREST returns RETURNS TABLE results as an array of rows. Earlier code
  // treated this as a single object with `is_first_discoverer`/`discovery_count`
  // keys — those keys never existed, so every caller silently received the
  // fallback `{ is_first_discoverer: false }`. Correct shape: array of rows
  // with `is_first` / `total_count` / `scan_count` columns.
  const rows = (await res.json()) as RegisterDiscoveryRow[] | null
  const row = rows?.[0]
  if (!row) return { is_first_discoverer: false, discovery_count: 1 }
  return { is_first_discoverer: row.is_first, discovery_count: row.total_count }
}

// ── CORS helpers ────────────────────────────────────────────────────────────

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = ['https://qrious.hultberg.org', 'http://localhost:5173']
  const allowedOrigin = origin && allowed.includes(origin) ? origin : allowed[0]
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }
}

function json(body: unknown, status = 200, origin: string | null = null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
  })
}

// ── Main handler ────────────────────────────────────────────────────────────

export async function handleGenerateCreature(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin')

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) })
  }

  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405, origin)
  }

  // Step 1: Verify JWT
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ error: 'Missing or malformed Authorization header' }, 401, origin)
  }
  const token = authHeader.slice(7)

  let userId: string
  try {
    const payload = await verifyJWT(token, env)
    userId = payload.sub
  } catch (err) {
    // Correlation ID lets support trace a user-facing 401/503 back to the
    // server-side log line without leaking internal verification detail to
    // the client. Detail stays in Worker logs only.
    const correlationId = crypto.randomUUID()
    if (err instanceof JwksUnavailableError) {
      console.error(`[${correlationId}] JWKS unavailable: ${err.message}`)
      return json({ error: 'Auth provider unavailable', correlationId }, 503, origin)
    }
    console.error(`[${correlationId}] JWT verification failed: ${(err as Error).message}`)
    return json({ error: 'Invalid token', correlationId }, 401, origin)
  }

  // Step 1.5: Rate limit per authenticated user, then enforce a global backstop.
  // Per-user cap (5/min) covers the dominant abuse case — a single stolen token —
  // while the global cap (100/min, constant key) bounds Sybil amplification when
  // an attacker spreads load across many accounts. Both run before the cache
  // check so total request volume is bounded, not just novel-hash generations.
  // The cors object the helper needs is already built above.
  const cors = corsHeaders(origin)
  const userRateLimited = await enforceRateLimit(
    env.GENERATE_CREATURE_RATE_LIMITER,
    userId,
    'rate_limit_generate_user',
    cors,
  )
  if (userRateLimited) return userRateLimited

  const globalRateLimited = await enforceRateLimit(
    env.GENERATE_CREATURE_GLOBAL_RATE_LIMITER,
    'global',
    'rate_limit_generate_global',
    cors,
  )
  if (globalRateLimited) return globalRateLimited

  // Step 2: Parse body
  let qrHash: string
  let dna: CreatureDNA
  try {
    const body = (await request.json()) as { qrHash?: string; dna?: CreatureDNA }
    if (!body.qrHash || !body.dna) {
      return json({ error: 'Missing qrHash or dna in request body' }, 400, origin)
    }
    qrHash = body.qrHash
    dna = body.dna
  } catch {
    return json({ error: 'Invalid JSON body' }, 400, origin)
  }

  if (!/^[0-9a-f]{16}$/.test(qrHash)) {
    return json({ error: 'Invalid qrHash format' }, 400, origin)
  }

  // Step 3: Check species_images cache
  const existing = await getSpeciesImage(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, qrHash)
  if (existing?.image_url) {
    const discoveryResult = await callRegisterDiscovery(
      env.SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
      qrHash,
      userId,
    )
    return json(
      {
        imageUrl: existing.image_url,
        imageUrl512: existing.image_url_512 ?? existing.image_url,
        imageUrl256: existing.image_url_256 ?? existing.image_url,
        fieldNotes: existing.field_notes ?? '',
        isFirstDiscoverer: discoveryResult.is_first_discoverer,
        discoveryCount: discoveryResult.discovery_count,
        cached: true,
      },
      200,
      origin,
    )
  }

  // Step 4: Generate illustration via Gemini
  const geminiPrompt = buildGeminiPrompt(dna)
  let imageBase64: string
  let imageMimeType: string
  try {
    const result = await generateIllustration(geminiPrompt, env.GEMINI_API_KEY)
    imageBase64 = result.imageBase64
    imageMimeType = result.mimeType
  } catch (err) {
    return json({ error: 'Illustration generation failed', detail: (err as Error).message }, 500, origin)
  }

  // Step 5: Upload to Cloudflare Images (single upload; CDN serves named variants
  // "qriousoriginal", "qrious512", "qrious256" configured in the CF Images dashboard)
  const imageBytes = Uint8Array.from(atob(imageBase64), (c) => c.charCodeAt(0))
  let imageUrls: { original: string; url512: string; url256: string }
  try {
    imageUrls = await uploadToCloudflareImages(
      env.CF_ACCOUNT_ID,
      env.CF_IMAGES_TOKEN,
      env.CF_IMAGES_DELIVERY_HASH,
      qrHash,
      imageBytes,
      imageMimeType,
    )
  } catch (err) {
    return json({ error: 'Image upload failed', detail: (err as Error).message }, 500, origin)
  }

  // Step 6: Generate field notes via Claude Haiku (multimodal with the generated image)
  const claudePrompt = buildClaudePrompt(dna, true)
  let fieldNotes: string
  try {
    fieldNotes = await generateFieldNotes(claudePrompt, env.ANTHROPIC_API_KEY, imageBase64, imageMimeType)
  } catch (err) {
    // Field note failure is non-fatal — image is already uploaded
    fieldNotes = ''
    console.error('Field notes generation failed:', (err as Error).message)
  }

  // Step 7: Write to species_images table
  try {
    await insertSpeciesImage(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      qr_hash: qrHash,
      image_url: imageUrls.original,
      image_url_512: imageUrls.url512,
      image_url_256: imageUrls.url256,
      field_notes: fieldNotes,
      prompt_used: geminiPrompt,
      first_discoverer_id: userId,
      discovery_count: 1,
    })
  } catch (err) {
    // DB write failure is logged but we still return the result
    console.error('species_images insert failed:', (err as Error).message)
  }

  // Step 8: Call register_discovery RPC to set is_first_discoverer on creatures row
  const discoveryResult = await callRegisterDiscovery(
    env.SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    qrHash,
    userId,
  )

  return json(
    {
      imageUrl: imageUrls.original,
      imageUrl512: imageUrls.url512,
      imageUrl256: imageUrls.url256,
      fieldNotes,
      isFirstDiscoverer: discoveryResult.is_first_discoverer,
      discoveryCount: discoveryResult.discovery_count,
      cached: false,
    },
    200,
    origin,
  )
}
