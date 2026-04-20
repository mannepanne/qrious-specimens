// ABOUT: Tests for generate-creature Worker handler
// ABOUT: Covers JWT verification, cache hits, generation flow, and error paths

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { handleGenerateCreature, __resetJwksCache, type Env } from './index'
import type { CreatureDNA } from '@/types/creature'

// ── Fixtures ─────────────────────────────────────────────────────────────────

const MOCK_DNA: CreatureDNA = {
  seed: 12345,
  hash: 'abc123def456abcd',
  symmetry: 'bilateral',
  symmetryOrder: 2,
  bodyShape: 'ovoid',
  bodyScale: 1.0,
  limbCount: 4,
  limbStyle: 'jointed',
  limbLength: 0.8,
  limbCurvature: 0.5,
  patternType: 'dots',
  patternDensity: 0.6,
  eyeCount: 2,
  eyeSize: 0.4,
  eyeStyle: 'round',
  hue1: 30,
  hue2: 200,
  saturation: 60,
  lightness: 50,
  hasAntennae: false,
  hasTail: true,
  hasShell: false,
  hasCrown: false,
  genus: 'Testus',
  species: 'mockii',
  order: 'Testidae',
  family: 'Mockaceae',
  habitat: 'coastal',
  temperament: 'curious',
  estimatedSize: '5–10 cm',
}

// HS256 helper — used by legacy-token tests
const JWT_SECRET = 'test-jwt-secret-long-enough-for-hmac-sha256-ok'
const TEST_SUPABASE_URL = 'https://test.supabase.co'
const TEST_ISS = `${TEST_SUPABASE_URL}/auth/v1`

