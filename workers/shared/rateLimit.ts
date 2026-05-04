// ABOUT: Shared rate-limit helper for Cloudflare Worker handlers
// ABOUT: Centralises 429 body shape, Retry-After header, and the optional-binding skip-when-unset rule

import type { RateLimiter } from './env'

/**
 * The `simple` ratelimit binding only supports periods of 10 or 60 seconds; we
 * always configure 60s, so a single fixed Retry-After is correct for every
 * limiter in the project. Lifting it into the helper keeps callers from
 * forgetting to set it.
 */
const RETRY_AFTER_SECONDS = 60

/**
 * Enforce a rate limit. Returns `null` when the request should proceed —
 * either because the binding is unset (local dev / vitest) or the limiter
 * allowed the request — and a fully-built 429 `Response` when it should not.
 *
 * Distinct `code` values per call site let the SPA branch on cause without
 * regex-matching the message, and are emitted as a structured log line so
 * 429s show up in Workers Logs without bespoke instrumentation per handler.
 */
export async function enforceRateLimit(
  binding: RateLimiter | undefined,
  key: string,
  code: string,
  cors: Record<string, string>,
): Promise<Response | null> {
  if (!binding) return null
  const { success } = await binding.limit({ key })
  if (success) return null

  console.warn(`[rate-limit] ${code} key=${key.slice(0, 8)}…`)

  return new Response(
    JSON.stringify({
      error: 'Too many requests — please slow down.',
      code,
    }),
    {
      status: 429,
      headers: {
        ...cors,
        'Content-Type': 'application/json',
        'Retry-After': String(RETRY_AFTER_SECONDS),
      },
    },
  )
}
