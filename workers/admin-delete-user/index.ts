// ABOUT: Admin-only Worker handler — deletes a user's app data + auth row in one flow
// ABOUT: Verifies caller's JWT, rate-limits, blocks self-delete, checks is_admin(), calls admin_delete_user_data RPC, then Supabase Auth Admin API delete
// ABOUT: Emits structured admin_delete_user audit lines on success / partial_failure / rejected_self / rejected_not_admin / rate_limited (TD-022, TD-023, TD-025)
// ABOUT: Closes TD-019 per ADR REFERENCE/decisions/2026-05-04-worker-mediated-account-erasure.md

/// <reference types="@cloudflare/workers-types" />

import type { Env } from '../shared/env'
import { verifyJWT, JwksUnavailableError } from '../shared/jwt'
import { enforceRateLimit } from '../shared/rateLimit'

interface DeleteBody {
  user_id?: string
}

// UUID v4-ish format check — Supabase auth.users.id values are always UUIDs.
// Loose enough to allow any RFC 4122 variant; strict enough to reject path
// traversal and obvious injection attempts before they hit Supabase.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = ['https://qrious.hultberg.org', 'http://localhost:5173']
  const allowedOrigin = origin && allowed.includes(origin) ? origin : allowed[0]
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }
}

function json(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
  })
}

// Structured audit line for irreversible admin operations and the rejection
// branches that gate them. Single-line JSON so Cloudflare Workers Logs can index
// fields. `target_user_id` is optional because rate-limited rejections fire
// before the body is parsed; `app_data` / `auth_user` are only present on the
// branches that actually mutated state. Closes TD-022; extended to rejection
// branches for TD-023 / TD-025 follow-up.
function logAdminDeleteAudit(fields: {
  outcome: 'success' | 'partial_failure' | 'rejected_self' | 'rejected_not_admin' | 'rate_limited'
  caller_sub: string
  correlation_id: string
  target_user_id?: string
  app_data?: 'deleted'
  auth_user?: 'deleted' | 'absent' | 'failed'
  detail?: string
}): void {
  console.log(
    JSON.stringify({
      event: 'admin_delete_user',
      timestamp: new Date().toISOString(),
      ...fields,
    }),
  )
}

type IsAdminResult =
  | { kind: 'ok'; isAdmin: boolean }
  | { kind: 'upstream_error'; status: number; detail: string }

async function callIsAdmin(
  supabaseUrl: string,
  serviceKey: string,
  callerJwt: string,
): Promise<IsAdminResult> {
  // Caller's JWT in Authorization populates auth.uid() inside the SECURITY DEFINER
  // function; service-role apikey just identifies the project to PostgREST.
  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/is_admin`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${callerJwt}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  })
  // Distinguish upstream-unavailable from genuinely-not-admin so the caller
  // sees a 503 (retryable) rather than a confusing 403. Closes TD-025.
  if (res.status >= 500) {
    const detail = await res.text().catch(() => '')
    return { kind: 'upstream_error', status: res.status, detail }
  }
  if (!res.ok) return { kind: 'ok', isAdmin: false }
  const result = (await res.json()) as boolean | null
  return { kind: 'ok', isAdmin: result === true }
}

async function callAdminDeleteUserData(
  supabaseUrl: string,
  serviceKey: string,
  callerJwt: string,
  targetUserId: string,
): Promise<{ ok: true } | { ok: false; detail: string }> {
  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/admin_delete_user_data`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${callerJwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_user_id: targetUserId }),
  })
  if (!res.ok) {
    const detail = await res.text()
    return { ok: false, detail: `RPC failed: ${res.status} ${detail}` }
  }
  return { ok: true }
}

async function callAuthAdminDeleteUser(
  supabaseUrl: string,
  serviceKey: string,
  targetUserId: string,
): Promise<{ ok: true; status: 'deleted' | 'absent' } | { ok: false; detail: string }> {
  // Auth Admin API requires service-role key. This is the privileged step.
  const res = await fetch(`${supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(targetUserId)}`, {
    method: 'DELETE',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
  })
  // Supabase returns 200 for a successful delete; 404 means the auth row was
  // already absent (e.g. a partial-failure recovery retry) — treat as success
  // but distinguish in the audit log so the trail-of-work is recoverable.
  if (res.ok) return { ok: true, status: 'deleted' }
  if (res.status === 404) return { ok: true, status: 'absent' }
  const detail = await res.text()
  return { ok: false, detail: `Auth Admin API failed: ${res.status} ${detail}` }
}

