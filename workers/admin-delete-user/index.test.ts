// ABOUT: Tests for the admin-delete-user Worker handler
// ABOUT: Covers JWT verification, admin gate, RPC + Auth Admin API sequencing, and partial-failure shape

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { handleAdminDeleteUser } from './index'
import { __resetJwksCache } from '../shared/jwt'
import type { Env } from '../generate-creature/index'

const JWT_SECRET = 'test-jwt-secret-long-enough-for-hmac-sha256-ok'
const TEST_SUPABASE_URL = 'https://test.supabase.co'
const TEST_ISS = `${TEST_SUPABASE_URL}/auth/v1`
const TARGET_USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

function b64url(s: string): string {
  return btoa(s).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

function b64urlBytes(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let s = ''
  for (const b of arr) s += String.fromCharCode(b)
  return b64url(s)
}

async function makeJWT(sub: string, secret = JWT_SECRET, expOffset = 3600): Promise<string> {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = b64url(JSON.stringify({
    sub,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + expOffset,
    iss: TEST_ISS,
  }))
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${header}.${payload}`))
  return `${header}.${payload}.${b64urlBytes(sig)}`
}

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    ASSETS: {} as Fetcher,
    SUPABASE_URL: TEST_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
    SUPABASE_JWT_SECRET: JWT_SECRET,
    GEMINI_API_KEY: 'gemini',
    ANTHROPIC_API_KEY: 'anthropic',
    CF_ACCOUNT_ID: 'cf',
    CF_IMAGES_TOKEN: 'cf-token',
    CF_IMAGES_DELIVERY_HASH: 'hash',
    RESEND_API_KEY: 'resend',
    ...overrides,
  }
}

function makeRequest(opts: { token?: string; body?: unknown; method?: string; origin?: string } = {}): Request {
  return new Request('https://qrious.hultberg.org/api/admin-delete-user', {
    method: opts.method ?? 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      ...(opts.origin ? { Origin: opts.origin } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  })
}

interface JsonResult { status: number; body: Record<string, unknown> }

async function readJson(res: Response): Promise<JsonResult> {
  const status = res.status
  const text = await res.text()
  return { status, body: text ? (JSON.parse(text) as Record<string, unknown>) : {} }
}

describe('handleAdminDeleteUser', () => {
  let mockFetch: Mock
  let validToken: string

  beforeEach(async () => {
    __resetJwksCache()
    validToken = await makeJWT('caller-user-id')
    mockFetch = vi.fn()
    vi.stubGlobal('fetch', mockFetch)
  })

  it('returns 204 for OPTIONS preflight', async () => {
    const req = new Request('https://qrious.hultberg.org/api/admin-delete-user', {
      method: 'OPTIONS',
      headers: { Origin: 'https://qrious.hultberg.org' },
    })
    const res = await handleAdminDeleteUser(req, makeEnv())
    expect(res.status).toBe(204)
  })

  it('returns 405 for non-POST methods', async () => {
    const req = new Request('https://qrious.hultberg.org/api/admin-delete-user', { method: 'GET' })
    const res = await handleAdminDeleteUser(req, makeEnv())
    expect(res.status).toBe(405)
  })

  it('returns 401 when Authorization header is missing', async () => {
    const req = makeRequest({ body: { user_id: TARGET_USER_ID } })
    const res = await handleAdminDeleteUser(req, makeEnv())
    expect(res.status).toBe(401)
  })

  it('returns 401 when JWT is invalid', async () => {
    const req = makeRequest({ token: 'not.a.valid.jwt', body: { user_id: TARGET_USER_ID } })
    const res = await handleAdminDeleteUser(req, makeEnv())
    expect(res.status).toBe(401)
  })

  it('returns 400 when body is malformed JSON', async () => {
    const req = new Request('https://qrious.hultberg.org/api/admin-delete-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${validToken}` },
      body: 'not-json',
    })
    const res = await handleAdminDeleteUser(req, makeEnv())
    expect(res.status).toBe(400)
  })

  it('returns 400 when user_id is missing or not a UUID', async () => {
    for (const body of [{}, { user_id: '../../etc/passwd' }, { user_id: 'short' }]) {
      const req = makeRequest({ token: validToken, body })
      const res = await handleAdminDeleteUser(req, makeEnv())
      expect(res.status).toBe(400)
    }
  })

  it('returns 403 when caller is not an admin', async () => {
    // is_admin RPC returns false → no further calls should be made
    mockFetch.mockResolvedValueOnce(new Response('false', { status: 200 }))

    const req = makeRequest({ token: validToken, body: { user_id: TARGET_USER_ID } })
    const res = await handleAdminDeleteUser(req, makeEnv())
    const { status, body } = await readJson(res)

    expect(status).toBe(403)
    expect(body.error).toBe('Not authorised')
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch.mock.calls[0]?.[0]).toContain('/rest/v1/rpc/is_admin')
  })

  it('passes the caller JWT (not service-role) when calling is_admin so auth.uid() resolves correctly', async () => {
    mockFetch
      .mockResolvedValueOnce(new Response('true', { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 })) // RPC
      .mockResolvedValueOnce(new Response('', { status: 200 })) // Auth Admin API

    const req = makeRequest({ token: validToken, body: { user_id: TARGET_USER_ID } })
    await handleAdminDeleteUser(req, makeEnv())

    const isAdminCall = mockFetch.mock.calls[0]
    const headers = (isAdminCall[1] as RequestInit).headers as Record<string, string>
    expect(headers.Authorization).toBe(`Bearer ${validToken}`)
    expect(headers.apikey).toBe('service-role-key')
  })

  it('returns 500 with app_data=failed when admin_delete_user_data RPC fails', async () => {
    mockFetch
      .mockResolvedValueOnce(new Response('true', { status: 200 }))
      .mockResolvedValueOnce(new Response('boom', { status: 500 })) // RPC fails
    // Auth Admin API should not be called

    const req = makeRequest({ token: validToken, body: { user_id: TARGET_USER_ID } })
    const res = await handleAdminDeleteUser(req, makeEnv())
    const { status, body } = await readJson(res)

    expect(status).toBe(500)
    expect(body.ok).toBe(false)
    expect(body.app_data).toBe('failed')
    expect(body.auth_user).toBeUndefined()
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('returns 500 with auth_user=failed (partial failure) when Auth Admin API rejects the delete', async () => {
    mockFetch
      .mockResolvedValueOnce(new Response('true', { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 })) // RPC succeeds
      .mockResolvedValueOnce(new Response('upstream error', { status: 502 })) // Auth API fails

    const req = makeRequest({ token: validToken, body: { user_id: TARGET_USER_ID } })
    const res = await handleAdminDeleteUser(req, makeEnv())
    const { status, body } = await readJson(res)

    expect(status).toBe(500)
    expect(body.ok).toBe(false)
    expect(body.app_data).toBe('deleted')
    expect(body.auth_user).toBe('failed')
    expect(typeof body.detail).toBe('string')
  })

  it('returns 200 with both phases marked deleted on the happy path and uses service-role for the Auth Admin call', async () => {
    mockFetch
      .mockResolvedValueOnce(new Response('true', { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response('', { status: 200 }))

    const req = makeRequest({ token: validToken, body: { user_id: TARGET_USER_ID } })
    const res = await handleAdminDeleteUser(req, makeEnv())
    const { status, body } = await readJson(res)

    expect(status).toBe(200)
    expect(body).toEqual({ ok: true, app_data: 'deleted', auth_user: 'deleted' })

    const authAdminCall = mockFetch.mock.calls[2]
    expect(authAdminCall[0]).toBe(`${TEST_SUPABASE_URL}/auth/v1/admin/users/${TARGET_USER_ID}`)
    expect((authAdminCall[1] as RequestInit).method).toBe('DELETE')
    const headers = (authAdminCall[1] as RequestInit).headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer service-role-key')
    expect(headers.apikey).toBe('service-role-key')
  })

  it('returns 429 with Retry-After + structured code when the rate limiter rejects, and skips downstream calls', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const limit = vi.fn().mockResolvedValue({ success: false })
    const env = makeEnv({ ADMIN_DELETE_RATE_LIMITER: { limit } })

    const req = makeRequest({ token: validToken, body: { user_id: TARGET_USER_ID } })
    const res = await handleAdminDeleteUser(req, env)
    expect(res.headers.get('Retry-After')).toBe('60')
    const { status, body } = await readJson(res)

    expect(status).toBe(429)
    expect(body.error).toMatch(/too many requests/i)
    expect(body.code).toBe('rate_limit_admin_delete')
    expect(limit).toHaveBeenCalledWith({ key: 'caller-user-id' })
    // No is_admin / RPC / Auth Admin calls should have happened
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('lets the request through when the rate limiter allows it', async () => {
    const limit = vi.fn().mockResolvedValue({ success: true })
    mockFetch
      .mockResolvedValueOnce(new Response('true', { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response('', { status: 200 }))

    const env = makeEnv({ ADMIN_DELETE_RATE_LIMITER: { limit } })
    const req = makeRequest({ token: validToken, body: { user_id: TARGET_USER_ID } })
    const res = await handleAdminDeleteUser(req, env)

    expect(res.status).toBe(200)
    expect(limit).toHaveBeenCalledWith({ key: 'caller-user-id' })
  })

  it('treats a 404 from the Auth Admin API as success (auth row already absent)', async () => {
    // Recovery scenario: a previous run deleted app data, the auth-admin step
    // failed, and an admin retried. The auth row was cleared manually in the
    // meantime, so the retry hits 404 — should still report success.
    mockFetch
      .mockResolvedValueOnce(new Response('true', { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response('not found', { status: 404 }))

    const req = makeRequest({ token: validToken, body: { user_id: TARGET_USER_ID } })
    const res = await handleAdminDeleteUser(req, makeEnv())
    const { status, body } = await readJson(res)

    expect(status).toBe(200)
    expect(body.ok).toBe(true)
  })

  // ── TD-023: self-delete guard ───────────────────────────────────────────────

  it('returns 400 self_delete_blocked when caller targets themselves, before any upstream call', async () => {
    // Token sub === target. is_admin / RPC / Auth Admin must not be called.
    const selfToken = await makeJWT(TARGET_USER_ID)
    const req = makeRequest({ token: selfToken, body: { user_id: TARGET_USER_ID } })
    const res = await handleAdminDeleteUser(req, makeEnv())
    const { status, body } = await readJson(res)

    expect(status).toBe(400)
    expect(body.error).toMatch(/calling admin/i)
    expect(body.code).toBe('self_delete_blocked')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  // ── TD-025: distinguish 5xx upstream from genuine non-admin ─────────────────

  it('returns 503 auth_check_unavailable when is_admin RPC returns a 5xx', async () => {
    mockFetch.mockResolvedValueOnce(new Response('upstream pg error', { status: 503 }))

    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const req = makeRequest({ token: validToken, body: { user_id: TARGET_USER_ID } })
    const res = await handleAdminDeleteUser(req, makeEnv())
    const { status, body } = await readJson(res)

    expect(status).toBe(503)
    expect(body.code).toBe('auth_check_unavailable')
    expect(body.error).toMatch(/temporarily unavailable/i)
    // Only the is_admin call should have happened — RPC and Auth Admin must be skipped
    expect(mockFetch).toHaveBeenCalledTimes(1)
    errSpy.mockRestore()
  })

  it('still returns 403 when is_admin RPC returns 200 with body false', async () => {
    // Confirms that the 5xx-vs-403 split didn't break the genuine-non-admin path.
    mockFetch.mockResolvedValueOnce(new Response('false', { status: 200 }))

    const req = makeRequest({ token: validToken, body: { user_id: TARGET_USER_ID } })
    const res = await handleAdminDeleteUser(req, makeEnv())
    expect(res.status).toBe(403)
  })

  // ── TD-022: structured audit log on irreversible operations ─────────────────

  it('logs a structured admin_delete_user audit line on the success path', async () => {
    mockFetch
      .mockResolvedValueOnce(new Response('true', { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response('', { status: 200 }))

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const req = makeRequest({ token: validToken, body: { user_id: TARGET_USER_ID } })
    const res = await handleAdminDeleteUser(req, makeEnv())

    expect(res.status).toBe(200)
    expect(logSpy).toHaveBeenCalledTimes(1)
    const audit = JSON.parse(logSpy.mock.calls[0]![0] as string) as Record<string, unknown>
    expect(audit.event).toBe('admin_delete_user')
    expect(audit.outcome).toBe('success')
    expect(audit.caller_sub).toBe('caller-user-id')
    expect(audit.target_user_id).toBe(TARGET_USER_ID)
    expect(audit.app_data).toBe('deleted')
    expect(audit.auth_user).toBe('deleted')
    expect(typeof audit.correlation_id).toBe('string')
    expect(typeof audit.timestamp).toBe('string')
    logSpy.mockRestore()
  })

  it('audit-logs auth_user=absent when the Auth Admin API returns 404 on retry', async () => {
    mockFetch
      .mockResolvedValueOnce(new Response('true', { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response('not found', { status: 404 }))

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const req = makeRequest({ token: validToken, body: { user_id: TARGET_USER_ID } })
    await handleAdminDeleteUser(req, makeEnv())

    const audit = JSON.parse(logSpy.mock.calls[0]![0] as string) as Record<string, unknown>
    expect(audit.outcome).toBe('success')
    expect(audit.auth_user).toBe('absent')
    logSpy.mockRestore()
  })

  it('audit-logs rejected_self when the caller targets themselves', async () => {
    const selfToken = await makeJWT(TARGET_USER_ID)
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const req = makeRequest({ token: selfToken, body: { user_id: TARGET_USER_ID } })
    const res = await handleAdminDeleteUser(req, makeEnv())

    expect(res.status).toBe(400)
    expect(logSpy).toHaveBeenCalledTimes(1)
    const audit = JSON.parse(logSpy.mock.calls[0]![0] as string) as Record<string, unknown>
    expect(audit.event).toBe('admin_delete_user')
    expect(audit.outcome).toBe('rejected_self')
    expect(audit.caller_sub).toBe(TARGET_USER_ID)
    expect(audit.target_user_id).toBe(TARGET_USER_ID)
    expect(audit.app_data).toBeUndefined()
    expect(audit.auth_user).toBeUndefined()
    logSpy.mockRestore()
  })

  it('blocks self-delete regardless of UUID casing in the caller sub vs the body', async () => {
    // JWT sub uppercase, body lowercase — same UUID, different serialisation.
    // Without case-insensitive compare an attacker could bypass the guard by
    // re-casing the same UUID in the body.
    const upperUuid = TARGET_USER_ID.toUpperCase()
    const selfToken = await makeJWT(upperUuid)
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const req = makeRequest({ token: selfToken, body: { user_id: TARGET_USER_ID } })
    const res = await handleAdminDeleteUser(req, makeEnv())
    const { status, body } = await readJson(res)

    expect(status).toBe(400)
    expect(body.code).toBe('self_delete_blocked')
    expect(mockFetch).not.toHaveBeenCalled()
    const audit = JSON.parse(logSpy.mock.calls[0]![0] as string) as Record<string, unknown>
    expect(audit.outcome).toBe('rejected_self')
    logSpy.mockRestore()
  })

  it('audit-logs rejected_not_admin when is_admin returns false', async () => {
    mockFetch.mockResolvedValueOnce(new Response('false', { status: 200 }))

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const req = makeRequest({ token: validToken, body: { user_id: TARGET_USER_ID } })
    const res = await handleAdminDeleteUser(req, makeEnv())

    expect(res.status).toBe(403)
    expect(logSpy).toHaveBeenCalledTimes(1)
    const audit = JSON.parse(logSpy.mock.calls[0]![0] as string) as Record<string, unknown>
    expect(audit.outcome).toBe('rejected_not_admin')
    expect(audit.caller_sub).toBe('caller-user-id')
    expect(audit.target_user_id).toBe(TARGET_USER_ID)
    logSpy.mockRestore()
  })

  it('audit-logs rate_limited when the rate limiter rejects', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const limit = vi.fn().mockResolvedValue({ success: false })
    const env = makeEnv({ ADMIN_DELETE_RATE_LIMITER: { limit } })

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const req = makeRequest({ token: validToken, body: { user_id: TARGET_USER_ID } })
    const res = await handleAdminDeleteUser(req, env)

    expect(res.status).toBe(429)
    expect(logSpy).toHaveBeenCalledTimes(1)
    const audit = JSON.parse(logSpy.mock.calls[0]![0] as string) as Record<string, unknown>
    expect(audit.outcome).toBe('rate_limited')
    expect(audit.caller_sub).toBe('caller-user-id')
    expect(audit.target_user_id).toBeUndefined()
    logSpy.mockRestore()
  })

  it('audit-logs partial_failure with a detail field when the Auth Admin API rejects', async () => {
    mockFetch
      .mockResolvedValueOnce(new Response('true', { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response('upstream error', { status: 502 }))

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const req = makeRequest({ token: validToken, body: { user_id: TARGET_USER_ID } })
    const res = await handleAdminDeleteUser(req, makeEnv())

    expect(res.status).toBe(500)
    const audit = JSON.parse(logSpy.mock.calls[0]![0] as string) as Record<string, unknown>
    expect(audit.outcome).toBe('partial_failure')
    expect(audit.app_data).toBe('deleted')
    expect(audit.auth_user).toBe('failed')
    expect(typeof audit.detail).toBe('string')
    logSpy.mockRestore()
    errSpy.mockRestore()
  })
})
