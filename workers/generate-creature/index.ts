// ABOUT: Cloudflare Worker handler — generates Victorian naturalist illustrations via Gemini + Claude
// ABOUT: Verifies Supabase JWT, checks species_images cache, uploads to Cloudflare Images, calls register_discovery RPC

/// <reference types="@cloudflare/workers-types" />

import type { CreatureDNA } from '@/types/creature'
import { buildGeminiPrompt, buildClaudePrompt } from './prompt'
import { generateIllustration } from './gemini'
import { generateFieldNotes } from './claude'
import { uploadToCloudflareImages } from '../cloudflare-images/index'

interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>
}

export interface Env {
  ASSETS: Fetcher
  SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY: string
  // Optional — only required for legacy HS256-signed projects. Modern Supabase
  // projects sign with asymmetric keys and are verified via the JWKS endpoint.
  SUPABASE_JWT_SECRET?: string
  GEMINI_API_KEY: string
  ANTHROPIC_API_KEY: string
  CF_ACCOUNT_ID: string
  CF_IMAGES_TOKEN: string
  CF_IMAGES_DELIVERY_HASH: string
  RESEND_API_KEY: string              // used by /api/contact handler
  CONTACT_RATE_LIMITER?: RateLimiter  // CF Rate Limiting binding — optional so local dev without it still works
}

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

// ── JWT verification ────────────────────────────────────────────────────────
//
// Supabase signs access tokens with one of two schemes:
//   1. Asymmetric (ES256/RS256) — current default. Public keys served from the
//      JWKS endpoint at {SUPABASE_URL}/auth/v1/.well-known/jwks.json.
//   2. HS256 (legacy) — older projects. Verified against SUPABASE_JWT_SECRET.
//
// The token's `alg` header selects the path. See
// REFERENCE/decisions/2026-04-20-jwks-jwt-verification.md for rationale.

interface JWKSKey {
  kid: string
  kty: string
  alg?: string
  crv?: string
  x?: string
  y?: string
  n?: string
  e?: string
  use?: string
}

/** Signals the JWKS endpoint or key-import pipeline failed — NOT an auth decision. Map to 503. */
export class JwksUnavailableError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message)
    this.name = 'JwksUnavailableError'
  }
}

// Module-level JWKS cache (per isolate). Keyed by SUPABASE_URL so multiple
// environments in the same deployment don't collide. The 10-minute TTL balances
// freshness against the cost of re-fetching on every cold request; an empty
// imported map uses a shorter negative TTL so a transient upstream hiccup
// doesn't silently fail every request for the full window.
const JWKS_TTL_MS = 10 * 60 * 1000
const JWKS_NEGATIVE_TTL_MS = 30 * 1000
const JWKS_FETCH_TIMEOUT_MS = 5000
const jwksCache = new Map<string, { keys: Map<string, CryptoKey>; expiresAt: number }>()

// Exposed for tests — lets each test start with an empty cache.
export function __resetJwksCache(): void {
  jwksCache.clear()
}

