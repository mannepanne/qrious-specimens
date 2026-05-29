// ABOUT: Integration tests for the Worker entrypoint routing + security-header wrapping
// ABOUT: Confirms every route (API handlers and the static-asset fallback) gets the security headers

import { describe, it, expect, vi, beforeEach } from 'vitest'

const handleGenerateCreature = vi.fn()
const handleContact = vi.fn()
const handleAdminDeleteUser = vi.fn()

vi.mock('../workers/generate-creature/index', () => ({
  handleGenerateCreature: (...args: unknown[]) => handleGenerateCreature(...args),
}))
vi.mock('../workers/contact/index', () => ({
  handleContact: (...args: unknown[]) => handleContact(...args),
}))
vi.mock('../workers/admin-delete-user/index', () => ({
  handleAdminDeleteUser: (...args: unknown[]) => handleAdminDeleteUser(...args),
}))

import worker from './worker'

type Env = Parameters<typeof worker.fetch>[1]

function makeEnv(assetsResponse: Response): Env {
  return { ASSETS: { fetch: vi.fn().mockResolvedValue(assetsResponse) } } as unknown as Env
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('worker entrypoint', () => {
  it('serves the SPA via the assets binding for non-API paths, with security headers', async () => {
    const env = makeEnv(new Response('<!doctype html>', { headers: { 'Content-Type': 'text/html' } }))
    const res = await worker.fetch(new Request('https://qrious.hultberg.org/'), env)

    expect(res.headers.get('Content-Security-Policy')).toContain("default-src 'self'")
    expect(res.headers.get('X-Frame-Options')).toBe('DENY')
    expect(res.headers.get('Content-Type')).toBe('text/html')
    expect(await res.text()).toBe('<!doctype html>')
  })

  it('routes /api/generate-creature and wraps the handler response', async () => {
    handleGenerateCreature.mockResolvedValue(new Response('{}', { status: 200 }))
    const res = await worker.fetch(
      new Request('https://qrious.hultberg.org/api/generate-creature', { method: 'POST' }),
      makeEnv(new Response('unused')),
    )
    expect(handleGenerateCreature).toHaveBeenCalledOnce()
    expect(res.headers.get('Permissions-Policy')).toContain('camera=(self)')
  })

  it('routes /api/contact and wraps the handler response', async () => {
    handleContact.mockResolvedValue(new Response('{}', { status: 200 }))
    const res = await worker.fetch(
      new Request('https://qrious.hultberg.org/api/contact', { method: 'POST' }),
      makeEnv(new Response('unused')),
    )
    expect(handleContact).toHaveBeenCalledOnce()
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff')
  })

  it('routes /api/admin-delete-user and wraps the handler response', async () => {
    handleAdminDeleteUser.mockResolvedValue(new Response('{}', { status: 200 }))
    const res = await worker.fetch(
      new Request('https://qrious.hultberg.org/api/admin-delete-user', { method: 'POST' }),
      makeEnv(new Response('unused')),
    )
    expect(handleAdminDeleteUser).toHaveBeenCalledOnce()
    expect(res.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
  })

  it('falls back to serving the asset (with headers) when a route throws', async () => {
    handleGenerateCreature.mockRejectedValue(new Error('boom'))
    const env = makeEnv(new Response('<!doctype html>', { headers: { 'Content-Type': 'text/html' } }))
    const res = await worker.fetch(
      new Request('https://qrious.hultberg.org/api/generate-creature', { method: 'POST' }),
      env,
    )
    // The whole site must not blank on a routing bug: the request degrades to
    // the asset binding, still carrying the security headers.
    expect(res.headers.get('Content-Security-Policy')).toContain("default-src 'self'")
    expect(await res.text()).toBe('<!doctype html>')
  })
})
