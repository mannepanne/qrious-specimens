# Technical Debt Tracker

**When to read this:** Planning refactors, reviewing known issues, or documenting accepted shortcuts.

**Related Documents:**
- [CLAUDE.md](./../CLAUDE.md) - Project navigation index
- [testing-strategy.md](./testing-strategy.md) - Testing strategy
- [troubleshooting.md](./troubleshooting.md) - Common issues and solutions

---

Tracks known limitations, shortcuts, and deferred improvements in the codebase.
Items here are accepted risks or pragmatic choices made during development, not bugs.

---

## Active technical debt

### TD-001: Phase 1 committed directly to main
- **Location:** Git history — all Phase 1 commits
- **Issue:** The bootstrapping work (infrastructure setup, Supabase schema, Vite scaffold, first deployment) was committed directly to `main` with no feature branches or PRs. This violated the project's core workflow rule.
- **Why accepted:** Pragmatic exception for initial project bootstrapping — there was no established `main` to branch from, no collaborators, and the work was foundational rather than incremental. Reviewed post-hoc via `/review-pr`.
- **Risk:** Low — the code has been reviewed. The risk is habit-setting: this must not become a pattern.
- **Future fix:** No code change needed. From Phase 2 onwards, all work uses feature branches + PRs without exception. Zero exceptions.
- **Phase introduced:** Phase 1

---

### TD-002: Cabinet specimen list snapshotted at navigation time
- **Location:** `src/pages/CabinetPage.tsx` — `handleViewCreature()` (passes `cabinetCreatures` via React Router `state`); `src/pages/SpecimenPage.tsx` — reads `state.cabinetCreatures`
- **Issue:** Opening a specimen from the cabinet passes the current `allCreatures` list into the route's location state. Subsequent infinite-scroll fetches in `CabinetPage` don't propagate to the open `SpecimenPage`, so prev/next navigation operates on the snapshot — creatures loaded after navigation are unreachable via the arrows.
- **Why accepted:** Requires a more involved refactor (lifting creature state to a shared query, or having `SpecimenPage` re-derive neighbours from the live infinite-query data). The failure mode is invisible to users with small cabinets (< 30 specimens). Will become noticeable only once pagination is common.
- **Risk:** Low — no data loss, no corruption. Worst case: prev/next navigation ends at the last creature in the snapshot.
- **Future fix:** Have `SpecimenPage` consume `useCreatures(userId)` directly and derive prev/next from the live query, falling back to the location-state snapshot only when not yet hydrated.
- **Phase introduced:** Phase 3

---

### TD-003: R2 image variants store original bytes (no actual pixel resize) — RESOLVED 2026-04-20
- **Status:** Resolved by migration to Cloudflare Images. See [ADR 2026-04-20](./decisions/2026-04-20-cloudflare-images-over-r2.md).
- **Resolution:** CF Images serves properly resized `qrious512` and `qrious256` variants at the CDN edge from a single uploaded original; R2 variant logic removed.
- **Phase introduced:** Phase 4

---

### TD-004: No rate limiting on `/api/generate-creature` — RESOLVED 2026-05-04
- **Status:** Resolved by adding `GENERATE_CREATURE_RATE_LIMITER` (Cloudflare ratelimit binding) keyed on the verified Supabase JWT `sub`, plus `GENERATE_CREATURE_GLOBAL_RATE_LIMITER` as a Sybil-amplification backstop. Both checks run immediately after JWT verification — before the species_images cache lookup — so cache hits also count, which bounds total request volume against credential-replay, scripted-scan, and many-account abuse alike.
- **Resolution detail:** Per-user cap is 5/60s; global cap is 100/60s with a constant key. The original future-fix targeted "10/hour" but the `simple` ratelimit binding only accepts `period` 10 or 60 seconds; per-minute is the tightest practical setting. 5/min is well above legitimate physical-scan cadence (1–2/min) and still throttles a script to ~5× normal traffic. If we later need a true hourly cap we'd switch to a KV-backed sliding window.
- **Phase introduced:** Phase 4

