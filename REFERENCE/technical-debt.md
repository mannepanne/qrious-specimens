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

### TD-002: `cabinetCreaturesRef` stale across infinite-scroll page loads
- **Location:** `src/App.tsx` — `cabinetCreaturesRef`, `handleViewCreature`
- **Issue:** Opening a specimen from the cabinet snapshots the current `allCreatures` list into a ref. Subsequent infinite-scroll page fetches don't update the ref, so prev/next navigation on `SpecimenPage` operates on a stale list — creatures loaded after the snapshot are unreachable via the arrows.
- **Why accepted:** Requires a more involved refactor (lifting creature state or passing a live query reference). The failure mode is invisible to users with small cabinets (< 30 specimens). Will become noticeable only once pagination is common.
- **Risk:** Low — no data loss, no corruption. Worst case: prev/next navigation ends at the last creature in the first page.
- **Future fix:** Pass a stable reference to the live query data into `SpecimenPage`, or derive prev/next indices from the infinite query directly rather than a snapshot.
- **Phase introduced:** Phase 3

---

### TD-003: R2 image variants store original bytes (no actual pixel resize) — RESOLVED 2026-04-20
- **Status:** Resolved by migration to Cloudflare Images. See [ADR 2026-04-20](./decisions/2026-04-20-cloudflare-images-over-r2.md).
- **Resolution:** CF Images serves properly resized `qrious512` and `qrious256` variants at the CDN edge from a single uploaded original; R2 variant logic removed.
- **Phase introduced:** Phase 4

---

### TD-004: No rate limiting on `/api/generate-creature`
- **Location:** `src/worker.ts` — route handler; `workers/generate-creature/index.ts` — `handleGenerateCreature()`
- **Issue:** No per-user rate limit on the generation endpoint. Each novel `qrHash` triggers a Gemini image generation + Claude Haiku call. An authenticated user scripting novel QR content could exhaust API quotas. The `species_images` cache only protects against repeated hashes, not novel ones.
- **Why accepted:** Physical QR scanning naturally limits legitimate use (1–2 scans/min at most). The threat requires a valid authenticated account. Acceptable for an early-stage app with a small user base.
- **Risk:** Medium — becomes High once the app grows or moves to paid API keys. Each Gemini call costs ~$0.01–0.05 in image generation credits.
- **Future fix:** Add per-user rate limit in Cloudflare KV: `ratelimit:{userId}` key with TTL, checked before calling Gemini. Alternatively, use Cloudflare's built-in rate limiting rule (Pro plan). Target: ~10 generations per user per hour.
- **Phase introduced:** Phase 4

---

### TD-005: R2 orphan images from TOCTOU race — RESOLVED 2026-04-20
- **Status:** Resolved by migration to Cloudflare Images. See [ADR 2026-04-20](./decisions/2026-04-20-cloudflare-images-over-r2.md).
- **Resolution:** CF Images uses `qr_hash` as the custom image ID, so concurrent uploads collapse on a single object (duplicate ID is treated as success). No orphans possible.
- **Phase introduced:** Phase 4

---

