// ABOUT: Admin-only Worker handler — deletes a user's app data + auth row in one flow
// ABOUT: Verifies caller's JWT, checks is_admin(), calls admin_delete_user_data RPC, then Supabase Auth Admin API delete
// ABOUT: Closes TD-019 per ADR REFERENCE/decisions/2026-05-04-worker-mediated-account-erasure.md

/// <reference types="@cloudflare/workers-types" />

import type { Env } from '../generate-creature/index'
import { verifyJWT, JwksUnavailableError } from '../shared/jwt'

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

async function callIsAdmin(supabaseUrl: string, serviceKey: string, callerJwt: string): Promise<boolean> {
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
  if (!res.ok) return false
  const result = (await res.json()) as boolean | null
  return result === true
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
): Promise<{ ok: true } | { ok: false; detail: string }> {
  // Auth Admin API requires service-role key. This is the privileged step.
  const res = await fetch(`${supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(targetUserId)}`, {
    method: 'DELETE',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
  })
  // Supabase returns 200 for a successful delete; 404 means the auth row was
  // already absent (e.g. a partial-failure recovery retry) — treat as success.
  if (res.ok || res.status === 404) return { ok: true }
  const detail = await res.text()
  return { ok: false, detail: `Auth Admin API failed: ${res.status} ${detail}` }
}

export async function handleAdminDeleteUser(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin')

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

  try {
    await verifyJWT(callerJwt, env)
  } catch (err) {
    const correlationId = crypto.randomUUID()
    if (err instanceof JwksUnavailableError) {
      console.error(`[${correlationId}] JWKS unavailable: ${err.message}`)
      return json({ error: 'Auth provider unavailable', correlationId }, 503, origin)
    }
    console.error(`[${correlationId}] JWT verification failed: ${(err as Error).message}`)
    return json({ error: 'Invalid token', correlationId }, 401, origin)
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

  // Step 3: Authorise — caller must be admin
  const isAdmin = await callIsAdmin(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, callerJwt)
  if (!isAdmin) {
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
    console.error(`admin_delete_user_data failed: ${appDataResult.detail}`)
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
    console.error(`Auth Admin API delete failed: ${authResult.detail}`)
    return json(
      { ok: false, app_data: 'deleted', auth_user: 'failed', detail: authResult.detail },
      500,
      origin,
    )
  }

  return json({ ok: true, app_data: 'deleted', auth_user: 'deleted' }, 200, origin)
}