---

### TD-005: R2 orphan images from TOCTOU race — RESOLVED 2026-04-20
- **Status:** Resolved by migration to Cloudflare Images. See [ADR 2026-04-20](./decisions/2026-04-20-cloudflare-images-over-r2.md).
- **Resolution:** CF Images uses `qr_hash` as the custom image ID, so concurrent uploads collapse on a single object (duplicate ID is treated as success). No orphans possible.
- **Phase introduced:** Phase 4

---

### TD-006: `register_discovery` RPC accepts arbitrary `p_user_id` without auth check — RESOLVED 2026-04-25
- **Status:** Resolved by `supabase/migrations/20260425000003_register_discovery_revoke_public_execute.sql`. The "restrict to service role" alternative from the original future-fix was taken: `REVOKE EXECUTE ... FROM PUBLIC, authenticated, anon` and `GRANT EXECUTE ... TO service_role`. The direct-client spoof path is closed; only the Worker (which holds the service-role key and passes a JWT-verified `userId`) can call the function.
- **Phase introduced:** Phase 4 (identified during review; function pre-existed)

---

### ~~TD-007~~: JWT `alg` header not validated
- **Status:** Resolved 2026-04-20 in PR #47. `verifyJWT()` now dispatches on `alg` with a whitelist (HS256, ES256, RS256) and throws `Unsupported JWT alg` for anything else. Each branch pulls key material from a structurally distinct source (HS256 from `SUPABASE_JWT_SECRET`, ES256/RS256 from the JWKS endpoint), closing the algorithm-confusion attack vector. See [ADR 2026-04-20-jwks-jwt-verification](./decisions/2026-04-20-jwks-jwt-verification.md).

---

### TD-008: Gemini API key appears in URL query parameter
- **Location:** `workers/generate-creature/gemini.ts` — `callGenerateContent()`
- **Issue:** Google's Gemini API requires the API key as a `?key=` URL query parameter. This means the key appears in outbound request URLs, which will show in Cloudflare request logs if logging is enabled on the account.
- **Why accepted:** No alternative within Google's API design — there is no header-based authentication option for the v1beta REST API. The key is a Cloudflare Worker secret (not committed to source), so exposure is limited to log access.
- **Risk:** Low — Cloudflare Worker logs are not public. Risk is proportional to who has access to Cloudflare account logs.
- **Future fix:** If Google adds header-based auth, migrate. Until then: ensure Cloudflare Workers Logs are restricted to admin access only, and rotate the key if log access is ever compromised.
- **Phase introduced:** Phase 4

---

### TD-009: Worker error responses include internal `detail` field
- **Location:** `workers/generate-creature/index.ts` — error `json()` responses (e.g. lines 188, 238, 248)
- **Issue:** Error responses from the Worker include a `detail` field containing the raw exception message (e.g. `"detail": "Gemini API failed (429): Rate limit exceeded"`). This is useful for debugging but leaks internal implementation details if ever surfaced to users.
- **Why accepted:** The frontend currently ignores the `detail` field entirely — it only reads `imageUrl`, `fieldNotes`, etc. The detail is only visible to someone inspecting network traffic with DevTools.
- **Risk:** Low — not surfaced to users today. Becomes a real concern if error toasts are ever made more verbose or if `detail` is forwarded anywhere.
- **Future fix:** If richer error feedback is ever added to the UI, always show a generic user-facing message (e.g. "The illustration could not be captured") and keep `detail` for console logging only, never for display.
- **Phase introduced:** Phase 4

---

