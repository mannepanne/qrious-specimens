// ABOUT: Tests for shared CORS helpers — env-driven allowlist parsing and header construction
// ABOUT: Locks in TD-010 + TD-026 behaviour: localhost only echoed when env opts in

import { describe, it, expect } from 'vitest'
import { corsHeaders, parseAllowedOrigins } from './cors'
import type { Env } from './env'

function makeEnv(allowedOrigins?: string): Env {
  return { ALLOWED_ORIGINS: allowedOrigins } as Env
}

describe('parseAllowedOrigins', () => {
  it('falls back to canonical production origin when env var is missing', () => {
    expect(parseAllowedOrigins(makeEnv())).toEqual(['https://qrious.hultberg.org'])
  })

  it('falls back to canonical origin when env var is empty string', () => {
    expect(parseAllowedOrigins(makeEnv(''))).toEqual(['https://qrious.hultberg.org'])
  })

  it('falls back to canonical origin when env var contains only whitespace and commas', () => {
    expect(parseAllowedOrigins(makeEnv(' , , '))).toEqual(['https://qrious.hultberg.org'])
  })

  it('parses a single origin', () => {
    expect(parseAllowedOrigins(makeEnv('https://qrious.hultberg.org'))).toEqual([
      'https://qrious.hultberg.org',
    ])
  })

  it('parses comma-separated origins and trims whitespace', () => {
    expect(
      parseAllowedOrigins(makeEnv('https://qrious.hultberg.org , http://localhost:5173')),
    ).toEqual(['https://qrious.hultberg.org', 'http://localhost:5173'])
  })
})

describe('corsHeaders', () => {
  it('echoes a known origin', () => {
    const headers = corsHeaders('https://qrious.hultberg.org', makeEnv())
    expect(headers['Access-Control-Allow-Origin']).toBe('https://qrious.hultberg.org')
  })

  it('falls back to the first allowed origin for an unknown origin', () => {
    const headers = corsHeaders('https://evil.example.com', makeEnv())
    expect(headers['Access-Control-Allow-Origin']).toBe('https://qrious.hultberg.org')
  })

  it('falls back to the first allowed origin when origin is null', () => {
    const headers = corsHeaders(null, makeEnv())
    expect(headers['Access-Control-Allow-Origin']).toBe('https://qrious.hultberg.org')
  })

  it('echoes localhost when ALLOWED_ORIGINS includes it', () => {
    const headers = corsHeaders(
      'http://localhost:5173',
      makeEnv('https://qrious.hultberg.org,http://localhost:5173'),
    )
    expect(headers['Access-Control-Allow-Origin']).toBe('http://localhost:5173')
  })

  it('rejects localhost under the production default allowlist', () => {
    const headers = corsHeaders('http://localhost:5173', makeEnv())
    expect(headers['Access-Control-Allow-Origin']).toBe('https://qrious.hultberg.org')
  })

  it('defaults Access-Control-Allow-Headers to Content-Type, Authorization', () => {
    const headers = corsHeaders('https://qrious.hultberg.org', makeEnv())
    expect(headers['Access-Control-Allow-Headers']).toBe('Content-Type, Authorization')
  })

  it('honours a custom allowHeaders argument', () => {
    const headers = corsHeaders('https://qrious.hultberg.org', makeEnv(), 'Content-Type')
    expect(headers['Access-Control-Allow-Headers']).toBe('Content-Type')
  })

  it('always sets POST and OPTIONS methods', () => {
    const headers = corsHeaders('https://qrious.hultberg.org', makeEnv())
    expect(headers['Access-Control-Allow-Methods']).toBe('POST, OPTIONS')
  })
})
