// ABOUT: Tests for contact form Worker handler
// ABOUT: Covers method/CORS, validation, honeypot rejection, rate limiting, and DB insert flow

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest'
import { handleContact } from './index'
import type { Env } from '../generate-creature/index'

const TEST_SUPABASE_URL = 'https://test.supabase.co'

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    ASSETS: undefined as unknown as Fetcher,
    SUPABASE_URL: TEST_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
    GEMINI_API_KEY: 'gemini',
    ANTHROPIC_API_KEY: 'anthropic',
    CF_ACCOUNT_ID: 'cf',
    CF_IMAGES_TOKEN: 'cf-images',
    CF_IMAGES_DELIVERY_HASH: 'hash',
    RESEND_API_KEY: '',
    ...overrides,
  } as Env
}

function makeRequest(
  body: unknown | string,
  init: { method?: string; origin?: string; ip?: string } = {},
): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (init.origin) headers.Origin = init.origin
  if (init.ip) headers['CF-Connecting-IP'] = init.ip
  return new Request('https://qrious.hultberg.org/api/contact', {
    method: init.method ?? 'POST',
    headers,
    body: typeof body === 'string' || body == null ? (body as string | null) : JSON.stringify(body),
  })
}

let fetchMock: Mock

beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 201 }))
  vi.stubGlobal('fetch', fetchMock)
  // Silence the worker's console.error output for negative-path tests
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('handleContact — method and CORS', () => {
  it('responds 204 with CORS headers to OPTIONS preflight', async () => {
    const res = await handleContact(
      makeRequest(null, { method: 'OPTIONS', origin: 'https://qrious.hultberg.org' }),
      makeEnv(),
    )
    expect(res.status).toBe(204)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://qrious.hultberg.org')
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST')
  })

  it('echoes localhost origin when allowed', async () => {
    const res = await handleContact(
      makeRequest(null, { method: 'OPTIONS', origin: 'http://localhost:5173' }),
      makeEnv(),
    )
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173')
  })

  it('falls back to production origin for disallowed origins', async () => {
    const res = await handleContact(
      makeRequest(null, { method: 'OPTIONS', origin: 'https://evil.example.com' }),
      makeEnv(),
    )
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://qrious.hultberg.org')
  })

  it('rejects non-POST methods with 405', async () => {
    const res = await handleContact(makeRequest(null, { method: 'GET' }), makeEnv())
    expect(res.status).toBe(405)
  })

  it('returns 400 on invalid JSON', async () => {
    const res = await handleContact(makeRequest('not-json'), makeEnv())
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Invalid JSON' })
  })
})

