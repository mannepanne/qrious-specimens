// ABOUT: Cloudflare Worker handler — generates Victorian naturalist illustrations via Gemini + Claude
// ABOUT: Verifies Supabase JWT, checks species_images cache, uploads to Cloudflare Images, calls register_discovery RPC

/// <reference types="@cloudflare/workers-types" />

import type { CreatureDNA } from '@/types/creature'
import {
  buildGeminiPrompt,
  buildClaudePrompt,
  buildPullQuotePrompt,
  buildTierChangeBodyPrompt,
} from './prompt'
import { generateIllustration } from './gemini'
import { generateFieldNotes, generatePullQuote, generateTierChangeBody } from './claude'
import { uploadToCloudflareImages } from '../cloudflare-images/index'
import { verifyJWT, JwksUnavailableError, __resetJwksCache } from '../shared/jwt'
import { enforceRateLimit } from '../shared/rateLimit'
import { corsHeaders } from '../shared/cors'
import type { Env } from '../shared/env'

export { JwksUnavailableError, __resetJwksCache }
export type { Env } from '../shared/env'

interface SpeciesImageRow {
  image_url: string
  image_url_512: string | null
  image_url_256: string | null
  field_notes: string | null
  pull_quote: string | null
  discovery_count: number | null
  first_discoverer_id: string | null
}

/**
 * Shape of one row returned by the `register_discovery` Postgres function
 * (post-rarity-and-census). The tier-change columns let the worker issue a
 * follow-up Anthropic call and UPDATE the freshly inserted activity_feed row
 * keyed by `tier_change_event_id`, with no race window.
 */
interface RegisterDiscoveryRow {
  is_first_discoverer: boolean
  tier_changed: boolean
  old_tier: 'extraordinary' | 'notable' | 'common' | null
  new_tier: 'extraordinary' | 'notable' | 'common'
  new_discovery_count: number
  tier_change_event_id: string | null
}

