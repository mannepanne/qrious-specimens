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

### TD-003: R2 image variants store original bytes (no actual pixel resize)
- **Location:** `workers/generate-creature/r2.ts` — `uploadToR2()`
- **Issue:** The 512px and 256px R2 variants store the original Gemini image bytes rather than pixel-resized copies. Display sizes are constrained by CSS in `SpecimenPage` and `SpecimenTeaser`, but users on slow connections download the full-resolution image even for thumbnails.
- **Why accepted:** Cloudflare Workers runtime has no Canvas API or native image resize. Alternatives (WASM-based resize, CF Image Resizing service) require either a paid CF plan add-on or significant added complexity. For Phase 4 MVP this is acceptable — Gemini images are typically 1–2MB and the cabinet loads lazily.
- **Risk:** Low — no data loss or functional breakage. Performance cost is bandwidth on the cabinet grid for users with many specimens.
- **Future fix:** Enable Cloudflare Image Resizing on the account (Pro+ plan) and use `fetch(r2Url, { cf: { image: { width: 512 } } })` to resize before uploading the variant, OR use a WASM-based JPEG encoder in the Worker.
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

### TD-005: R2 orphan images from TOCTOU race
- **Location:** `workers/generate-creature/index.ts` — `uploadToR2()` called before `insertSpeciesImage()`
- **Issue:** When two concurrent requests scan the same QR code, both upload to R2 (step 5) before the upsert (step 7). The upsert uses `ON CONFLICT (qr_hash) DO NOTHING`, so the second request's R2 objects (three files) are uploaded but never referenced by any DB row. They become orphaned objects in the bucket.
- **Why accepted:** The race window is narrow and the orphaned objects are small (1–2 MB total). Data integrity is preserved — the DB always has the first discoverer's data. The failure mode is minor storage waste.
- **Risk:** Low — no data loss, no user-facing breakage. Cumulative storage cost is negligible at early scale.
- **Future fix:** Periodic R2 cleanup job: list all keys in `species/`, cross-reference against `species_images.qr_hash`, delete unmatched keys older than 24 hours.
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

### TD-007: JWT `alg` header not validated
- **Location:** `workers/generate-creature/index.ts` — `verifyJWT()`
- **Issue:** The JWT header's `alg` field is parsed but not checked. Classic "algorithm confusion" attacks exploit implementations that branch on the header value (e.g. switching to `alg: none`). We don't branch on it — `crypto.subtle.verify('HMAC', ...)` is hardcoded to HMAC-SHA256 regardless of what the header says, so this attack doesn't apply in practice.
- **Why accepted:** Not practically exploitable given the implementation. A 3-line defence-in-depth fix, but zero real-world risk without it.
- **Risk:** Low — mitigated by implementation detail.
- **Future fix:** Add `if (header.alg !== 'HS256') throw new Error('Unsupported JWT algorithm')` after parsing the header in `verifyJWT`.
- **Phase introduced:** Phase 4

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

### TD-016: Contact form captcha and honeypot are client-side only

- **Location:** `workers/contact/index.ts` — `handleContact()`; `src/components/VictorianCaptcha/VictorianCaptcha.tsx`
- **Issue:** The VictorianCaptcha and honeypot field are validated in the browser only. A bot POSTing directly to `/api/contact` bypasses both protections and can insert rows into `contact_messages` and trigger Resend notification emails. The Worker has no captcha verification or per-IP rate limiting.
- **Why accepted:** The site runs behind Cloudflare's edge, which provides default bot protection and DDoS mitigation. For a small personal project with low traffic, the risk of targeted abuse is low. Client-side captcha meaningfully raises the bar for opportunistic spam scripts.
- **Risk:** Low while traffic is low. Becomes Medium if the contact form URL is discovered and targeted — Resend quota exhaustion could disrupt admin notifications.
- **Future fix:** Add per-IP rate limiting using `CF-Connecting-IP` header and a Cloudflare KV counter (e.g. 5 requests per IP per 10 minutes). Alternatively, use Cloudflare's built-in rate limiting rules in the dashboard. Server-side captcha verification (e.g. Cloudflare Turnstile) is an option if spam becomes a real issue.
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
