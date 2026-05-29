// ABOUT: Tests for the shared security-header helper
// ABOUT: Locks in the CSP allowlist, the camera-allowing Permissions-Policy, and edge-owned HSTS

import { describe, it, expect } from 'vitest'
import { SECURITY_HEADERS, withSecurityHeaders } from './securityHeaders'

function csp(): string {
  return SECURITY_HEADERS['Content-Security-Policy']
}

describe('SECURITY_HEADERS', () => {
  it('sets the four hardening headers', () => {
    expect(SECURITY_HEADERS['X-Content-Type-Options']).toBe('nosniff')
    expect(SECURITY_HEADERS['X-Frame-Options']).toBe('DENY')
    expect(SECURITY_HEADERS['Referrer-Policy']).toBe('strict-origin-when-cross-origin')
  })

  it('allows the camera on self so QR scanning keeps working, denies mic and geolocation', () => {
    const policy = SECURITY_HEADERS['Permissions-Policy']
    expect(policy).toContain('camera=(self)')
    expect(policy).toContain('microphone=()')
    expect(policy).toContain('geolocation=()')
  })

  it('never sets Strict-Transport-Security (owned by the Cloudflare edge)', () => {
    expect(SECURITY_HEADERS['Strict-Transport-Security']).toBeUndefined()
  })
})

describe('Content-Security-Policy', () => {
  it('locks down the dangerous fetch directives', () => {
    expect(csp()).toContain("default-src 'self'")
    expect(csp()).toContain("object-src 'none'")
    expect(csp()).toContain("frame-ancestors 'none'")
    expect(csp()).toContain("base-uri 'self'")
  })

  it('allows the Cloudflare Insights beacon script', () => {
    expect(csp()).toContain('script-src')
    expect(csp()).toContain('https://static.cloudflareinsights.com')
  })

  it('allows Google Fonts stylesheet and font files', () => {
    expect(csp()).toContain('https://fonts.googleapis.com')
    expect(csp()).toContain('https://fonts.gstatic.com')
  })

  it('allows inline styles (Radix/Tailwind inject style attributes)', () => {
    expect(csp()).toMatch(/style-src[^;]*'unsafe-inline'/)
  })

  it('does not allow inline scripts', () => {
    expect(csp()).not.toMatch(/script-src[^;]*'unsafe-inline'/)
  })

  it('allows Cloudflare Images plus data: and blob: images', () => {
    expect(csp()).toMatch(/img-src[^;]*https:\/\/imagedelivery\.net/)
    expect(csp()).toMatch(/img-src[^;]*data:/)
    expect(csp()).toMatch(/img-src[^;]*blob:/)
  })

  it('allows Supabase over https and wss, plus the beacon endpoint', () => {
    expect(csp()).toContain('https://*.supabase.co')
    expect(csp()).toContain('wss://*.supabase.co')
    expect(csp()).toContain('https://cloudflareinsights.com')
  })
})

describe('withSecurityHeaders', () => {
  it('applies every security header to the response', () => {
    const wrapped = withSecurityHeaders(new Response('ok'))
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      expect(wrapped.headers.get(name)).toBe(value)
    }
  })

  it('preserves the original status, statusText, and body', async () => {
    const original = new Response('payload', { status: 201, statusText: 'Created' })
    const wrapped = withSecurityHeaders(original)
    expect(wrapped.status).toBe(201)
    expect(wrapped.statusText).toBe('Created')
    expect(await wrapped.text()).toBe('payload')
  })

  it('handles a null-body response (e.g. a 304 from the assets binding)', () => {
    // run_worker_first routes conditional requests through the wrapper, so the
    // null-body 304/204 case must not throw when reconstructing the response.
    const wrapped = withSecurityHeaders(new Response(null, { status: 304 }))
    expect(wrapped.status).toBe(304)
    expect(wrapped.headers.get('X-Frame-Options')).toBe('DENY')
  })

  it('preserves pre-existing headers such as Content-Type and CORS', () => {
    const original = new Response('{}', {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': 'https://qrious.hultberg.org',
      },
    })
    const wrapped = withSecurityHeaders(original)
    expect(wrapped.headers.get('Content-Type')).toBe('application/json')
    expect(wrapped.headers.get('Access-Control-Allow-Origin')).toBe('https://qrious.hultberg.org')
    expect(wrapped.headers.get('X-Frame-Options')).toBe('DENY')
  })
})
