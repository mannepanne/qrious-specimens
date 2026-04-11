// ABOUT: Tests for generate-creature Worker handler
// ABOUT: Covers JWT verification, cache hits, generation flow, and error paths

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { handleGenerateCreature, type Env } from './index'
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

// A valid-looking HS256 JWT for the sub "test-user-id"
// (signature will not verify — we mock verifyJWT via mocking the module's imports)
// Instead, we construct a real JWT manually using WebCrypto in the env
const JWT_SECRET = 'test-jwt-secret-long-enough-for-hmac-sha256-ok'

async function makeJWT(sub: string, secret: string, expOffset = 3600): Promise<string> {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
  const payload = btoa(
    JSON.stringify({ sub, exp: Math.floor(Date.now() / 1000) + expOffset, iat: Math.floor(Date.now() / 1000) }),
  )
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sigBytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${header}.${payload}`))
  const sig = btoa(String.fromCharCode(...new Uint8Array(sigBytes)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')

  return `${header}.${payload}.${sig}`
}

// ── Mock R2 bucket ────────────────────────────────────────────────────────────

function makeMockR2(): R2Bucket {
  return {
    put: vi.fn().mockResolvedValue(undefined),
    get: vi.fn(),
    delete: vi.fn(),
    head: vi.fn(),
    list: vi.fn(),
    createMultipartUpload: vi.fn(),
    resumeMultipartUpload: vi.fn(),
  } as unknown as R2Bucket
}

// ── Mock env ──────────────────────────────────────────────────────────────────

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    IMAGES: makeMockR2(),
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'service-key',
    SUPABASE_JWT_SECRET: JWT_SECRET,
    GEMINI_API_KEY: 'gemini-key',
    ANTHROPIC_API_KEY: 'anthropic-key',
    PUBLIC_R2_URL: 'https://pub-test.r2.dev',
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

  it('returns cached data immediately when species_images has an existing entry', async () => {
    const cachedRow = {
      image_url: 'https://pub-test.r2.dev/species/original/abc.png',
      image_url_512: 'https://pub-test.r2.dev/species/512/abc.png',
      image_url_256: 'https://pub-test.r2.dev/species/256/abc.png',
      field_notes: 'A remarkable specimen indeed.',
      discovery_count: 5,
      first_discoverer_id: 'other-user',
    }

    mockFetch
      // Supabase species_images GET → returns cached row
      .mockResolvedValueOnce(new Response(JSON.stringify([cachedRow]), { status: 200 }))
      // register_discovery RPC
      .mockResolvedValueOnce(new Response(JSON.stringify({ is_first_discoverer: false, discovery_count: 6 }), { status: 200 }))

    const req = makeRequest({ token: validToken, body: { qrHash: 'abc', dna: MOCK_DNA } })
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
    const geminiModels = { models: [{ name: 'models/gemini-2.0-flash-preview-image-generation', supportedGenerationMethods: ['generateContent'] }] }
    const geminiResponse = {
      candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: fakeImageBase64 } }] } }],
    }

    mockFetch
      // species_images GET → no cache
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      // Gemini list models
      .mockResolvedValueOnce(new Response(JSON.stringify(geminiModels), { status: 200 }))
      // Gemini generate
      .mockResolvedValueOnce(new Response(JSON.stringify(geminiResponse), { status: 200 }))
      // Claude field notes
      .mockResolvedValueOnce(new Response(JSON.stringify({ content: [{ type: 'text', text: 'A curious specimen was observed.' }] }), { status: 200 }))
      // species_images INSERT
      .mockResolvedValueOnce(new Response('', { status: 201 }))
      // register_discovery RPC
      .mockResolvedValueOnce(new Response(JSON.stringify({ is_first_discoverer: true, discovery_count: 1 }), { status: 200 }))

    const req = makeRequest({ token: validToken, body: { qrHash: 'abc', dna: MOCK_DNA } })
    const res = await handleGenerateCreature(req, makeEnv())

    expect(res.status).toBe(200)
    const body = await res.json() as Record<string, unknown>
    expect(body.cached).toBe(false)
    expect(body.imageUrl).toContain('species/original/abc')
    expect(body.imageUrl512).toContain('species/512/abc')
    expect(body.imageUrl256).toContain('species/256/abc')
    expect(body.fieldNotes).toBe('A curious specimen was observed.')
    expect(body.isFirstDiscoverer).toBe(true)
    expect(body.discoveryCount).toBe(1)
  })

  it('returns 500 when Gemini fails on all models', async () => {
    const geminiModels = { models: [{ name: 'models/gemini-2.0-flash-preview-image-generation', supportedGenerationMethods: ['generateContent'] }] }

    mockFetch
      // species_images GET → no cache
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      // Gemini list models
      .mockResolvedValueOnce(new Response(JSON.stringify(geminiModels), { status: 200 }))
      // Gemini generate → failure
      .mockResolvedValueOnce(new Response('Rate limit exceeded', { status: 429 }))

    const req = makeRequest({ token: validToken, body: { qrHash: 'abc', dna: MOCK_DNA } })
    const res = await handleGenerateCreature(req, makeEnv())

    expect(res.status).toBe(500)
    const body = await res.json() as Record<string, unknown>
    expect(body.error).toContain('Illustration generation failed')
  })

  it('still returns image URL even when Claude field notes fail', async () => {
    const fakeImageBase64 = btoa('fake image bytes')
    const geminiModels = { models: [{ name: 'models/gemini-2.0-flash-preview-image-generation', supportedGenerationMethods: ['generateContent'] }] }
    const geminiResponse = {
      candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: fakeImageBase64 } }] } }],
    }

    mockFetch
      // species_images GET → no cache
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      // Gemini list models
      .mockResolvedValueOnce(new Response(JSON.stringify(geminiModels), { status: 200 }))
      // Gemini generate → success
      .mockResolvedValueOnce(new Response(JSON.stringify(geminiResponse), { status: 200 }))
      // Claude → failure (non-fatal)
      .mockResolvedValueOnce(new Response('Service unavailable', { status: 503 }))
      // species_images INSERT
      .mockResolvedValueOnce(new Response('', { status: 201 }))
      // register_discovery RPC
      .mockResolvedValueOnce(new Response(JSON.stringify({ is_first_discoverer: true, discovery_count: 1 }), { status: 200 }))

    const req = makeRequest({ token: validToken, body: { qrHash: 'abc', dna: MOCK_DNA } })
    const res = await handleGenerateCreature(req, makeEnv())

    expect(res.status).toBe(200)
    const body = await res.json() as Record<string, unknown>
    expect(body.imageUrl).toContain('species/original/abc')
    expect(body.fieldNotes).toBe('') // empty but not an error
  })

  it('sets correct CORS headers for allowed origin', async () => {
    const req = makeRequest({
      token: validToken,
      body: { qrHash: 'abc', dna: MOCK_DNA },
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
