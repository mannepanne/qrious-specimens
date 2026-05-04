# ADR: Worker-mediated account erasure for full GDPR Article 17 compliance

**Date:** 2026-05-04
**Status:** Active (implemented in [PR #83](https://github.com/mannepanne/qrious-specimens/pull/83) — TD-019 resolved)
**Supersedes:** N/A

---

## Decision

Close TD-019 by adding a Cloudflare Worker endpoint (`/api/admin-delete-user`) that wraps the existing `admin_delete_user_data` RPC and the Supabase Auth Admin API delete call into a single admin-driven flow. The frontend's `useGdprDelete` mutation is rewired to call this endpoint instead of the RPC directly. No self-service deletion path is built; an admin acting on a written user request remains the sole route.

## Context

The privacy policy as of [PR #79](https://github.com/mannepanne/qrious-specimens/pull/79) and the tone polish in [PR #81](https://github.com/mannepanne/qrious-specimens/pull/81) commits the project to:

> "Your sign-in record (which holds your email address) is removed in a separate administrative step shortly after deletion."

Today there is no such step. The admin "Delete Data" button at `src/pages/AdminPage.tsx:346-353` calls `useGdprDelete`, which calls `admin_delete_user_data(p_user_id)`. That RPC clears the user's profile, specimens, badges, activity, explorer profile, and de-identifies first-discoverer credits — but it does not touch `auth.users`, where the email lives. The auth row survives indefinitely. A user told their account is deleted is in fact partially deleted, and the email — the actual PII per GDPR Article 4 — is still queryable by anyone with service-role access.

The underlying obstacle is that `auth.users` lives in the `auth` schema, owned by Supabase. Cross-schema deletion from a `SECURITY DEFINER` function in `public` requires the function owner to have `DELETE` on `auth.users`, which is true for the `postgres` role but not for `anon`/`authenticated`. Reaching into `auth` from app SQL is also fragile across Supabase platform upgrades.

Closing this gap is the highest-value tech-debt item for launch readiness because:
- It directly enforces a privacy-policy commitment we have already shipped.
- The privacy-page audit relies on this being closed for the "we erase your email" promise to be defensible.
- Forgotten or partially-failed Admin API calls leave stranded `auth.users` rows that a future audit cannot easily distinguish from active accounts.

## Alternatives considered

- **Admin runbook only.** Document a manual two-step protocol in the admin runbook ("after clicking Delete Data, call `auth.admin.deleteUser` via Supabase Studio").
  - Why not: relies on discipline, not enforcement; CI cannot verify it; a forgotten step quietly violates the policy commitment we just made; there is no audit trail tying app-data deletion to auth-row deletion.

- **Postgres `SECURITY DEFINER` function reaching into `auth` schema.** Re-issue `admin_delete_user_data` (or add a sibling function) that also runs `DELETE FROM auth.users WHERE id = p_user_id`. Possible because the `postgres` role has `DELETE` on `auth.users`.
  - Why not: the `auth` schema is Supabase's territory. Operating on `auth.users` from app SQL is unidiomatic and exposes us to schema changes across Supabase platform upgrades. It also bypasses any auth-side hooks Supabase may run on user deletion (session revocation, audit logging in `auth.audit_log_entries`). Brittle, opaque, and hard to test.

- **Frontend calls Supabase Admin API directly.** The browser holds the user's anon JWT; route the second call to `auth.admin.deleteUser` from the React side after the RPC succeeds.
  - Why not: the Admin API requires the service-role key, which must never reach the browser. The whole reason for any Worker route is that this key is bound only in the Worker environment.

- **Chosen — Worker endpoint that wraps both calls.** A new Cloudflare Worker route that verifies the caller's JWT, confirms admin status, calls the RPC, then calls the Admin API, returning a structured result that surfaces partial failure clearly.

## Reasoning

**The Worker is already the right boundary for service-role operations.** The contact form Worker (`workers/contact/index.ts`) already uses `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS on writes. Account deletion is the same shape of problem: an operation that requires elevated privilege, must not run in the browser, and benefits from server-side authorisation checks before it executes.

**The JWT verification primitive already exists.** `verifyJWT` in `workers/generate-creature/index.ts:188` (per ADR [2026-04-20-jwks-jwt-verification.md](./2026-04-20-jwks-jwt-verification.md)) verifies Supabase ES256/RS256 tokens via JWKS with per-isolate cache and kid-miss refetch. The new endpoint can lift this pattern with no extra infrastructure. Admin status is then a single round-trip `is_admin()` RPC call (already SECURITY DEFINER, already hardened with `SET search_path = public` per TD-020 resolution).

**Failure modes are explicit and recoverable.** The two calls run sequentially (RPC first, Admin API second) and the response shape distinguishes the four states: both succeeded, both failed, app-data succeeded but auth failed, app-data failed (auth not attempted). A partial failure is loud — the admin sees the precise step that failed in the toast, can retry, and the audit is unambiguous. Compare with the runbook approach where a missed manual step leaves no trace.

**Atomicity is not the right goal here.** True transactional atomicity across Postgres and the Supabase Auth Admin API is not achievable — they are separate systems. The runbook approach fakes atomicity through discipline; the Postgres-cross-schema approach fakes it through privilege escalation. The Worker approach is honest: two systems, two calls, surface the result. In practice the failure mode is rare and recovery is a one-line retry.

**Bounded scope, no UI rebuild.** The frontend change is one mutation rewired from `supabase.rpc(...)` to `fetch(...)`. The admin dashboard's confirm dialog stays as-is. No SettingsPage changes — self-service deletion is a separate UX surface with its own threat-model considerations and is out of scope.

## Trade-offs accepted

**Two network hops where there used to be one.** Browser → Worker → Postgres + Browser → Worker → Auth API. Latency goes up by perhaps 100–300 ms. Acceptable: this is a destructive admin operation, not a hot path; the user is already mid-confirmation-dialog.

**Worker becomes another deployment unit.** Adds one more thing to monitor and one more secret to keep in sync. Mitigated by reusing the existing `wrangler.toml` route pattern, the existing `SUPABASE_SERVICE_ROLE_KEY` binding, and the existing JWKS verifier — no new infrastructure, just a new handler.

**Partial-failure recovery requires admin attention.** If the Admin API call fails after the RPC succeeds, the admin must retry from the dashboard (or, if the user was already removed from `profiles`, run the Admin API call directly). The mitigation is a periodic audit query (orphan `auth.users` rows whose `id` is missing from `profiles`) — small, cheap, will live naturally in the pgTAP harness once TD-021 lands.

**No self-service deletion.** Users requesting deletion still go through the contact form. This was a deliberate constraint at the start of TD-019 work — self-service deletion is a different UX problem (confirmation flow, account-recovery considerations, threat model around compromised sessions). Reserving that for a future spec keeps this PR focused.

**Service-role exposure surface grows by one route.** Today the service-role key is only invoked from the contact Worker (single-write contact_messages insert). Adding a deletion route widens the blast radius of a Worker compromise from "an attacker can spam contact_messages" to "an attacker can also delete arbitrary users". Mitigated by the JWT-based admin gate before any service-role call runs. Worth flagging in the PR review.

## Implications

**Enables:**
- Honest enforcement of the privacy-policy commitment: clicking "Delete Data" actually deletes the user, including the email.
- A periodic audit query (orphan auth.users) becomes meaningful — today such an audit would always return rows because every "deleted" user is an orphan.
- Future self-service deletion can reuse this endpoint with a `caller=self` mode (skip the admin check, take the caller's own `sub` as the target) without re-architecting.

**Prevents:**
- Forgotten or skipped follow-up Admin API calls (the dominant failure mode of the runbook approach).
- Unintentional reliance on the `auth` schema's deletion semantics in app SQL.

**Does not change:**
- The `admin_delete_user_data` RPC contract — the Worker calls it unchanged.
- The admin dashboard UX — same confirm dialog, same "Delete Data" button.
- The contact-form Worker — independent route, independent failure modes.

## Endpoint contract (sketch)

```
POST /api/admin-delete-user
Authorization: Bearer <caller's anon JWT>
Content-Type: application/json

{ "user_id": "uuid" }
```

**Worker steps:**
1. Verify JWT via `verifyJWT` (JWKS), extract `sub`.
2. Call `is_admin()` RPC with the caller's JWT (so the RPC sees the right `auth.uid()`).
3. If not admin, return 403.
4. Call `admin_delete_user_data(p_user_id)` (with the caller's JWT — preserves the in-RPC `is_admin()` re-check, defence in depth).
5. Call `DELETE {SUPABASE_URL}/auth/v1/admin/users/{user_id}` with `SUPABASE_SERVICE_ROLE_KEY`.
6. Return:
   - `200 { ok: true, app_data: 'deleted', auth_user: 'deleted' }` — both succeeded.
   - `500 { ok: false, app_data: 'deleted', auth_user: 'failed', detail }` — partial failure.
   - `500 { ok: false, app_data: 'failed', detail }` — RPC failed; auth not attempted.
   - `403 { error: 'Not authorised' }` — caller is not admin.

**Frontend change:** `useGdprDelete` becomes a `fetch` to this endpoint. The mutation's error path now distinguishes partial vs total failure in the toast.

## Sequencing

1. **This ADR merged** — captures the decision before any code is written.
2. **Implementation PR** introduces the Worker, wires the frontend, adds Worker tests (mock JWKS + mocked fetch for RPC and Admin API), updates `REFERENCE/technical-debt.md` to mark TD-019 resolved, updates the admin runbook if one exists.
3. **Future** — pgTAP harness (TD-021) adds the orphan-`auth.users` audit assertion as a smoke check.
4. **Future, separate spec** — if self-service deletion is ever wanted, extend this endpoint with a `caller=self` mode rather than building a parallel path.

## References

- TD-019 (open — implementation of this ADR): `REFERENCE/technical-debt.md`
- TD-018 (resolved): `supabase/migrations/20260504000000_admin_delete_anonymises_first_discoverer.sql`
- TD-020 (resolved): `supabase/migrations/20260504000001_phase8_admin_search_path_hardening.sql`
- TD-021 (open): pgTAP harness ADR — [`2026-05-04-pgtap-smoke-suite.md`](./2026-05-04-pgtap-smoke-suite.md)
- JWT verification primitive: ADR [`2026-04-20-jwks-jwt-verification.md`](./2026-04-20-jwks-jwt-verification.md), implementation `workers/generate-creature/index.ts:188`
- Threat-model context: [`2026-04-25-pr-review-threat-model.md`](./2026-04-25-pr-review-threat-model.md)
- Privacy policy commitment: PR #79, PR #81 (in `src/pages/PrivacyPage.tsx`, "How long we keep your data" section)
- [Supabase Auth Admin API — Delete user](https://supabase.com/docs/reference/javascript/auth-admin-deleteuser)
