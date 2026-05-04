# Technical Debt Tracker

**When to read this:** Planning refactors, reviewing known issues, or documenting accepted shortcuts.

**Related Documents:**
- [CLAUDE.md](./../CLAUDE.md) - Project navigation index
- [testing-strategy.md](./testing-strategy.md) - Testing strategy
- [troubleshooting.md](./troubleshooting.md) - Common issues and solutions

---

Tracks known limitations, shortcuts, and deferred improvements in the codebase. Items here are accepted risks or pragmatic choices, not bugs.

**Three sections:**
- **Active** — items still worth doing, grouped by priority tier.
- **Accepted** — items we've explicitly decided not to fix unless circumstances change. Each has a revisit trigger so it's not just a graveyard.
- **Resolved** — done. One-line archive with a link to the PR / migration / ADR where the detail lives.

When adding a new item: pick the next free `TD-NNN`, drop it into **Active** or **Accepted**, and add a row to the index table below.

---

## Index

| ID | Title | Status | Tier / trigger |
| --- | --- | --- | --- |
| TD-001 | Phase 1 committed directly to main | Accepted | Habit-setting only; no fix possible |
| TD-002 | Cabinet specimen list snapshotted at navigation | Accepted | Revisit when cabinets routinely exceed ~30 specimens |
| TD-003 | R2 image variants stored original bytes | Resolved | 2026-04-20 |
| TD-004 | No rate limiting on `/api/generate-creature` | Resolved | 2026-05-04 |
| TD-005 | R2 orphan images from TOCTOU race | Resolved | 2026-04-20 |
| TD-006 | `register_discovery` accepted arbitrary `p_user_id` | Resolved | 2026-04-25 |
| TD-007 | JWT `alg` header not validated | Resolved | 2026-04-20 |
| TD-008 | Gemini API key in URL query parameter | Accepted | Revisit if Google adds header auth, or if CF log access widens |
| TD-009 | Worker error responses include internal `detail` | Accepted | Revisit before exposing `detail` to UI toasts |
| TD-010 | `localhost:5173` in production CORS allowlist | Resolved | 2026-05-04 |
| TD-011 | Catalogue pagination window-function drift | Accepted | Revisit if catalogue churn becomes user-visible |
| TD-012 | `rare_discovery` event type defined but never posted | Accepted | Revisit when post-excavation flow is next touched |
| TD-013 | Cross-tab species auto-open beyond loaded pages | Resolved | Resolved structurally by URL routing |
| TD-014 | `activity_feed` had no DELETE RLS policy | Resolved | 2026-05-04 |
| TD-015 | `finishExcavation` badge/rank logic untested | Resolved | Phase 7 |
| TD-016 | Contact form captcha is client-side only | Accepted | Revisit if targeted spam appears past rate limit + honeypot |
| TD-017 | `calculate_explorer_rank` referenced removed column | Resolved | 2026-04-25 |
| TD-018 | Account deletion didn't anonymise `first_discoverer_id` | Resolved | 2026-05-04 |
| TD-019 | Account deletion didn't erase `auth.users` row | Resolved | 2026-05-04 |
| TD-020 | Phase 8 admin RPCs lacked explicit `search_path` | Resolved | 2026-05-04 |
| TD-021 | No DB-level test harness for `SECURITY DEFINER` RPCs / RLS | **Active** | Tier 1 — do before opening public sign-ups or adding a second admin |
| TD-022 | No success-path audit log for destructive admin ops | Resolved | 2026-05-04 |
| TD-023 | Admin can delete themselves | Resolved | 2026-05-04 |
| TD-024 | No rate limiting on `/api/admin-delete-user` | Resolved | 2026-05-04 |
| TD-025 | Worker `is_admin()` re-check collapsed 5xx into 403 | Resolved | 2026-05-04 |
| TD-026 | CORS allowlist duplicated across three Workers | Resolved | 2026-05-04 |
| TD-027 | No `REFERENCE/workers.md` inventory | Accepted | Revisit when Worker surface reaches ~5 routes, or next REFERENCE/ sweep |
| TD-028 | Display name was freely editable | Resolved | 2026-05-04 |
| TD-029 | Wrangler GitHub Action pinned to Node 20 | Accepted | Revisit by 2026-08, or sooner if `cloudflare/wrangler-action` ships Node-24 build |
| TD-030 | `usePostActivity` insert omitted `user_id` (Phase 6 regression) | Resolved | 2026-05-04 |