### TD-010: `http://localhost:5173` in production CORS allowlist
- **Location:** `workers/generate-creature/index.ts` — `corsHeaders()`; `workers/contact/index.ts` — inline `allowed` list
- **Issue:** The CORS allowlist includes `http://localhost:5173` in production on both Workers. This allows a local dev server to make cross-origin requests to the production Workers. The generate-creature Worker still requires a valid Supabase JWT (no auth bypass); the contact Worker is a public form protected by per-IP rate limiting and a server-side honeypot, so CORS hygiene is the only concern there.
- **Why accepted:** Convenient for development against the production Workers when local Cloudflare dev isn't practical. CORS protects browsers, not direct HTTP clients (curl, scripts), so the localhost entry adds no real attack surface.
- **Risk:** Informational — no practical security impact.
- **Future fix:** Move the allowlist to an `ALLOWED_ORIGINS` environment variable so localhost is excluded from the production Wrangler deployment automatically. Apply to both Workers when fixed.
- **Phase introduced:** Phase 4 (generate-creature); Phase 9 (contact)

---

### TD-011: Catalogue pagination window-function drift
- **Location:** `src/hooks/useCatalogue.ts` — `getNextPageParam`; `supabase/migrations/20260411000000_add_catalogue_filtering.sql` — `COUNT(*) OVER ()`
- **Issue:** `total_count` is a Postgres window function re-evaluated on every page fetch. If a new species is discovered between fetching page 1 and page 2, `total_count` on page 2 is one higher than page 1. This can cause `getNextPageParam` to load an extra page (resulting in an empty final page) or — in the reverse case — miss the last item. The UX impact is invisible to almost all users.
- **Why accepted:** Inherent limitation of cursor-free keyset pagination with a live dataset. Fixing it properly requires either a stable cursor (e.g. `WHERE created_at > last_seen`) or a snapshot count stored at session start. Both add complexity that isn't justified at current scale.
- **Risk:** Low — no data loss, no incorrect display. Worst case is an extra empty load-more request.
- **Future fix:** Switch to keyset pagination using `first_discovered_at` + `qr_hash` as a stable cursor, or snapshot `total_count` into component state on the first page load and use that for all subsequent `getNextPageParam` calls.
- **Phase introduced:** Phase 5

---

### TD-012: `rare_discovery` event type defined but never posted

- **Location:** `src/App.tsx` — `finishExcavation()`; `src/hooks/useCommunity.ts` — `FeedEntry`; `supabase/migrations/20260412000000_phase6_gazette.sql` — `activity_feed` CHECK constraint
- **Issue:** The `rare_discovery` event type exists in the DB CHECK constraint, TypeScript types, and `ActivityTimeline` rendering (amber dot) — but nothing posts it. The frontend posts either `discovery` or `first_discovery` at excavation time and does not check species rarity. Amber dots will never appear in the feed.
- **Why accepted:** Rarity at excavation time requires a DB lookup (checking `species_discoveries.discovery_count` post-insert) that adds latency to the scan flow. Phase 6 focused on the basic feed structure; rarity-aware posting is natural Phase 7 scope when the discovery flow is revisited for badge toasts.
- **Risk:** Low — no data loss or broken UI. Feed entries are simply slightly less colourful until fixed.
- **Future fix:** After `addCreature.mutateAsync` resolves, fetch `species_discoveries.discovery_count` for the new `qr_hash`. If ≤ 3, post `rare_discovery`; if it was the first, post `first_discovery`. Phase 7 revisits the post-excavation flow for badge toasts anyway.
- **Phase introduced:** Phase 6

---

### TD-013: Cross-tab species auto-open fails for species beyond loaded catalogue pages — RESOLVED
- **Status:** Resolved structurally when species navigation moved to URL-based routing (`/species/:qrHash`). The proposed-future-fix RPC `get_species_by_hash(p_qr_hash text)` shipped in `supabase/migrations/20260412000001_get_species_by_hash.sql` and now backs the species route directly, so any qr_hash resolves regardless of how many catalogue pages are loaded. The `selectedSpeciesHash` / `selectedCatalogueHash` / `onSpeciesViewed` plumbing this entry described no longer exists in the codebase.
- **Phase introduced:** Phase 6

