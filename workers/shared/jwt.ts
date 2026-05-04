// ABOUT: Supabase JWT verification helpers shared across Cloudflare Workers
// ABOUT: Per-isolate JWKS cache + kid-miss refetch; HS256 fallback for legacy projects (ADR 2026-04-20)

/// <reference types="@cloudflare/workers-types" />

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

const JWKS_TTL_MS = 10 * 60 * 1000
const JWKS_NEGATIVE_TTL_MS = 30 * 1000
const JWKS_FETCH_TIMEOUT_MS = 5000
const jwksCache = new Map<string, { keys: Map<string, CryptoKey>; expiresAt: number }>()

/** Reset the per-isolate JWKS cache. Exposed for tests. */
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
  const ttl = imported.size === 0 ? JWKS_NEGATIVE_TTL_MS : JWKS_TTL_MS
  jwksCache.set(supabaseUrl, { keys: imported, expiresAt: Date.now() + ttl })
  return imported
}

export interface VerifyEnv {
  SUPABASE_URL: string
  SUPABASE_JWT_SECRET?: string
}

/**
 * Verify a Supabase JWT (HS256 legacy or ES256/RS256 via JWKS).
 *
 * Returns payload on success. Throws on any verification failure — callers
 * classify exceptions: `JwksUnavailableError` → 503, all other throws → 401.
 *
 * Postcondition: a successful return guarantees a non-empty `sub` (the
 * function rejects payloads without one before any signature work). Callers
 * can therefore use `payload.sub` directly as a rate-limit key without a
 * defensive null check.
 */
export async function verifyJWT(token: string, env: VerifyEnv): Promise<{ sub: string }> {
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