---

## Active

Items worth doing. Grouped by tier — top of the list is most worth doing.

### Tier 1 — do before broader rollout

#### TD-021: No database-level test harness for `SECURITY DEFINER` RPCs and RLS policies

- **Location:** `supabase/migrations/*.sql` — eleven `SECURITY DEFINER` RPCs across Phases 4, 5, 6, 8, 9; RLS policies on `profiles`, `creatures`, `activity_feed`, `explorer_profiles`, `contact_messages`
- **Issue:** Vitest hook tests (`useAdmin.test.ts`, `useCommunity.test.ts`) mock the Supabase client and verify the *frontend calls the right RPC with the right shape*, but no test asserts on what the RPC actually does. The current safety net for an RPC behavioural regression — wrong column reference, missed FK, broken `COALESCE` fallback, search_path injection — is manual post-deploy smoke testing. RLS policies are entirely untested.
- **Why accepted today:** Acceptable while the trust model is single-contributor and deployments are infrequent. Cost rises sharply once a second admin or public sign-ups land.
- **Risk:** Medium — increases as the RPC surface grows. A silent regression in `admin_delete_user_data` or any `get_*` RPC would ship to production until manual smoke testing catches it.
- **Future fix:** Adopt pgTAP per ADR [`2026-05-04-pgtap-smoke-suite`](./decisions/2026-05-04-pgtap-smoke-suite.md). Single dedicated PR introduces `supabase/tests/setup.sql` + `supabase/tests/admin_rpcs.sql` (~50–80 lines covering the six smoke assertions), wires `pg_prove` into a GitHub Actions step against a `postgres:16` container with the `pgtap` extension, and updates `REFERENCE/testing-strategy.md`. From that PR onwards, every migration that adds or changes an RPC adds (or extends) a pgTAP test in the same PR.
- **Phase introduced:** Phase 9

---

## Accepted

Items we've decided not to fix unless circumstances change. Each carries a **Revisit when** trigger.

### TD-001: Phase 1 committed directly to main

- **Location:** Git history — all Phase 1 commits
- **Issue:** Bootstrapping work (infrastructure setup, Supabase schema, Vite scaffold, first deployment) was committed directly to `main` with no feature branches or PRs.
- **Why accepted:** Pragmatic exception for initial bootstrapping — no established `main` to branch from, no collaborators, work was foundational. Reviewed post-hoc via `/review-pr`.
- **Risk:** Low — code has been reviewed. The risk is habit-setting, not the code itself.
- **Revisit when:** Never — historical record only. From Phase 2 onwards all work uses feature branches + PRs without exception.
- **Phase introduced:** Phase 1

---

### TD-002: Cabinet specimen list snapshotted at navigation time

- **Location:** `src/pages/CabinetPage.tsx` — `handleViewCreature()` (passes `cabinetCreatures` via React Router `state`); `src/pages/SpecimenPage.tsx` — reads `state.cabinetCreatures`
- **Issue:** Opening a specimen from the cabinet passes the current `allCreatures` list into the route's location state. Subsequent infinite-scroll fetches in `CabinetPage` don't propagate to the open `SpecimenPage`, so prev/next operates on the snapshot — creatures loaded after navigation are unreachable via the arrows.
- **Why accepted:** Invisible to users with small cabinets (< 30 specimens). Proper fix needs lifting creature state to a shared query or having `SpecimenPage` re-derive neighbours from the live infinite-query data.
- **Risk:** Low — no data loss, no corruption. Worst case: prev/next ends at the last creature in the snapshot.
- **Revisit when:** Cabinets routinely cross the page-size threshold and users start reporting missing prev/next targets.
- **Future fix sketch:** Have `SpecimenPage` consume `useCreatures(userId)` directly and derive prev/next from the live query, falling back to the location-state snapshot only when not yet hydrated.
- **Phase introduced:** Phase 3

---

### TD-008: Gemini API key appears in URL query parameter