function base64UrlDecode(s: string): Uint8Array<ArrayBuffer> {
  const binary = atob(s.replace(/-/g, '+').replace(/_/g, '/'))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function importJwk(k: JWKSKey): Promise<CryptoKey | null> {
  if (k.kty === 'EC' && k.crv === 'P-256') {
    return crypto.subtle.importKey(
      'jwk',
      k as JsonWebKey,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify'],
    )
  }
  if (k.kty === 'RSA') {
    return crypto.subtle.importKey(
      'jwk',
      k as JsonWebKey,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    )
  }
  return null
}

/**
 * Fetch the JWKS for a Supabase URL, with in-memory caching.
 *
 * Throws `JwksUnavailableError` when the endpoint is unreachable, times out,
 * returns non-2xx, or yields unparseable JSON — these are upstream failures,
 * not auth decisions. Successful empty/small responses are cached briefly
 * (NEGATIVE_TTL) so the next request attempts a refresh rather than failing
 * silently for the full TTL window.
 */
async function fetchJwks(supabaseUrl: string, force = false): Promise<Map<string, CryptoKey>> {
  const cached = jwksCache.get(supabaseUrl)
  if (!force && cached && cached.expiresAt > Date.now()) return cached.keys

  let res: Response
  try {
    res = await fetch(`${supabaseUrl}/auth/v1/.well-known/jwks.json`, {
      signal: AbortSignal.timeout(JWKS_FETCH_TIMEOUT_MS),
    })
  } catch (err) {
    throw new JwksUnavailableError(`JWKS fetch failed: ${(err as Error).message}`, err)
  }
  if (!res.ok) {
    throw new JwksUnavailableError(`JWKS fetch returned ${res.status}`)
  }

  let body: { keys?: JWKSKey[] }
  try {
    body = (await res.json()) as { keys?: JWKSKey[] }
  } catch (err) {
    throw new JwksUnavailableError(`JWKS body parse failed: ${(err as Error).message}`, err)
  }

  const imported = new Map<string, CryptoKey>()
  for (const k of body.keys ?? []) {
    try {
      const key = await importJwk(k)
      if (key) imported.set(k.kid, key)
      else console.warn(`JWKS: skipping unsupported key type kty=${k.kty} crv=${k.crv ?? ''} kid=${k.kid}`)
    } catch (err) {
      console.warn(`JWKS: failed to import kid=${k.kid}: ${(err as Error).message}`)
    }
  }
  // Negative TTL when the imported map is empty — avoids silently serving 401s
  // for the full window if Supabase transiently ships an unimportable JWKS.
  const ttl = imported.size === 0 ? JWKS_NEGATIVE_TTL_MS : JWKS_TTL_MS
  jwksCache.set(supabaseUrl, { keys: imported, expiresAt: Date.now() + ttl })
  return imported
}

interface VerifyEnv {
  SUPABASE_URL: string
  SUPABASE_JWT_SECRET?: string
}

/**
 * Verify a Supabase JWT (HS256 legacy or ES256/RS256 via JWKS).
 *
 * Returns payload on success. Throws on any verification failure — the outer
 * handler classifies exceptions: `JwksUnavailableError` → 503, all other
 * throws → 401.
 */
async function verifyJWT(token: string, env: VerifyEnv): Promise<{ sub: string }> {
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('Malformed JWT')
  const [headerB64, payloadB64, sigB64] = parts

  const header = JSON.parse(new TextDecoder().decode(base64UrlDecode(headerB64))) as {
    alg?: string
    kid?: string
  }
  const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadB64))) as {
    sub?: string
    exp?: number
    iss?: string
  }

  if (!payload.sub) throw new Error('JWT missing sub claim')
  if (typeof payload.exp !== 'number') throw new Error('JWT missing exp claim')
  if (payload.exp * 1000 < Date.now()) throw new Error('JWT expired')

  // Supabase Auth issues tokens with iss = {SUPABASE_URL}/auth/v1. Enforcing
  // matches defence-in-depth best practice and rejects tokens accidentally
  // issued by another project even if a kid collision occurred.
  const expectedIss = `${env.SUPABASE_URL}/auth/v1`
  if (payload.iss !== expectedIss) {
    throw new Error(`JWT iss mismatch: expected ${expectedIss}, got ${payload.iss ?? '(none)'}`)
  }

  const sigBytes = base64UrlDecode(sigB64)
  const signingInput = new TextEncoder().encode(`${headerB64}.${payloadB64}`)

  if (header.alg === 'HS256') {
    if (!env.SUPABASE_JWT_SECRET) {
      throw new Error('HS256 token received but SUPABASE_JWT_SECRET is not configured')
    }
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(env.SUPABASE_JWT_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    )
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, signingInput)
    if (!valid) throw new Error('Invalid HS256 signature')
    return { sub: payload.sub }
  }

  if (header.alg === 'ES256' || header.alg === 'RS256') {
    if (!header.kid) throw new Error(`${header.alg} JWT missing kid`)
    const algorithm: AlgorithmIdentifier | EcdsaParams =
      header.alg === 'ES256'
        ? { name: 'ECDSA', hash: 'SHA-256' }
        : { name: 'RSASSA-PKCS1-v1_5' }

    // First attempt uses the cache. If the kid isn't known, refetch once
    // (bypassing cache) — this covers Supabase signing-key rotation, where a
    // fresh token references a kid newer than our cached JWKS.
    let keys = await fetchJwks(env.SUPABASE_URL)
    let pubKey = keys.get(header.kid)
    if (!pubKey) {
      keys = await fetchJwks(env.SUPABASE_URL, true)
      pubKey = keys.get(header.kid)
    }
    if (!pubKey) throw new Error(`No JWKS key matching kid=${header.kid}`)

    const valid = await crypto.subtle.verify(algorithm, pubKey, sigBytes, signingInput)
    if (!valid) throw new Error(`Invalid ${header.alg} signature`)
    return { sub: payload.sub }
  }

  throw new Error(`Unsupported JWT alg: ${header.alg ?? '(none)'}`)
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