---

### TD-014: `activity_feed` has no DELETE RLS policy (GDPR gap)

- **Location:** `supabase/migrations/20260412000000_phase6_gazette.sql` — `activity_feed` table RLS policies
- **Issue:** Users can insert and read their own activity entries but cannot delete them. Going private hides entries from others (RLS), but the rows remain in the table. Phase 8 GDPR export/delete must cover this.
- **Why accepted:** Deleting activity is not a Phase 6 user-facing feature. Hiding via `is_public = false` satisfies the privacy requirement for now.
- **Risk:** Low — no data loss to users, but non-compliant with GDPR right to erasure until Phase 8 resolves it.
- **Future fix:** Add `CREATE POLICY "Delete own activity" ON public.activity_feed FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()))` in the Phase 8 GDPR migration, alongside the full account-delete flow.
- **Phase introduced:** Phase 6

---

### TD-018: Account deletion does not anonymise `species_discoveries.first_discoverer_id` — RESOLVED 2026-05-04

- **Status:** Resolved for the first-discoverer-credit scope by `supabase/migrations/20260504000000_admin_delete_anonymises_first_discoverer.sql`. Account-level erasure of `auth.users` (which holds the email) remains a separate admin step per Phase 8 design — tracked as TD-019.
- **Resolution:** `admin_delete_user_data()` now nulls `first_discoverer_id` on both `species_discoveries` and `species_images` for the deleted user before removing the profile row. The same migration backfills orphaned references left by earlier deletions performed under the previous RPC. UI null-handling was already correct (`useFirstDiscoverer` returns null via `maybeSingle()`; `SpeciesDetail` guards on `firstDiscovererName` before rendering the "FIRST BY" credit), so no UI change was needed.
- **Phase introduced:** Phase 9 (identified during Privacy page review)

---

### TD-019: Account deletion does not erase `auth.users` row (full GDPR Article 17) — RESOLVED 2026-05-04