- **Location:** `workers/generate-creature/gemini.ts` — `callGenerateContent()`
- **Issue:** Google's Gemini API requires the API key as a `?key=` URL query parameter. The key appears in outbound request URLs, which would show in Cloudflare request logs if logging is enabled.
- **Why accepted:** No alternative within Google's API design — there is no header-based auth on the v1beta REST API. The key is a Worker secret (not committed); exposure is limited to log access.
- **Risk:** Low — Cloudflare Worker logs are not public. Risk is proportional to who has Cloudflare account log access.
- **Revisit when:** Google adds header-based auth, or Cloudflare account log access widens beyond admin.
- **Phase introduced:** Phase 4

---

### TD-009: Worker error responses include internal `detail` field

- **Location:** `workers/generate-creature/index.ts` — error `json()` responses
- **Issue:** Error responses include a `detail` field with the raw exception message (e.g. `"detail": "Gemini API failed (429): Rate limit exceeded"`). Useful for debugging, but leaks internal detail if ever surfaced to users.
- **Why accepted:** The frontend ignores `detail` entirely — it only reads `imageUrl`, `fieldNotes`, etc. Visible only to someone inspecting network traffic.
- **Risk:** Low — not surfaced to users today. Becomes real if error toasts get more verbose or `detail` is forwarded.
- **Revisit when:** Adding richer UI error feedback. Always show a generic user-facing message; keep `detail` for console logging only.
- **Phase introduced:** Phase 4

---

### TD-011: Catalogue pagination window-function drift

- **Location:** `src/hooks/useCatalogue.ts` — `getNextPageParam`; `supabase/migrations/20260411000000_add_catalogue_filtering.sql` — `COUNT(*) OVER ()`
- **Issue:** `total_count` is a Postgres window function re-evaluated on every page fetch. If a new species lands between page 1 and page 2, `total_count` on page 2 is one higher than page 1, which can cause an extra empty load-more (or in reverse, miss the last item).
- **Why accepted:** Inherent limit of cursor-free keyset pagination on a live dataset. Proper fix needs either a stable cursor or a snapshot count — not justified at current scale.
- **Risk:** Low — no data loss, no incorrect display. Worst case is one extra empty load-more request.
- **Revisit when:** Catalogue churn rate makes the drift user-visible.
- **Future fix sketch:** Switch to keyset pagination using `first_discovered_at` + `qr_hash` as cursor, or snapshot `total_count` into component state on the first page load.
- **Phase introduced:** Phase 5

---

### TD-012: `rare_discovery` event type defined but never posted

- **Location:** `src/App.tsx` — `finishExcavation()`; `src/hooks/useCommunity.ts` — `FeedEntry`; `supabase/migrations/20260412000000_phase6_gazette.sql` — `activity_feed` CHECK constraint
- **Issue:** The `rare_discovery` event type exists in the DB CHECK constraint, TS types, and `ActivityTimeline` rendering (amber dot) — but nothing posts it. The frontend posts `discovery` or `first_discovery` and never checks species rarity. Amber dots will never appear.
- **Why accepted:** Rarity-at-excavation needs a DB lookup that adds latency. Out of scope for Phase 6's basic feed.
- **Risk:** Low — no data loss or broken UI. Feed is just slightly less colourful.
- **Revisit when:** Post-excavation flow is next touched (e.g. badge toast tweaks).
- **Future fix sketch:** After `addCreature.mutateAsync` resolves, fetch `species_discoveries.discovery_count` for the new `qr_hash`. If ≤ 3, post `rare_discovery`.
- **Phase introduced:** Phase 6

---

### TD-016: Contact form captcha is client-side only

- **Location:** `src/components/VictorianCaptcha/VictorianCaptcha.tsx`
- **Issue:** The VictorianCaptcha is validated in the browser only. A bot POSTing directly to `/api/contact` bypasses it. The honeypot is enforced server-side at `workers/contact/index.ts` via silent-200 drop, and per-IP rate limiting (5/min) caps quota abuse, but the captcha itself is not verified server-side.
- **Why accepted:** Cloudflare's edge handles default bot protection. Rate limiter + server-side honeypot cover realistic spam vectors. Server-side captcha (e.g. Turnstile) needs a separate token exchange and is overkill for current traffic.
- **Risk:** Low — rate limiter and honeypot cap damage; CF edge handles scale abuse.
- **Revisit when:** Targeted spam appears that defeats the rate limiter and honeypot.
- **Future fix sketch:** Cloudflare Turnstile for true server-verified captcha.
- **Phase introduced:** Phase 9

