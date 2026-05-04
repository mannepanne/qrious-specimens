// ABOUT: Shared CORS helpers for Worker handlers
// ABOUT: Reads ALLOWED_ORIGINS from env so the allowlist is config, not code

import type { Env } from './env'

const FALLBACK_ALLOWED_ORIGINS = ['https://qrious.hultberg.org']

/**
 * Parse the comma-separated `ALLOWED_ORIGINS` env var into a trimmed list.
 * Falls back to the canonical production origin when the var is missing or
 * resolves to an empty list — never returns an empty array, so callers can
 * always rely on `result[0]` as a safe default origin.
 */
export function parseAllowedOrigins(env: Env): string[] {
  const raw = env.ALLOWED_ORIGINS
  if (!raw) return [...FALLBACK_ALLOWED_ORIGINS]
  const list = raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
  return list.length > 0 ? list : [...FALLBACK_ALLOWED_ORIGINS]
}

/**
 * Build a CORS header bag. The chosen `Access-Control-Allow-Origin` is the
 * incoming Origin if it's on the allowlist, otherwise the first allowed entry
 * (the canonical production origin). `allowHeaders` defaults to the value
 * needed by JWT-bearing routes; pass `'Content-Type'` for unauthenticated
 * endpoints like the contact form.
 */
export function corsHeaders(
  origin: string | null,
  env: Env,
  allowHeaders = 'Content-Type, Authorization',
): Record<string, string> {
  const allowed = parseAllowedOrigins(env)
  const allowedOrigin = origin && allowed.includes(origin) ? origin : allowed[0]
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': allowHeaders,
  }
}
