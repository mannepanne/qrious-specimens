// ABOUT: Cloudflare Worker handler — generates Victorian naturalist illustrations via Gemini + Claude
// ABOUT: Verifies Supabase JWT, checks species_images cache, uploads to R2, calls register_discovery RPC

/// <reference types="@cloudflare/workers-types" />

import type { CreatureDNA } from '@/types/creature'
import { buildGeminiPrompt, buildClaudePrompt } from './prompt'
import { generateIllustration } from './gemini'
import { generateFieldNotes } from './claude'
import { uploadToR2 } from './r2'

export interface Env {
  IMAGES: R2Bucket
  SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY: string
  SUPABASE_JWT_SECRET: string
  GEMINI_API_KEY: string
  ANTHROPIC_API_KEY: string
  PUBLIC_R2_URL: string
}

interface SpeciesImageRow {
  image_url: string
  image_url_512: string | null
  image_url_256: string | null
  field_notes: string | null
  discovery_count: number | null
  first_discoverer_id: string | null
}

interface RegisterDiscoveryResult {
  is_first_discoverer: boolean
  discovery_count: number
}

// ── JWT verification ────────────────────────────────────────────────────────

/** Verify a Supabase HS256 JWT. Returns the payload or throws. */
async function verifyJWT(token: string, secret: string): Promise<{ sub: string }> {
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('Malformed JWT')

  const [headerB64, payloadB64, sigB64] = parts

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  )

  // Decode base64url → Uint8Array
  const sigBytes = Uint8Array.from(
    atob(sigB64.replace(/-/g, '+').replace(/_/g, '/')),
    (c) => c.charCodeAt(0),
  )

  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    sigBytes,
    new TextEncoder().encode(`${headerB64}.${payloadB64}`),
  )

  if (!valid) throw new Error('Invalid JWT signature')

  const payload = JSON.parse(
    atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')),
  ) as { sub?: string; exp?: number }

  if (!payload.sub) throw new Error('JWT missing sub claim')
  if (payload.exp && payload.exp * 1000 < Date.now()) throw new Error('JWT expired')

  return { sub: payload.sub }
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
  // this becomes a no-op (preserving the first discoverer's data). R2 objects uploaded
  // by the losing race are orphaned — tracked as TD-003 for a future cleanup job.
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
  const result = (await res.json()) as RegisterDiscoveryResult | null
  return result ?? { is_first_discoverer: false, discovery_count: 1 }
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
    const payload = await verifyJWT(token, env.SUPABASE_JWT_SECRET)
    userId = payload.sub
  } catch (err) {
    return json({ error: 'Invalid token', detail: (err as Error).message }, 401, origin)
  }

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

  // Step 5: Upload to R2 (original + 512px + 256px variants)
  const imageBytes = Uint8Array.from(atob(imageBase64), (c) => c.charCodeAt(0))
  let r2Urls: { original: string; url512: string; url256: string }
  try {
    r2Urls = await uploadToR2(env.IMAGES, env.PUBLIC_R2_URL, qrHash, imageBytes, imageMimeType)
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
      image_url: r2Urls.original,
      image_url_512: r2Urls.url512,
      image_url_256: r2Urls.url256,
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
      imageUrl: r2Urls.original,
      imageUrl512: r2Urls.url512,
      imageUrl256: r2Urls.url256,
      fieldNotes,
      isFirstDiscoverer: discoveryResult.is_first_discoverer,
      discoveryCount: discoveryResult.discovery_count,
      cached: false,
    },
    200,
    origin,
  )
}