---

### TD-027: No `REFERENCE/workers.md` inventory of Worker routes

- **Location:** `REFERENCE/` — only `ai-generation-worker.md` exists; no overview of `/api/contact` or `/api/admin-delete-user`
- **Issue:** Three Worker routes exist (`/api/generate-creature`, `/api/contact`, `/api/admin-delete-user`) but only one is documented in REFERENCE/. New contributors / future-Claude-Code sessions can't easily discover the full server-side surface, its auth model, or where to find each Worker's source.
- **Why accepted:** Each Worker's source is well-commented and routes are easy to grep for; redundant documentation is a maintenance tax.
- **Risk:** Low — discoverability friction only. Becomes Medium at ~5+ routes.
- **Revisit when:** Worker surface reaches ~5 routes, or next REFERENCE/ sweep.
- **Future fix sketch:** Single `REFERENCE/workers.md` table covering: route, source file, auth model, bindings used, rate limiting, key invariants. Update `REFERENCE/CLAUDE.md` index.
- **Phase introduced:** Phase 8

---

### TD-029: Cloudflare Wrangler GitHub Action pinned to Node 20 runtime

- **Location:** `.github/workflows/deploy.yml` — `cloudflare/wrangler-action@v3.14.1`
- **Issue:** GitHub Actions surfaces a deprecation warning each deploy: the action runs on Node.js 20. GitHub forces Node 24 by default from 2 June 2026, and Node 20 is removed from the runner on 16 September 2026.
- **Why accepted:** No deploy impact today; Cloudflare publishes new wrangler-action releases regularly. Bumping speculatively risks an unrelated breakage.
- **Risk:** Low until ~August 2026, then High — the deploy workflow is the only path to production.
- **Revisit when:** A Node-24-compatible `cloudflare/wrangler-action` ships, or by 2026-08 (whichever first). Stop-gap: `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true` in the workflow env.
- **Phase introduced:** Phase 9

---

## Resolved

Compressed archive — id, title, resolution date, link to where the detail lives.