### TD-006: `register_discovery` RPC accepts arbitrary `p_user_id` without auth check
- **Location:** Supabase database function `register_discovery` (migration file) — not in Worker code
- **Issue:** The `SECURITY DEFINER` RPC accepts `p_user_id uuid` as a parameter without verifying it matches `auth.uid()`. Any authenticated user could call the RPC directly via the Supabase client with a different user's ID to spoof first-discoverer credit. The Worker path is safe (passes JWT-verified `userId`), but the direct client path is not.
- **Why accepted:** The first-discoverer badge is cosmetic — no financial or account-integrity consequence. Exploiting this requires knowing another user's UUID. The fix is a DB migration, out of scope for Phase 4.
- **Risk:** Low-Medium — affects data integrity of the first-discoverer feature but no security escalation beyond badge cosmetics.
- **Future fix:** Add `IF p_user_id != auth.uid() THEN RAISE EXCEPTION 'Unauthorised'` inside the function, or restrict RPC access to service role only (`REVOKE EXECUTE ON FUNCTION register_discovery FROM authenticated`).
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
- **Location:** `workers/generate-creature/index.ts` — `corsHeaders()`
- **Issue:** The CORS allowlist includes `http://localhost:5173` in production. This allows a local dev server to make cross-origin requests to the production Worker. Still requires a valid Supabase JWT, so there is no bypass of authentication.
- **Why accepted:** Convenient for development against the production Worker when local Cloudflare dev isn't practical. The JWT requirement prevents any real exploitation.
- **Risk:** Informational — no practical security impact given auth requirements.
- **Future fix:** Move the allowlist to a `ALLOWED_ORIGINS` environment variable so localhost is excluded from the production Wrangler deployment automatically.
- **Phase introduced:** Phase 4

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

### TD-013: Cross-tab species auto-open fails for species beyond loaded catalogue pages

- **Location:** `src/pages/CataloguePage.tsx` — `useEffect` for `selectedSpeciesHash` (lines 77–86)
- **Issue:** When the Gazette's "view species" action sets `selectedCatalogueHash`, `CataloguePage` searches only `allEntries` (the currently loaded infinite-scroll pages). If the target species is on an unloaded page, it won't be found, `onSpeciesViewed` never fires, and `selectedCatalogueHash` stays set indefinitely — the user sees the catalogue with nothing opened and no feedback.
- **Why accepted:** Fixing this properly requires a single-species RPC lookup by `qr_hash`, or prefetching all pages — both add complexity. The current catalogue is small enough that the first 24 entries cover most linked species. The failure mode is silent (nothing bad happens, just nothing opens).
- **Risk:** Low — no data loss. Worsens as the catalogue grows beyond 24 entries.
- **Future fix:** Add a `get_species_by_hash(p_qr_hash text)` RPC (or reuse `get_catalogue` with an exact hash filter) and fall back to it when `selectedSpeciesHash` is not found in `allEntries`. Clear `selectedCatalogueHash` after the fallback fetch resolves.
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

### TD-016: Contact form captcha is client-side only

- **Location:** `src/components/VictorianCaptcha/VictorianCaptcha.tsx`; `workers/contact/index.ts`
- **Issue:** The VictorianCaptcha and honeypot field are validated in the browser only. A bot POSTing directly to `/api/contact` bypasses both. Server-side rate limiting (5 req/IP/min via `CONTACT_RATE_LIMITER`) is in place and limits quota abuse, but captcha itself is not verified server-side.
- **Why accepted:** Cloudflare's edge provides default bot protection. The rate limiter limits blast radius. Client-side captcha blocks opportunistic spam scripts. Server-side captcha verification (e.g. Cloudflare Turnstile) would require a separate token exchange and is overkill for current traffic.
- **Risk:** Low — rate limiter caps damage; Cloudflare edge handles large-scale abuse.
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

### ~~TD-015~~: `finishExcavation` badge-toast and rank-up logic lacks integration tests
- **Resolved in:** Phase 7 (same branch)
- **Resolution:** Extracted all badge/rank side-effect logic from `finishExcavation` into `src/hooks/usePostExcavationEffects.ts`. The hook is tested by `usePostExcavationEffects.test.ts` (14 tests) using mocked inner hooks — covers discovery activity posting, badge toasts with tier labels, badge activity, rank invalidation, and the rank-up detection effect. `App.tsx` is now a thin caller.

---

## Notes

- Items are prefixed TD-NNN for easy reference in code comments and PR reviews
- When adding new debt, include: location, issue description, why accepted, risk level, and proposed future fix
- Review this list at the start of each development phase to see if any items should be addressed
- Low-risk items can remain indefinitely; High-risk items should be addressed within 2-3 phases