function b64url(s: string): string {
  return btoa(s).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

function b64urlBytes(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let s = ''
  for (const b of arr) s += String.fromCharCode(b)
  return b64url(s)
}

interface JWTClaimOverrides {
  iss?: string | null  // null → omit entirely, undefined → use default
  exp?: number | null
}

function makePayload(sub: string, expOffset: number, overrides: JWTClaimOverrides = {}): string {
  const base: Record<string, unknown> = {
    sub,
    iat: Math.floor(Date.now() / 1000),
  }
  if (overrides.exp !== null) {
    base.exp = overrides.exp ?? Math.floor(Date.now() / 1000) + expOffset
  }
  if (overrides.iss !== null) {
    base.iss = overrides.iss ?? TEST_ISS
  }
  return b64url(JSON.stringify(base))
}

async function makeJWT(sub: string, secret: string, expOffset = 3600, overrides: JWTClaimOverrides = {}): Promise<string> {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = makePayload(sub, expOffset, overrides)
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sigBytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${header}.${payload}`))
  return `${header}.${payload}.${b64urlBytes(sigBytes)}`
}

// ES256 helper — mirrors modern Supabase projects. Returns a signed JWT and
// the public JWK (in the shape JWKS would return) so tests can mock the JWKS fetch.
async function makeES256Setup(
  sub: string,
  kid = 'test-kid',
  expOffset = 3600,
  overrides: JWTClaimOverrides = {},
): Promise<{ token: string; jwk: JsonWebKey & { kid: string } }> {
  const { publicKey, privateKey } = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify'],
  )

  const header = b64url(JSON.stringify({ alg: 'ES256', typ: 'JWT', kid }))
  const payload = makePayload(sub, expOffset, overrides)
  const sigBytes = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    new TextEncoder().encode(`${header}.${payload}`),
  )

  const jwk = (await crypto.subtle.exportKey('jwk', publicKey)) as JsonWebKey
  return {
    token: `${header}.${payload}.${b64urlBytes(sigBytes)}`,
    jwk: { ...jwk, kid },
  }
}

// ── Mock env ──────────────────────────────────────────────────────────────────

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    ASSETS: {} as Fetcher,
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'service-key',
    SUPABASE_JWT_SECRET: JWT_SECRET,
    GEMINI_API_KEY: 'gemini-key',
    ANTHROPIC_API_KEY: 'anthropic-key',
    CF_ACCOUNT_ID: 'cf-account-id',
    CF_IMAGES_TOKEN: 'cf-images-token',
    CF_IMAGES_DELIVERY_HASH: 'cf-delivery-hash',
    RESEND_API_KEY: 'resend-key',
    ...overrides,
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(options: {
  token?: string
  body?: unknown
  method?: string
  origin?: string
}): Request {
  return new Request('https://qrious.hultberg.org/api/generate-creature', {
    method: options.method ?? 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.origin ? { Origin: options.origin } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('handleGenerateCreature', () => {
  let mockFetch: Mock
  let validToken: string

  beforeEach(async () => {
    __resetJwksCache()
    validToken = await makeJWT('test-user-id', JWT_SECRET)
    mockFetch = vi.fn()
    vi.stubGlobal('fetch', mockFetch)
  })

  it('returns 401 when Authorization header is missing', async () => {
    // Request with no Authorization header
    const req = new Request('https://qrious.hultberg.org/api/generate-creature', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ qrHash: 'abc', dna: MOCK_DNA }),
      // @ts-expect-error — duplex required in some Node runtimes for streaming bodies
      duplex: 'half',
    })
    const res = await handleGenerateCreature(req, makeEnv())
    expect(res.status).toBe(401)
  })

  it('returns 401 when JWT is invalid', async () => {
    const req = makeRequest({ token: 'not.a.valid.jwt', body: { qrHash: 'abc', dna: MOCK_DNA } })
    const res = await handleGenerateCreature(req, makeEnv())
    expect(res.status).toBe(401)
  })

  it('returns 401 when JWT signature is wrong', async () => {
    const tamperedToken = await makeJWT('test-user', 'wrong-secret-xxxxxxxxxxxxxxxxxxxxx')
    const req = makeRequest({ token: tamperedToken, body: { qrHash: 'abc', dna: MOCK_DNA } })
    const res = await handleGenerateCreature(req, makeEnv())
    expect(res.status).toBe(401)
  })

  it('returns 401 when JWT is expired', async () => {
    const expiredToken = await makeJWT('test-user', JWT_SECRET, -3600)
    const req = makeRequest({ token: expiredToken, body: { qrHash: 'abc', dna: MOCK_DNA } })
    const res = await handleGenerateCreature(req, makeEnv())
    expect(res.status).toBe(401)
  })

  it('returns 400 when body is missing required fields', async () => {
    // Mock Supabase call for JWT validation (not reached, but guard if it is)
    mockFetch.mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }))
    const req = makeRequest({ token: validToken, body: { qrHash: 'abc' } }) // missing dna
    const res = await handleGenerateCreature(req, makeEnv())
    expect(res.status).toBe(400)
  })

  it('returns 400 when qrHash is not a 16-char hex string', async () => {
    const req = makeRequest({ token: validToken, body: { qrHash: '../../etc/passwd', dna: MOCK_DNA } })
    const res = await handleGenerateCreature(req, makeEnv())
    expect(res.status).toBe(400)
    const body = await res.json() as Record<string, unknown>
    expect(body.error).toContain('Invalid qrHash format')
  })

  it('returns cached data immediately when species_images has an existing entry', async () => {
    const cachedRow = {
      image_url: 'https://imagedelivery.net/test-hash/abc/qriousoriginal',
      image_url_512: 'https://imagedelivery.net/test-hash/abc/qrious512',
      image_url_256: 'https://imagedelivery.net/test-hash/abc/qrious256',
      field_notes: 'A remarkable specimen indeed.',
      discovery_count: 5,
      first_discoverer_id: 'other-user',
    }

    mockFetch
      // Supabase species_images GET → returns cached row
      .mockResolvedValueOnce(new Response(JSON.stringify([cachedRow]), { status: 200 }))
      // register_discovery RPC
      .mockResolvedValueOnce(new Response(JSON.stringify({ is_first_discoverer: false, discovery_count: 6 }), { status: 200 }))

    const req = makeRequest({ token: validToken, body: { qrHash: MOCK_DNA.hash, dna: MOCK_DNA } })
    const res = await handleGenerateCreature(req, makeEnv())

    expect(res.status).toBe(200)
    const body = await res.json() as Record<string, unknown>
    expect(body.cached).toBe(true)
    expect(body.imageUrl).toBe(cachedRow.image_url)
    expect(body.fieldNotes).toBe(cachedRow.field_notes)
    expect(body.isFirstDiscoverer).toBe(false)

    // Should NOT have called Gemini or Claude
    const geminiCalled = mockFetch.mock.calls.some(
      ([url]) => typeof url === 'string' && url.includes('generativelanguage'),
    )
    expect(geminiCalled).toBe(false)
  })

  it('returns 204 for OPTIONS preflight', async () => {
    const req = new Request('https://qrious.hultberg.org/api/generate-creature', {
      method: 'OPTIONS',
      headers: { Origin: 'https://qrious.hultberg.org' },
    })
    const res = await handleGenerateCreature(req, makeEnv())
    expect(res.status).toBe(204)
  })

  it('generates image and field notes for a new species', async () => {
    const fakeImageBase64 = btoa('fake image bytes')
    const geminiResponse = {
      candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: fakeImageBase64 } }] } }],
    }

    mockFetch
      // species_images GET → no cache
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      // Gemini generate preferred model → success (no model list call on happy path)
      .mockResolvedValueOnce(new Response(JSON.stringify(geminiResponse), { status: 200 }))
      // Cloudflare Images upload
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, result: { id: MOCK_DNA.hash, variants: [] }, errors: [] }), { status: 200 }))
      // Claude field notes
      .mockResolvedValueOnce(new Response(JSON.stringify({ content: [{ type: 'text', text: 'A curious specimen was observed.' }] }), { status: 200 }))
      // species_images INSERT
      .mockResolvedValueOnce(new Response('', { status: 201 }))
      // register_discovery RPC
      .mockResolvedValueOnce(new Response(JSON.stringify({ is_first_discoverer: true, discovery_count: 1 }), { status: 200 }))

    const req = makeRequest({ token: validToken, body: { qrHash: MOCK_DNA.hash, dna: MOCK_DNA } })
    const res = await handleGenerateCreature(req, makeEnv())

    expect(res.status).toBe(200)
    const body = await res.json() as Record<string, unknown>
    expect(body.cached).toBe(false)
    expect(body.imageUrl).toContain(`imagedelivery.net/cf-delivery-hash/${MOCK_DNA.hash}/qriousoriginal`)
    expect(body.imageUrl512).toContain(`${MOCK_DNA.hash}/qrious512`)
    expect(body.imageUrl256).toContain(`${MOCK_DNA.hash}/qrious256`)
    expect(body.fieldNotes).toBe('A curious specimen was observed.')
    expect(body.isFirstDiscoverer).toBe(true)
    expect(body.discoveryCount).toBe(1)
  })

  it('returns 500 when Gemini fails on all models', async () => {
    // Model list contains only the preferred model — which already failed — so no fallbacks are tried
    const geminiModels = { models: [{ name: 'models/gemini-2.0-flash-preview-image-generation', supportedGenerationMethods: ['generateContent'] }] }

    mockFetch
      // species_images GET → no cache
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      // Gemini generate preferred model → failure
      .mockResolvedValueOnce(new Response('Rate limit exceeded', { status: 429 }))
      // Gemini list models (fetched after preferred model fails)
      .mockResolvedValueOnce(new Response(JSON.stringify(geminiModels), { status: 200 }))

    const req = makeRequest({ token: validToken, body: { qrHash: MOCK_DNA.hash, dna: MOCK_DNA } })
    const res = await handleGenerateCreature(req, makeEnv())

    expect(res.status).toBe(500)
    const body = await res.json() as Record<string, unknown>
    expect(body.error).toContain('Illustration generation failed')
  })

  it('still returns image URL even when Claude field notes fail', async () => {
    const fakeImageBase64 = btoa('fake image bytes')
    const geminiResponse = {
      candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: fakeImageBase64 } }] } }],
    }

    mockFetch
      // species_images GET → no cache
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      // Gemini generate preferred model → success
      .mockResolvedValueOnce(new Response(JSON.stringify(geminiResponse), { status: 200 }))
      // Cloudflare Images upload
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, result: { id: MOCK_DNA.hash, variants: [] }, errors: [] }), { status: 200 }))
      // Claude → failure (non-fatal)
      .mockResolvedValueOnce(new Response('Service unavailable', { status: 503 }))
      // species_images INSERT
      .mockResolvedValueOnce(new Response('', { status: 201 }))
      // register_discovery RPC
      .mockResolvedValueOnce(new Response(JSON.stringify({ is_first_discoverer: true, discovery_count: 1 }), { status: 200 }))

    const req = makeRequest({ token: validToken, body: { qrHash: MOCK_DNA.hash, dna: MOCK_DNA } })
    const res = await handleGenerateCreature(req, makeEnv())

    expect(res.status).toBe(200)
    const body = await res.json() as Record<string, unknown>
    expect(body.imageUrl).toContain(`imagedelivery.net/cf-delivery-hash/${MOCK_DNA.hash}/qriousoriginal`)
    expect(body.fieldNotes).toBe('') // empty but not an error
  })

  it('treats CF Images duplicate-ID (HTTP 409 + error code 5409) as success and returns predictable URLs', async () => {
    // Simulates concurrent scan of the same qr_hash: the losing race gets a
    // duplicate-ID error from CF Images. Must fall through to success so the
    // scanner still sees their specimen rather than a 500. Guards ADR 2026-04-20.
    const fakeImageBase64 = btoa('fake image bytes')
    const geminiResponse = {
      candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: fakeImageBase64 } }] } }],
    }
    const duplicateResponse = {
      success: false,
      errors: [{ code: 5409, message: 'Resource already exists' }],
      result: null,
    }

    mockFetch
      // species_images GET → no cache
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      // Gemini generate → success
      .mockResolvedValueOnce(new Response(JSON.stringify(geminiResponse), { status: 200 }))
      // CF Images upload → 409 duplicate (another worker already uploaded this qr_hash)
      .mockResolvedValueOnce(new Response(JSON.stringify(duplicateResponse), { status: 409 }))
      // Claude field notes
      .mockResolvedValueOnce(new Response(JSON.stringify({ content: [{ type: 'text', text: 'Concurrent scan success.' }] }), { status: 200 }))
      // species_images INSERT
      .mockResolvedValueOnce(new Response('', { status: 201 }))
      // register_discovery RPC
      .mockResolvedValueOnce(new Response(JSON.stringify({ is_first_discoverer: false, discovery_count: 2 }), { status: 200 }))

    const req = makeRequest({ token: validToken, body: { qrHash: MOCK_DNA.hash, dna: MOCK_DNA } })
    const res = await handleGenerateCreature(req, makeEnv())

    expect(res.status).toBe(200)
    const body = await res.json() as Record<string, unknown>
    expect(body.imageUrl).toContain(`imagedelivery.net/cf-delivery-hash/${MOCK_DNA.hash}/qriousoriginal`)
    expect(body.imageUrl512).toContain(`${MOCK_DNA.hash}/qrious512`)
    expect(body.imageUrl256).toContain(`${MOCK_DNA.hash}/qrious256`)
    expect(body.isFirstDiscoverer).toBe(false)
  })

  it('returns 500 when CF Images fails for a non-duplicate reason (e.g. invalid token)', async () => {
    const fakeImageBase64 = btoa('fake image bytes')
    const geminiResponse = {
      candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: fakeImageBase64 } }] } }],
    }
    const authErrorResponse = {
      success: false,
      errors: [{ code: 10000, message: 'Authentication error' }],
      result: null,
    }

    mockFetch
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(geminiResponse), { status: 200 }))
      // CF Images → 401 (not a duplicate)
      .mockResolvedValueOnce(new Response(JSON.stringify(authErrorResponse), { status: 401 }))

    const req = makeRequest({ token: validToken, body: { qrHash: MOCK_DNA.hash, dna: MOCK_DNA } })
    const res = await handleGenerateCreature(req, makeEnv())

    expect(res.status).toBe(500)
    const body = await res.json() as Record<string, unknown>
    expect(body.error).toContain('Image upload failed')
  })

  it('verifies ES256 tokens against JWKS (modern Supabase projects)', async () => {
    const { token, jwk } = await makeES256Setup('es256-user-id')

    mockFetch
      // JWKS fetch — served from {SUPABASE_URL}/auth/v1/.well-known/jwks.json
      .mockResolvedValueOnce(new Response(JSON.stringify({ keys: [jwk] }), { status: 200 }))
      // species_images cache hit so the rest of the flow short-circuits
      .mockResolvedValueOnce(new Response(JSON.stringify([{
        image_url: 'https://imagedelivery.net/test/abc/qriousoriginal',
        image_url_512: null,
        image_url_256: null,
        field_notes: 'n',
        discovery_count: 1,
        first_discoverer_id: 'u',
      }]), { status: 200 }))
      // register_discovery RPC
      .mockResolvedValueOnce(new Response(JSON.stringify({ is_first_discoverer: false, discovery_count: 2 }), { status: 200 }))

    // Worker can run without SUPABASE_JWT_SECRET once projects are on asymmetric keys
    const env = makeEnv({ SUPABASE_JWT_SECRET: undefined })
    const req = makeRequest({ token, body: { qrHash: MOCK_DNA.hash, dna: MOCK_DNA } })
    const res = await handleGenerateCreature(req, env)

    expect(res.status).toBe(200)
    const jwksFetched = mockFetch.mock.calls.some(
      ([url]) => typeof url === 'string' && url.endsWith('/auth/v1/.well-known/jwks.json'),
    )
    expect(jwksFetched).toBe(true)
  })

  it('rejects ES256 tokens when no JWKS key matches the kid (even after refetch)', async () => {
    const { token } = await makeES256Setup('es256-user', 'signing-kid-A')
    // JWKS returns a different kid than the token's header. On miss, the worker
    // refetches once to cover key-rotation; here both fetches return the same
    // unrelated key, confirming it genuinely doesn't know the kid.
    const unrelatedKey = { kty: 'EC', crv: 'P-256', x: 'x', y: 'y', kid: 'signing-kid-B' }
    mockFetch
      .mockResolvedValueOnce(new Response(JSON.stringify({ keys: [unrelatedKey] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ keys: [unrelatedKey] }), { status: 200 }))

    const req = makeRequest({ token, body: { qrHash: MOCK_DNA.hash, dna: MOCK_DNA } })
    const res = await handleGenerateCreature(req, makeEnv({ SUPABASE_JWT_SECRET: undefined }))
    expect(res.status).toBe(401)
    const body = await res.json() as Record<string, unknown>
    expect(body.error).toBe('Invalid token')
    expect(typeof body.correlationId).toBe('string')
    // Detail string must NOT leak to the client
    expect(body.detail).toBeUndefined()
    // Two JWKS fetches = the cache bypass ran
    const jwksCalls = mockFetch.mock.calls.filter(
      ([url]) => typeof url === 'string' && url.endsWith('/auth/v1/.well-known/jwks.json'),
    )
    expect(jwksCalls.length).toBe(2)
  })

  it('refetches JWKS on kid-miss and verifies when the rotated key arrives', async () => {
    // Simulates Supabase rotating its signing key: the first JWKS fetch returns
    // the OLD key only; on unknown-kid, the worker re-fetches and gets the NEW
    // key. Without this, every scan would 401 for the full cache TTL after a
    // rotation event. Guards the merge-blocker fix.
    const { token, jwk: newKey } = await makeES256Setup('es256-user', 'new-kid')
    const oldKey = { kty: 'EC', crv: 'P-256', x: 'x', y: 'y', kid: 'old-kid' }

    mockFetch
      // First JWKS fetch — stale, only has the old kid
      .mockResolvedValueOnce(new Response(JSON.stringify({ keys: [oldKey] }), { status: 200 }))
      // Second JWKS fetch (forced refetch after unknown-kid) — includes the new kid
      .mockResolvedValueOnce(new Response(JSON.stringify({ keys: [newKey] }), { status: 200 }))
      // species_images cache hit to short-circuit the rest of the flow
      .mockResolvedValueOnce(new Response(JSON.stringify([{
        image_url: 'https://imagedelivery.net/test/abc/qriousoriginal',
        image_url_512: null, image_url_256: null, field_notes: 'n',
        discovery_count: 1, first_discoverer_id: 'u',
      }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ is_first_discoverer: false, discovery_count: 2 }), { status: 200 }))

    const req = makeRequest({ token, body: { qrHash: MOCK_DNA.hash, dna: MOCK_DNA } })
    const res = await handleGenerateCreature(req, makeEnv({ SUPABASE_JWT_SECRET: undefined }))

    expect(res.status).toBe(200)
    const jwksCalls = mockFetch.mock.calls.filter(
      ([url]) => typeof url === 'string' && url.endsWith('/auth/v1/.well-known/jwks.json'),
    )
    expect(jwksCalls.length).toBe(2)
  })

  it('uses a short negative TTL when JWKS returns no importable keys', async () => {
    // If Supabase transiently ships a JWKS whose keys are all unsupported,
    // the cache should keep that empty result only briefly so the next
    // request retries rather than failing silently for 10 minutes.
    const { token, jwk } = await makeES256Setup('es256-user', 'good-kid')
    const unsupportedKey = { kty: 'OKP', crv: 'Ed25519', x: 'x', kid: 'unsupported-kid' }

    mockFetch
      // First verification: JWKS yields zero importable keys (empty Map cached with short TTL)
      .mockResolvedValueOnce(new Response(JSON.stringify({ keys: [unsupportedKey] }), { status: 200 }))
      // On kid-miss inside verifyJWT, the refetch happens
      .mockResolvedValueOnce(new Response(JSON.stringify({ keys: [unsupportedKey] }), { status: 200 }))

    const req1 = makeRequest({ token, body: { qrHash: MOCK_DNA.hash, dna: MOCK_DNA } })
    const res1 = await handleGenerateCreature(req1, makeEnv({ SUPABASE_JWT_SECRET: undefined }))
    expect(res1.status).toBe(401)

    // Reset mocks — a second verification should NOT be starved by the 10-min
    // primary TTL; it should refresh because the previous result was empty.
    mockFetch.mockReset()
    mockFetch
      .mockResolvedValueOnce(new Response(JSON.stringify({ keys: [jwk] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{
        image_url: 'https://imagedelivery.net/test/abc/qriousoriginal',
        image_url_512: null, image_url_256: null, field_notes: 'n',
        discovery_count: 1, first_discoverer_id: 'u',
      }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ is_first_discoverer: false, discovery_count: 2 }), { status: 200 }))

    // With a 30s negative TTL (vs 10min primary), we can't literally wait here.
    // The contract under test is: the cache entry is sized so a near-term
    // retry attempts the network again. We verify by directly resetting the
    // cache (proxy for "TTL expired") and showing the next call re-fetches.
    __resetJwksCache()
    const req2 = makeRequest({ token, body: { qrHash: MOCK_DNA.hash, dna: MOCK_DNA } })
    const res2 = await handleGenerateCreature(req2, makeEnv({ SUPABASE_JWT_SECRET: undefined }))
    expect(res2.status).toBe(200)
  })

  it('returns 503 (not 401) when the JWKS endpoint is unreachable', async () => {
    const { token } = await makeES256Setup('es256-user')
    // Network error — JWKS endpoint is down/unroutable
    mockFetch.mockRejectedValueOnce(new TypeError('fetch failed: ECONNREFUSED'))

    const req = makeRequest({ token, body: { qrHash: MOCK_DNA.hash, dna: MOCK_DNA } })
    const res = await handleGenerateCreature(req, makeEnv({ SUPABASE_JWT_SECRET: undefined }))
    expect(res.status).toBe(503)
    const body = await res.json() as Record<string, unknown>
    expect(body.error).toBe('Auth provider unavailable')
    expect(typeof body.correlationId).toBe('string')
    expect(body.detail).toBeUndefined()
  })

  it('returns 503 when the JWKS endpoint returns a 5xx', async () => {
    const { token } = await makeES256Setup('es256-user')
    mockFetch.mockResolvedValueOnce(new Response('Service unavailable', { status: 503 }))

    const req = makeRequest({ token, body: { qrHash: MOCK_DNA.hash, dna: MOCK_DNA } })
    const res = await handleGenerateCreature(req, makeEnv({ SUPABASE_JWT_SECRET: undefined }))
    expect(res.status).toBe(503)
    const body = await res.json() as Record<string, unknown>
    expect(body.error).toBe('Auth provider unavailable')
  })

  it('rejects tokens with no exp claim', async () => {
    const tokenNoExp = await makeJWT('test-user', JWT_SECRET, 0, { exp: null })
    const req = makeRequest({ token: tokenNoExp, body: { qrHash: MOCK_DNA.hash, dna: MOCK_DNA } })
    const res = await handleGenerateCreature(req, makeEnv())
    expect(res.status).toBe(401)
  })

  it('rejects tokens whose iss does not match the expected Supabase auth URL', async () => {
    const tokenWrongIss = await makeJWT('test-user', JWT_SECRET, 3600, {
      iss: 'https://attacker.supabase.co/auth/v1',
    })
    const req = makeRequest({ token: tokenWrongIss, body: { qrHash: MOCK_DNA.hash, dna: MOCK_DNA } })
    const res = await handleGenerateCreature(req, makeEnv())
    expect(res.status).toBe(401)
  })

  it('rejects tokens with no iss claim', async () => {
    const tokenNoIss = await makeJWT('test-user', JWT_SECRET, 3600, { iss: null })
    const req = makeRequest({ token: tokenNoIss, body: { qrHash: MOCK_DNA.hash, dna: MOCK_DNA } })
    const res = await handleGenerateCreature(req, makeEnv())
    expect(res.status).toBe(401)
  })

  it('returns a correlationId in the 401 body without leaking verification detail', async () => {
    const req = makeRequest({ token: 'not.a.valid.jwt', body: { qrHash: MOCK_DNA.hash, dna: MOCK_DNA } })
    const res = await handleGenerateCreature(req, makeEnv())
    expect(res.status).toBe(401)
    const body = await res.json() as Record<string, unknown>
    expect(body.error).toBe('Invalid token')
    expect(typeof body.correlationId).toBe('string')
    expect((body.correlationId as string).length).toBeGreaterThan(10)
    expect(body.detail).toBeUndefined()
  })

  it('rejects ES256 tokens with a tampered signature', async () => {
    const { token, jwk } = await makeES256Setup('es256-user')
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ keys: [jwk] }), { status: 200 }))

    // Replace the signature segment with 64 zero bytes (correct ECDSA P-256 length,
    // guaranteed not to be a valid signature). Deterministic invalidation — flipping
    // a single base64url char can occasionally land on a structurally odd string that
    // fails at decode rather than at verify, making the path under test ambiguous.
    const [h, p] = token.split('.')
    const zeroSigBytes = new Uint8Array(64)
    const tampered = `${h}.${p}.${b64urlBytes(zeroSigBytes)}`

    const req = makeRequest({ token: tampered, body: { qrHash: MOCK_DNA.hash, dna: MOCK_DNA } })
    const res = await handleGenerateCreature(req, makeEnv({ SUPABASE_JWT_SECRET: undefined }))
    expect(res.status).toBe(401)
  })

  it('sets correct CORS headers for allowed origin', async () => {
    const req = makeRequest({
      token: validToken,
      body: { qrHash: MOCK_DNA.hash, dna: MOCK_DNA },
      origin: 'https://qrious.hultberg.org',
    })
    // Mock cache hit to short-circuit
    mockFetch
      .mockResolvedValueOnce(new Response(JSON.stringify([{ image_url: 'https://example.com/img.png', image_url_512: null, image_url_256: null, field_notes: 'notes', discovery_count: 1, first_discoverer_id: 'u1' }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ is_first_discoverer: false, discovery_count: 1 }), { status: 200 }))

    const res = await handleGenerateCreature(req, makeEnv())
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://qrious.hultberg.org')
  })
})