- **Status:** Resolved by Worker-mediated erasure endpoint at `POST /api/admin-delete-user` (`workers/admin-delete-user/index.ts`), wired from the admin dashboard via `useGdprDelete`. See [ADR 2026-05-04 worker-mediated account erasure](./decisions/2026-05-04-worker-mediated-account-erasure.md).
- **Resolution:** Single admin-gated Worker route runs `admin_delete_user_data` RPC followed by Supabase Auth Admin API `DELETE /auth/v1/admin/users/{id}`. JWT verification + server-side `is_admin()` re-check guard the endpoint; service-role key never reaches the browser. Two-system non-atomicity is surfaced in the response shape (`app_data`, `auth_user` phase fields) so the dashboard can render specific recovery guidance on partial failure rather than a generic "delete failed" message. A retry after manual cleanup is safe — the Auth Admin API returning 404 is treated as success. JWT helpers were extracted to `workers/shared/jwt.ts` for reuse. Worker tests in `workers/admin-delete-user/index.test.ts` cover OPTIONS/method handling, JWT validation, UUID validation, the is_admin gate (asserting the caller's JWT is forwarded — not service-role), RPC failure, partial-failure shape, happy path, and the 404 recovery scenario.
- **Phase introduced:** Phase 8 (pre-existing); promoted to TD during PR #78 review

---

### TD-020: Phase 8 admin RPC cluster lacks explicit `SET search_path = public` — RESOLVED 2026-05-04

- **Status:** Resolved by `supabase/migrations/20260504000001_phase8_admin_search_path_hardening.sql` (and `SET search_path = public` added to `admin_delete_user_data` in the TD-018 migration). All five Phase 8 admin RPCs (`is_admin`, `admin_list_users`, `admin_export_user_data`, `admin_delete_user_data`, `admin_get_stats`) now carry the setting, matching the Phase 6 / Phase 9 convention.
- **Resolution:** Single dedicated sweep migration re-issued the four remaining admin RPCs with `SET search_path = public`. No behavioural change; GRANTs survived `CREATE OR REPLACE`. Verified by reading the resulting `pg_proc.proconfig` rows; future regressions can be caught by the pgTAP harness once TD-021 lands.
- **Phase introduced:** Phase 8 (identified during PR #78 review)

---

### TD-021: No database-level test harness for `SECURITY DEFINER` RPCs and RLS policies

- **Location:** `supabase/migrations/*.sql` — eleven `SECURITY DEFINER` RPCs across Phases 4, 5, 6, 8, 9; RLS policies on `profiles`, `creatures`, `activity_feed`, `explorer_profiles`, `contact_messages`
- **Issue:** Vitest hook tests (`useAdmin.test.ts`, `useCommunity.test.ts`) mock the Supabase client and verify the *frontend calls the right RPC with the right shape*, but no test asserts on what the RPC actually does. The current safety net for an RPC behavioural regression — wrong column reference, missed FK, broken `COALESCE` fallback, search_path injection — is manual post-deploy smoke testing. RLS policies are entirely untested.
- **Why accepted:** Acceptable through Phase 8 because the RPC surface was small and deployments were infrequent; PR #78 (TD-018) raised the visibility of the gap. Setting up the harness is real work (~half a day) and Phase 9 has more user-visible launch-critical work in flight.
- **Risk:** Medium — increases as the RPC surface grows. A silent regression in `admin_delete_user_data` or any `get_*` RPC ships to production until a manual smoke test catches it. Particularly load-bearing once public sign-ups open.
- **Future fix:** Adopt pgTAP per ADR `REFERENCE/decisions/2026-05-04-pgtap-smoke-suite.md`. Single dedicated PR introduces `supabase/tests/setup.sql` + `supabase/tests/admin_rpcs.sql` (~50–80 lines covering the six smoke assertions in the ADR), wires `pg_prove` into a GitHub Actions step against a `postgres:16` container with the `pgtap` extension, and updates `REFERENCE/testing-strategy.md` to point to the SQL test path. From that PR onwards, every migration that adds or changes an RPC adds (or extends) a pgTAP test in the same PR. Sequenced after Phase 9 user-facing work, before public launch.
- **Phase introduced:** Phase 9 (gap surfaced during PR #78 review)

---

### TD-022: No success-path audit log for destructive admin operations

- **Location:** `workers/admin-delete-user/index.ts` — `handleAdminDeleteUser()`
- **Issue:** The Worker only writes to `console.error` on failure. Successful admin deletions (the privileged, two-system, irreversible path) leave no log line — no `{caller_sub, target_user_id, outcome, timestamp}` record. Post-hoc audits of "who was deleted, by whom, when" require correlating Supabase Auth Admin API logs with Postgres traces, which is brittle. The convergent finding from PR #83's team review (flagged independently by security, architect, and product reviewers).
- **Why accepted:** No second admin exists today; the single trusted contributor is the only caller. Audit value compounds once a second admin is added or once the deletion path is exposed beyond the dashboard.
- **Risk:** Low for the current single-admin model; Medium once a second admin appears or the project takes external GDPR requests.
- **Future fix:** On the success path (after both `admin_delete_user_data` and the Auth Admin API call complete), log a structured line with `{caller_sub, target_user_id, app_data: 'deleted', auth_user: 'deleted'|'absent', timestamp, correlation_id}`. Same on partial failure (already logged on full failure). Cheapest landing spot: Cloudflare Workers Logs with a JSON-line format. Companion to ADR 2026-05-04 (which defers the orphan-`auth.users` audit query to TD-021's pgTAP harness).
- **Phase introduced:** Phase 8 (admin endpoint added in PR #83)

---

### TD-023: Admin can delete themselves (and lock out the project)

- **Location:** `workers/admin-delete-user/index.ts` — request handler; `supabase/migrations/*` — `admin_delete_user_data` RPC
- **Issue:** Neither the Worker nor the RPC blocks `targetUserId === caller.sub`. An admin deleting themselves removes their own profile + `auth.users` row; with a single admin, this locks the project out of its own admin surface (no UI path to restore `is_admin = true`). Operational footgun, not a security vulnerability.
- **Why accepted:** Single trusted contributor, manually issuing each delete. The footgun is theoretical until a second admin or a less-careful caller appears.
- **Risk:** Low under current single-admin manual-flow model; High blast radius if it triggers (recovery requires direct DB access via Supabase Studio to set `is_admin = true` on a freshly-created account).
- **Future fix:** Cheap defence — `if (callerSub === targetUserId) return 400 'cannot delete the calling admin'` in the Worker, and/or guard at the dialog layer (`disabled` when target is current user). Belt-and-braces: same check inside `admin_delete_user_data` so the DB itself rejects self-deletion regardless of caller.
- **Phase introduced:** Phase 8 (admin endpoint added in PR #83)

---

### TD-024: No rate limiting on `/api/admin-delete-user` — RESOLVED 2026-05-04
- **Status:** Resolved by adding `ADMIN_DELETE_RATE_LIMITER` (Cloudflare ratelimit binding) keyed on the verified caller `sub`. The check runs after JWT verification but before the `is_admin()` RPC, so a stolen session can't burn RPC capacity probing for admin status either. Implementation uses the shared `enforceRateLimit` helper in `workers/shared/rateLimit.ts` (introduced alongside this fix), which centralises the 429 body shape, distinct `code` per call site, and `Retry-After: 60` header.
- **Resolution detail:** Cap is 3 requests per admin caller per 60 seconds (the `simple` ratelimit binding only accepts `period` 10 or 60). The original future-fix target was "10/hour" which the binding can't express directly; 3/min keeps the practical throttle close (180 deletions/hour worst case versus 10 originally) while leaving headroom for a legitimate multi-account cleanup session.
- **Phase introduced:** Phase 8 (admin endpoint added in PR #83)

---

### TD-025: Worker `is_admin()` re-check collapses 5xx into "not admin"

- **Location:** `workers/admin-delete-user/index.ts` — `is_admin()` re-check (around line 48)
- **Issue:** The Worker's server-side `is_admin()` re-check returns `false` for any non-`ok` HTTP response, including upstream Supabase 5xx. A genuinely-admin user calling the endpoint while Postgres is having a bad day sees "Not authorised" rather than a transient infrastructure error. The DB-side re-check inside `admin_delete_user_data` would catch this if reached, but the Worker short-circuits before that.
- **Why accepted:** Practical impact is low — Supabase 5xx is rare and self-resolves in 30 seconds; the user retries and the request succeeds. The wrong-toast behaviour is a UX paper-cut, not a correctness or security issue.
- **Risk:** Low — misleading error message only.
- **Future fix:** Distinguish 401/403 (genuinely not admin) from 5xx (upstream failure) in the `is_admin()` helper. Return a typed result so the Worker can emit a 503 with a "service temporarily unavailable, try again" message rather than a 403. Test by mocking a 503 response from the `is_admin` RPC.
- **Phase introduced:** Phase 8 (admin endpoint added in PR #83)

---

### TD-026: CORS allowlist duplicated across three Workers

- **Location:** `workers/admin-delete-user/index.ts`, `workers/contact/index.ts`, `workers/generate-creature/index.ts` — each carries its own `['https://qrious.hultberg.org', 'http://localhost:5173']` array
- **Issue:** Three copies of the same allowlist drift over time. Adding a new origin (e.g. a staging domain) requires three coordinated edits. Now that `workers/shared/` exists for JWT helpers, CORS is the natural next extraction. Companion to TD-010 (which is about *what's in* the allowlist; this is about *where it lives*).
- **Why accepted:** Three Workers are the entire surface today and the allowlist hasn't changed in three Workers' worth of edits. Premature to dedup on first repetition; warranted now that the third Worker has shipped.
- **Risk:** Low — duplication, not divergence (yet). Becomes Medium once a fourth Worker arrives or when staging domains enter the picture.
- **Future fix:** Extract to `workers/shared/cors.ts` exporting `corsHeaders(origin)` and `ALLOWED_ORIGINS`. Each Worker imports rather than redeclares. Combines naturally with the TD-010 fix (move allowlist to `ALLOWED_ORIGINS` env var) so production builds drop localhost automatically.
- **Phase introduced:** Phase 8 (third Worker landed in PR #83)

---

### TD-027: No `REFERENCE/workers.md` inventory of Worker routes

- **Location:** `REFERENCE/` — only `ai-generation-worker.md` exists; no overview of `/api/contact` or `/api/admin-delete-user`
- **Issue:** Three Worker routes now (`/api/generate-creature`, `/api/contact`, `/api/admin-delete-user`) but only one is documented in REFERENCE/. New contributors and future-Claude-Code sessions can't easily discover the full server-side surface, its auth model, or where to find each Worker's source.
- **Why accepted:** Each Worker's source is well-commented and the routes are easy to find via grep; redundant documentation is a maintenance tax.
- **Risk:** Low — discoverability friction only. Becomes Medium if the surface grows to 5+ routes.
- **Future fix:** Single `REFERENCE/workers.md` table covering: route, source file, auth model (public / JWT-required / admin-gated), bindings used, rate limiting, key invariants. Update `REFERENCE/CLAUDE.md` index. Per-Worker deep-dive docs (like the existing `ai-generation-worker.md`) only for Workers complex enough to warrant them.
- **Phase introduced:** Phase 8 (third Worker landed in PR #83)

---

### TD-029: Cloudflare Wrangler GitHub Action pinned to Node 20 runtime

- **Location:** `.github/workflows/deploy.yml` — `cloudflare/wrangler-action@v3.14.1`
- **Issue:** GitHub Actions surfaces a deprecation warning on each deploy: the `cloudflare/wrangler-action@v3.14.1` action runs on Node.js 20. GitHub will force Node 24 by default from 2 June 2026, and Node 20 is removed from the runner on 16 September 2026. After that date, the action will either fail to start or be silently upgraded.
- **Why accepted:** No deploy impact today; Cloudflare publishes new wrangler-action releases regularly, so a Node-24-compatible version is likely to appear before the deadline. Bumping speculatively risks introducing an unrelated breakage.
- **Risk:** Low until ~August 2026, then High — the deploy workflow is the only path to production.
- **Future fix:** Watch [`cloudflare/wrangler-action` releases](https://github.com/cloudflare/wrangler-action/releases) for a Node-24 compatible version; bump `@v3.14.1` to whatever ships with Node 24 support and verify a clean deploy. As a stop-gap, `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true` in the workflow env opts in to Node 24 immediately if needed.
- **Phase introduced:** Phase 9 (warning surfaced post-merge of PR #85)

---

### TD-016: Contact form captcha is client-side only

- **Location:** `src/components/VictorianCaptcha/VictorianCaptcha.tsx`
- **Issue:** The VictorianCaptcha is validated in the browser only. A bot POSTing directly to `/api/contact` bypasses it. The honeypot field is enforced server-side at `workers/contact/index.ts` via a silent-200 drop, and per-IP rate limiting (5 req/min via `CONTACT_RATE_LIMITER`) caps quota abuse, but the captcha itself is not verified server-side.
- **Why accepted:** Cloudflare's edge provides default bot protection. The rate limiter and server-side honeypot together cover the realistic spam vectors. Client-side captcha blocks opportunistic browser-driven spam scripts. Server-side captcha verification (e.g. Cloudflare Turnstile) would require a separate token exchange and is overkill for current traffic.
- **Risk:** Low — rate limiter and honeypot cap damage; Cloudflare edge handles large-scale abuse.
- **Future fix:** Cloudflare Turnstile for true server-verified captcha, if targeted abuse becomes a real issue.
- **Phase introduced:** Phase 9

---

### Example Format: TD-001: Description
- **Location:** `src/path/to/file.ts` - `functionName()`
- **Issue:** Clear description of the limitation or shortcut
- **Why accepted:** Reason for accepting this debt (e.g., runtime constraints, time pressure, lack of alternative)
- **Risk:** Low/Medium/High - Impact assessment
- **Future fix:** Proposed solution when time/resources allow
- **Phase introduced:** Phase number when this was added

---

## Resolved items

### ~~TD-028~~: Display name was freely editable, contradicting the privacy policy
- **Resolved in:** PR #84 (2026-05-04)
- **Resolution:** Locked both client-side `display_name` write paths so every persisted name originates from `generateExplorerName()`:
  1. **Settings page** (`SettingsPage.tsx`): removed the free-text `<Input>`; `GazetteProfileSettings` now renders the display name read-only beside a "Regenerate" button.
  2. **Join flow** (`GazetteJoinPrompt.tsx`): removed the free-text `<input>`; the prompt now seeds a generated name on mount and offers a regenerate button as the only way to change it before submitting.
  3. **Hooks** (`useCommunity.ts`): narrowed `useUpdateProfile` to `{ user_id, is_public }`; added `useRegenerateDisplayName` (sole client-side path for writing an existing profile's name); documented `useCreateProfile`'s contract — callers must pass a name from `generateExplorerName()`. The UI never accepts user-typed names, so this is a convention enforced by call sites rather than the type system.

  The privacy promise at `PrivacyPage.tsx:242-244` ("never your real name") is now mechanically enforced from the frontend across both create and update paths. Server-side defence-in-depth (SECURITY DEFINER RPC, CHECK constraint) deferred — current single-trusted-contributor threat model makes UI lock + hook discipline sufficient. Re-evaluate before opening external sign-ups.

### ~~TD-015~~: `finishExcavation` badge-toast and rank-up logic lacks integration tests
- **Resolved in:** Phase 7 (same branch)
- **Resolution:** Extracted all badge/rank side-effect logic from `finishExcavation` into `src/hooks/usePostExcavationEffects.ts`. The hook is tested by `usePostExcavationEffects.test.ts` (14 tests) using mocked inner hooks — covers discovery activity posting, badge toasts with tier labels, badge activity, rank invalidation, and the rank-up detection effect. `App.tsx` is now a thin caller.

### ~~TD-017~~: `calculate_explorer_rank` referenced a column that no longer exists on `page_events`
- **Resolved in:** PR #61 (2026-04-25)
- **Resolution:** The RPC was deployed straight to Supabase from the original implementation and referenced `page_events.page`. When `page_events` was recreated in `20260419000005_fix_page_events_schema.sql` with column `page_name`, the RPC silently started failing with `column "page" does not exist` on every authenticated call (visible as a 400 in the browser console). Migration `20260425000004_fix_calculate_explorer_rank_page_events_column.sql` brings the function into version control, switches the column reference to `page_name`, adds `SET search_path = public`, and broadens the curiosity-bonus filter to match pathname-based values (`/specimen%`, `/catalogue%`, `/species%`).

---

## Notes

- Items are prefixed TD-NNN for easy reference in code comments and PR reviews
- When adding new debt, include: location, issue description, why accepted, risk level, and proposed future fix
- Review this list at the start of each development phase to see if any items should be addressed
- Low-risk items can remain indefinitely; High-risk items should be addressed within 2-3 phases