interface RegisterDiscoveryResult {
  is_first_discoverer: boolean
  discovery_count: number
  tier_changed: boolean
  old_tier: 'extraordinary' | 'notable' | 'common' | null
  new_tier: 'extraordinary' | 'notable' | 'common' | null
  tier_change_event_id: string | null
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
  const url = `${supabaseUrl}/rest/v1/species_images?qr_hash=eq.${encodeURIComponent(qrHash)}&select=image_url,image_url_512,image_url_256,field_notes,pull_quote,discovery_count,first_discoverer_id&limit=1`
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
    pull_quote: string | null
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
  const fallback: RegisterDiscoveryResult = {
    is_first_discoverer: false,
    discovery_count: 1,
    tier_changed: false,
    old_tier: null,
    new_tier: null,
    tier_change_event_id: null,
  }
  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/register_discovery`, {
    method: 'POST',
    headers: supabaseHeaders(serviceKey),
    body: JSON.stringify({ p_qr_hash: qrHash, p_user_id: userId }),
  })
  // RPC failure is non-fatal — discovery data is best-effort. The fallback
  // skips the tier-change pipeline (tier_changed = false).
  if (!res.ok) return fallback
  const rows = (await res.json()) as RegisterDiscoveryRow[] | null
  const row = rows?.[0]
  if (!row) return fallback
  return {
    is_first_discoverer: row.is_first_discoverer,
    discovery_count: row.new_discovery_count,
    tier_changed: row.tier_changed,
    old_tier: row.old_tier,
    new_tier: row.new_tier,
    tier_change_event_id: row.tier_change_event_id,
  }
}

/**
 * Issue the Anthropic call for tier_change_body and PATCH the just-inserted
 * activity_feed row. Soft-fail: any error leaves the row's `tier_change_body`
 * NULL, and `TierChangeDispatch` falls back to a hand-written template.
 * Called from both the cache-hit and uncache paths after `register_discovery`.
 */
async function maybeWriteTierChangeBody(
  env: Env,
  discovery: RegisterDiscoveryResult,
  dna: CreatureDNA,
): Promise<void> {
  if (
    !discovery.tier_changed ||
    !discovery.tier_change_event_id ||
    !discovery.old_tier ||
    !discovery.new_tier
  ) {
    return
  }

  const binomial = `${dna.genus} ${dna.species}`
  let body: string
  try {
    body = await generateTierChangeBody(
      buildTierChangeBodyPrompt({
        binomial,
        oldTier: discovery.old_tier,
        newTier: discovery.new_tier,
        newDiscoveryCount: discovery.discovery_count,
      }),
      env.ANTHROPIC_API_KEY,
    )
  } catch (err) {
    console.error('Tier-change body generation failed:', (err as Error).message)
    return
  }

  try {
    const res = await fetch(
      `${env.SUPABASE_URL}/rest/v1/activity_feed?id=eq.${encodeURIComponent(discovery.tier_change_event_id)}`,
      {
        method: 'PATCH',
        headers: { ...supabaseHeaders(env.SUPABASE_SERVICE_ROLE_KEY), Prefer: 'return=minimal' },
        body: JSON.stringify({ tier_change_body: body }),
      },
    )
    if (!res.ok) {
      console.error(`Tier-change body PATCH failed: ${res.status} ${(await res.text()).slice(0, 200)}`)
    }
  } catch (err) {
    console.error('Tier-change body PATCH threw:', (err as Error).message)
  }
}

// ── Main handler ────────────────────────────────────────────────────────────

export async function handleGenerateCreature(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin')
  const cors = corsHeaders(origin, env)
  const json = (body: unknown, status = 200): Response =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors })
  }

  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  // Step 1: Verify JWT
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ error: 'Missing or malformed Authorization header' }, 401)
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
      return json({ error: 'Auth provider unavailable', correlationId }, 503)
    }
    console.error(`[${correlationId}] JWT verification failed: ${(err as Error).message}`)
    return json({ error: 'Invalid token', correlationId }, 401)
  }

  // Step 1.5: Rate limit per authenticated user, then enforce a global backstop.
  // Per-user cap (5/min) covers the dominant abuse case — a single stolen token —
  // while the global cap (100/min, constant key) bounds Sybil amplification when
  // an attacker spreads load across many accounts. Both run before the cache
  // check so total request volume is bounded, not just novel-hash generations.
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
      return json({ error: 'Missing qrHash or dna in request body' }, 400)
    }
    qrHash = body.qrHash
    dna = body.dna
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  if (!/^[0-9a-f]{16}$/.test(qrHash)) {
    return json({ error: 'Invalid qrHash format' }, 400)
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
    // Tier-change body generation runs on the cache-hit path too — the
    // species_images row may be cached, but the discovery itself can still
    // cross a tier boundary (e.g. fourth distinct explorer of an existing
    // Extraordinary species).
    await maybeWriteTierChangeBody(env, discoveryResult, dna)
    return json(
      {
        imageUrl: existing.image_url,
        imageUrl512: existing.image_url_512 ?? existing.image_url,
        imageUrl256: existing.image_url_256 ?? existing.image_url,
        fieldNotes: existing.field_notes ?? '',
        pullQuote: existing.pull_quote,
        isFirstDiscoverer: discoveryResult.is_first_discoverer,
        discoveryCount: discoveryResult.discovery_count,
        cached: true,
      },
      200,
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
    return json({ error: 'Illustration generation failed', detail: (err as Error).message }, 500)
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
    return json({ error: 'Image upload failed', detail: (err as Error).message }, 500)
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

  // Step 6b: Distil pull-quote from field notes (text-only, sequential, soft-fail).
  // Discovery never blocks on this step — null pull_quote falls back to a
  // render-time excerpt (excerptFromFieldNotes) on the Gazette feed.
  let pullQuote: string | null = null
  if (fieldNotes) {
    try {
      pullQuote = await generatePullQuote(buildPullQuotePrompt(fieldNotes, dna.seed), env.ANTHROPIC_API_KEY)
    } catch (err) {
      console.error('Pull-quote generation failed:', (err as Error).message)
    }
  }

  // Step 7: Write to species_images table
  try {
    await insertSpeciesImage(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      qr_hash: qrHash,
      image_url: imageUrls.original,
      image_url_512: imageUrls.url512,
      image_url_256: imageUrls.url256,
      field_notes: fieldNotes,
      pull_quote: pullQuote,
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

  // Step 9: If the RPC reported a tier crossing, fill in the new activity_feed
  // row's tier_change_body via Anthropic. Soft-fail — null bodies render via
  // TierChangeDispatch's hand-written fallback.
  await maybeWriteTierChangeBody(env, discoveryResult, dna)

  return json(
    {
      imageUrl: imageUrls.original,
      imageUrl512: imageUrls.url512,
      imageUrl256: imageUrls.url256,
      fieldNotes,
      pullQuote,
      isFirstDiscoverer: discoveryResult.is_first_discoverer,
      discoveryCount: discoveryResult.discovery_count,
      cached: false,
    },
    200,
  )
}