describe('handleContact — honeypot', () => {
  it('drops a submission silently with 200 when honeypot is filled', async () => {
    const res = await handleContact(
      makeRequest({
        sender_email: 'spam@example.com',
        message: 'spam payload',
        honeypot: 'i-am-a-bot',
      }),
      makeEnv(),
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    // No DB insert call should have been made
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does not insert when honeypot is non-empty even if other fields are missing', async () => {
    const res = await handleContact(
      makeRequest({ honeypot: 'caught' }),
      makeEnv(),
    )
    expect(res.status).toBe(200)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('proceeds normally when honeypot is empty string', async () => {
    const res = await handleContact(
      makeRequest({
        sender_email: 'real@example.com',
        message: 'a real message',
        honeypot: '',
      }),
      makeEnv(),
    )
    expect(res.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock.mock.calls[0][0]).toBe(`${TEST_SUPABASE_URL}/rest/v1/contact_messages`)
  })
})

describe('handleContact — validation', () => {
  it('rejects when sender_email is missing', async () => {
    const res = await handleContact(makeRequest({ message: 'hi' }), makeEnv())
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'sender_email and message are required' })
  })

  it('rejects when message is missing', async () => {
    const res = await handleContact(
      makeRequest({ sender_email: 'a@b.co' }),
      makeEnv(),
    )
    expect(res.status).toBe(400)
  })

  it('rejects malformed email addresses', async () => {
    const res = await handleContact(
      makeRequest({ sender_email: 'not-an-email', message: 'hi' }),
      makeEnv(),
    )
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Invalid email address' })
  })

  it('rejects messages longer than 2000 characters', async () => {
    const res = await handleContact(
      makeRequest({ sender_email: 'a@b.co', message: 'x'.repeat(2001) }),
      makeEnv(),
    )
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Input too long' })
  })

  it('rejects sender_name longer than 200 characters', async () => {
    const res = await handleContact(
      makeRequest({
        sender_email: 'a@b.co',
        message: 'hi',
        sender_name: 'x'.repeat(201),
      }),
      makeEnv(),
    )
    expect(res.status).toBe(400)
  })
})

describe('handleContact — rate limiting', () => {
  it('returns 429 when the per-IP rate limiter rejects', async () => {
    const limit = vi.fn().mockResolvedValue({ success: false })
    const env = makeEnv({ CONTACT_RATE_LIMITER: { limit } })

    const res = await handleContact(
      makeRequest(
        { sender_email: 'a@b.co', message: 'hi' },
        { ip: '10.0.0.1' },
      ),
      env,
    )
    expect(res.status).toBe(429)
    expect(limit).toHaveBeenCalledWith({ key: '10.0.0.1' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('uses "unknown" key when CF-Connecting-IP header is absent', async () => {
    const limit = vi.fn().mockResolvedValue({ success: true })
    const env = makeEnv({ CONTACT_RATE_LIMITER: { limit } })

    await handleContact(
      makeRequest({ sender_email: 'a@b.co', message: 'hi' }),
      env,
    )
    expect(limit).toHaveBeenCalledWith({ key: 'unknown' })
  })
})

describe('handleContact — DB insert', () => {
  it('inserts via service role and returns 200 on success', async () => {
    const res = await handleContact(
      makeRequest({
        sender_email: 'naturalist@example.com',
        sender_name: 'Mary',
        message: 'A specimen of note.',
      }),
      makeEnv(),
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })

    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(`${TEST_SUPABASE_URL}/rest/v1/contact_messages`)
    expect(init.method).toBe('POST')
    expect(init.headers.apikey).toBe('service-role-key')
    expect(init.headers.Authorization).toBe('Bearer service-role-key')
    expect(JSON.parse(init.body as string)).toEqual({
      sender_email: 'naturalist@example.com',
      sender_name: 'Mary',
      message: 'A specimen of note.',
    })
  })

  it('passes sender_name as null when omitted', async () => {
    await handleContact(
      makeRequest({ sender_email: 'a@b.co', message: 'hi' }),
      makeEnv(),
    )
    const init = fetchMock.mock.calls[0][1]
    expect(JSON.parse(init.body as string).sender_name).toBeNull()
  })

  it('returns 500 if Supabase rejects the insert', async () => {
    fetchMock.mockResolvedValueOnce(new Response('rls violation', { status: 403 }))
    const res = await handleContact(
      makeRequest({ sender_email: 'a@b.co', message: 'hi' }),
      makeEnv(),
    )
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Failed to save message' })
  })

  it('still returns 200 if Resend notification fails (non-fatal)', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 201 })) // DB insert succeeds
      .mockResolvedValueOnce(new Response('resend down', { status: 500 })) // Resend fails

    const res = await handleContact(
      makeRequest({ sender_email: 'a@b.co', message: 'hi' }),
      makeEnv({ RESEND_API_KEY: 'resend-key' }),
    )
    expect(res.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1][0]).toBe('https://api.resend.com/emails')
  })

  it('does not call Resend when RESEND_API_KEY is unset', async () => {
    await handleContact(
      makeRequest({ sender_email: 'a@b.co', message: 'hi' }),
      makeEnv({ RESEND_API_KEY: '' }),
    )
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock.mock.calls[0][0]).toBe(`${TEST_SUPABASE_URL}/rest/v1/contact_messages`)
  })
})