export async function handleAdminDeleteUser(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin')
  const correlationId = crypto.randomUUID()

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) })
  }
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405, origin)
  }

  // Step 1: Verify JWT
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ error: 'Missing or malformed Authorization header' }, 401, origin)
  }
  const callerJwt = authHeader.slice(7)

  let callerSub: string
  try {
    const payload = await verifyJWT(callerJwt, env)
    callerSub = payload.sub
  } catch (err) {
    if (err instanceof JwksUnavailableError) {
      console.error(`[${correlationId}] JWKS unavailable: ${err.message}`)
      return json({ error: 'Auth provider unavailable', correlationId }, 503, origin)
    }
    console.error(`[${correlationId}] JWT verification failed: ${(err as Error).message}`)
    return json({ error: 'Invalid token', correlationId }, 401, origin)
  }

  // Step 1.5: Rate limit per admin caller. Applied before is_admin so a stolen
  // session can't burn RPC capacity probing for admin status; legitimate admins
  // doing a multi-user cleanup stay well below the cap.
  const rateLimited = await enforceRateLimit(
    env.ADMIN_DELETE_RATE_LIMITER,
    callerSub,
    'rate_limit_admin_delete',
    corsHeaders(origin),
  )
  if (rateLimited) {
    logAdminDeleteAudit({
      outcome: 'rate_limited',
      caller_sub: callerSub,
      correlation_id: correlationId,
    })
    return rateLimited
  }

  // Step 2: Parse body
  let body: DeleteBody
  try {
    body = (await request.json()) as DeleteBody
  } catch {
    return json({ error: 'Invalid JSON body' }, 400, origin)
  }

  const targetUserId = body.user_id
  if (!targetUserId || !UUID_RE.test(targetUserId)) {
    return json({ error: 'Missing or malformed user_id' }, 400, origin)
  }

  // Step 2.5: Self-delete guard. Removing the calling admin would lock the
  // project out of its own admin surface (recovery requires direct DB access
  // via Supabase Studio to flip is_admin = true on a freshly-seeded account).
  // Belt-and-braces with the UI guard in AdminPage and the RAISE EXCEPTION
  // in admin_delete_user_data. Closes TD-023.
  // Compare case-insensitively: UUID_RE allows mixed case, and JWT subs from
  // different sources may serialise the same UUID with different casing.
  if (callerSub.toLowerCase() === targetUserId.toLowerCase()) {
    logAdminDeleteAudit({
      outcome: 'rejected_self',
      caller_sub: callerSub,
      target_user_id: targetUserId,
      correlation_id: correlationId,
    })
    return json(
      { error: 'Cannot delete the calling admin', code: 'self_delete_blocked' },
      400,
      origin,
    )
  }

  // Step 3: Authorise — caller must be admin
  const adminResult = await callIsAdmin(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, callerJwt)
  if (adminResult.kind === 'upstream_error') {
    console.error(
      `[${correlationId}] is_admin upstream ${adminResult.status}: ${adminResult.detail}`,
    )
    return json(
      { error: 'Auth check temporarily unavailable, please retry', code: 'auth_check_unavailable', correlationId },
      503,
      origin,
    )
  }
  if (!adminResult.isAdmin) {
    logAdminDeleteAudit({
      outcome: 'rejected_not_admin',
      caller_sub: callerSub,
      target_user_id: targetUserId,
      correlation_id: correlationId,
    })
    return json({ error: 'Not authorised' }, 403, origin)
  }

  // Step 4: Delete app data via RPC. The RPC re-checks is_admin() internally
  // (defence in depth — caller's JWT is what populates auth.uid()).
  const appDataResult = await callAdminDeleteUserData(
    env.SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    callerJwt,
    targetUserId,
  )
  if (!appDataResult.ok) {
    console.error(`[${correlationId}] admin_delete_user_data failed: ${appDataResult.detail}`)
    return json(
      { ok: false, app_data: 'failed', detail: appDataResult.detail },
      500,
      origin,
    )
  }

  // Step 5: Delete the auth row via Admin API. Two systems, two calls — partial
  // failure surfaces in the response shape rather than being faked through
  // discipline (runbook) or privilege escalation (Postgres cross-schema
  // function). See ADR 2026-05-04-worker-mediated-account-erasure.md.
  const authResult = await callAuthAdminDeleteUser(
    env.SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    targetUserId,
  )
  if (!authResult.ok) {
    console.error(`[${correlationId}] Auth Admin API delete failed: ${authResult.detail}`)
    logAdminDeleteAudit({
      outcome: 'partial_failure',
      caller_sub: callerSub,
      target_user_id: targetUserId,
      app_data: 'deleted',
      auth_user: 'failed',
      correlation_id: correlationId,
      detail: authResult.detail,
    })
    return json(
      { ok: false, app_data: 'deleted', auth_user: 'failed', detail: authResult.detail },
      500,
      origin,
    )
  }

  logAdminDeleteAudit({
    outcome: 'success',
    caller_sub: callerSub,
    target_user_id: targetUserId,
    app_data: 'deleted',
    auth_user: authResult.status,
    correlation_id: correlationId,
  })

  return json({ ok: true, app_data: 'deleted', auth_user: 'deleted' }, 200, origin)
}
