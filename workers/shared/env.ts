// ABOUT: Shared Worker environment types — bindings, secrets, and rate-limiter shape
// ABOUT: Imported by every Worker handler so the binding surface lives in one place

/// <reference types="@cloudflare/workers-types" />

/**
 * Cloudflare ratelimit binding shape. The runtime returns `{ success: false }`
 * when the cap is exceeded; `simple` bindings only support periods of 10 or 60
 * seconds, so callers should pair the binding with a fixed `Retry-After` of 60
 * (see `enforceRateLimit` in `./rateLimit.ts`).
 */
export interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>
}

/**
 * Worker bindings + secrets.
 *
 * Optional rate-limit bindings stay optional so local `vitest` runs without
 * configured bindings still execute the handlers; production wrangler.toml
 * always provides them.
 */
export interface Env {
  ASSETS: Fetcher
  SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY: string
  // Optional — only required for legacy HS256-signed projects. Modern Supabase
  // projects sign with asymmetric keys and are verified via the JWKS endpoint.
  SUPABASE_JWT_SECRET?: string
  GEMINI_API_KEY: string
  ANTHROPIC_API_KEY: string
  CF_ACCOUNT_ID: string
  CF_IMAGES_TOKEN: string
  CF_IMAGES_DELIVERY_HASH: string
  RESEND_API_KEY: string

  // Comma-separated CORS allowlist. Set in wrangler.toml [vars]; falls back to
  // the canonical production origin when unset (see `workers/shared/cors.ts`).
  ALLOWED_ORIGINS?: string

  // Rate limiter bindings — see wrangler.toml for cap and namespace_id.
  CONTACT_RATE_LIMITER?: RateLimiter
  GENERATE_CREATURE_RATE_LIMITER?: RateLimiter
  GENERATE_CREATURE_GLOBAL_RATE_LIMITER?: RateLimiter
  ADMIN_DELETE_RATE_LIMITER?: RateLimiter
}