- **TD-003**: R2 image variants stored original bytes — resolved 2026-04-20 by Cloudflare Images migration. See [ADR](./decisions/2026-04-20-cloudflare-images-over-r2.md).
- **TD-004**: No rate limiting on `/api/generate-creature` — resolved 2026-05-04 in PR #92 (`GENERATE_CREATURE_RATE_LIMITER` 5/60s per user + global 100/60s backstop, both checked before cache lookup).
- **TD-005**: R2 orphan images from TOCTOU race — resolved 2026-04-20 by Cloudflare Images migration (CF Images uses `qr_hash` as image ID, duplicates collapse). See [ADR](./decisions/2026-04-20-cloudflare-images-over-r2.md).
- **TD-006**: `register_discovery` RPC accepted arbitrary `p_user_id` — resolved 2026-04-25 by `supabase/migrations/20260425000003_register_discovery_revoke_public_execute.sql` (revoked from PUBLIC/authenticated/anon, granted to service_role only).
- **TD-007**: JWT `alg` header not validated — resolved 2026-04-20 in PR #47. `verifyJWT()` now whitelists HS256/ES256/RS256 with structurally distinct key sources per branch. See [ADR](./decisions/2026-04-20-jwks-jwt-verification.md).
- **TD-010**: `http://localhost:5173` in production CORS allowlist — resolved 2026-05-04 in PR #95 via `ALLOWED_ORIGINS` env var consumed by `workers/shared/cors.ts`.
- **TD-013**: Cross-tab species auto-open beyond loaded pages — resolved structurally when species navigation moved to URL routing (`/species/:qrHash`); RPC backed by `supabase/migrations/20260412000001_get_species_by_hash.sql`.
- **TD-014**: `activity_feed` had no DELETE RLS policy — resolved 2026-05-04 in PR #93 by `supabase/migrations/20260504000002_activity_feed_delete_own_rls.sql` (`"Delete own activity"` policy).
- **TD-015**: `finishExcavation` badge/rank logic untested — resolved in Phase 7. Logic extracted to `src/hooks/usePostExcavationEffects.ts` with 14 tests.
- **TD-017**: `calculate_explorer_rank` referenced removed `page_events.page` column — resolved 2026-04-25 in PR #61 via `supabase/migrations/20260425000004_fix_calculate_explorer_rank_page_events_column.sql`.
- **TD-018**: Account deletion didn't anonymise `species_discoveries.first_discoverer_id` — resolved 2026-05-04 by `supabase/migrations/20260504000000_admin_delete_anonymises_first_discoverer.sql` (also backfills orphans).
- **TD-019**: Account deletion didn't erase `auth.users` row — resolved 2026-05-04 via Worker-mediated erasure at `POST /api/admin-delete-user`. See [ADR](./decisions/2026-05-04-worker-mediated-account-erasure.md).
- **TD-020**: Phase 8 admin RPCs lacked explicit `SET search_path = public` — resolved 2026-05-04 by `supabase/migrations/20260504000001_phase8_admin_search_path_hardening.sql`.
- **TD-022**: No success-path audit log for destructive admin operations — resolved 2026-05-04 in PR #94. `logAdminDeleteAudit()` emits a single-line JSON record on success and partial-failure paths; per-request `correlationId` threads through all error logs.
- **TD-023**: Admin could delete themselves — resolved 2026-05-04 with three independent layers: UI alert, Worker `400 self_delete_blocked`, DB exception in `admin_delete_user_data` (`supabase/migrations/20260505000000_admin_delete_blocks_self.sql`).
- **TD-024**: No rate limiting on `/api/admin-delete-user` — resolved 2026-05-04 in PR #92. `ADMIN_DELETE_RATE_LIMITER` (3/60s per caller `sub`) checked after JWT verify, before `is_admin()` RPC. Uses shared `enforceRateLimit` in `workers/shared/rateLimit.ts`.
- **TD-025**: Worker `is_admin()` re-check collapsed 5xx into "not admin" — resolved 2026-05-04 in PR #94. `callIsAdmin()` returns a discriminated union; 5xx surfaces as `503 auth_check_unavailable` with a transient-blip toast on the client.
- **TD-026**: CORS allowlist duplicated across three Workers — resolved 2026-05-04 in PR #95 via `workers/shared/cors.ts` (`corsHeaders(origin, env, allowHeaders?)` + `parseAllowedOrigins(env)`). Locked in by `workers/shared/cors.test.ts`.
- **TD-028**: Display name was freely editable, contradicting the privacy policy — resolved 2026-05-04 in PR #84. Locked both client write paths to `generateExplorerName()`; `useUpdateProfile` narrowed to `{ user_id, is_public }`; new `useRegenerateDisplayName` hook is the sole client path for renaming.
- **TD-030**: `usePostActivity` insert omitted `user_id`, causing every Gazette write to fail the `NOT NULL` + `Insert own activity` RLS check from Phase 6 onward — resolved 2026-05-04 in PR #98. Restored `user_id` to `PostActivityParams` and threaded it through the `fireEffects()` call site in `src/hooks/usePostExcavationEffects.ts`. Backfill via `supabase/migrations/20260506000000_backfill_activity_feed.sql` replays missed discoveries and badge awards for currently-public profiles, with per-event-type `MAX(created_at)` cutoffs for idempotency.

---

## Notes

- Items keep their `TD-NNN` id permanently; the id is the stable handle in code comments and PR reviews.
- New debt: assign the next free id, drop into **Active** (with tier) or **Accepted** (with revisit trigger), add an Index row.
- Review **Active** at the start of each work cycle; review **Accepted** triggers when the trigger condition might be approaching.
- Detailed item template (mirror Active/Accepted entries above):
  - **Location** — file + symbol
  - **Issue** — the limitation
  - **Why accepted** — reason for the shortcut
  - **Risk** — Low / Medium / High
  - **Revisit when** — concrete trigger
  - **Future fix sketch** — if useful
  - **Phase introduced**
