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

### Example Format: TD-001: Description
- **Location:** `src/path/to/file.ts` - `functionName()`
- **Issue:** Clear description of the limitation or shortcut
- **Why accepted:** Reason for accepting this debt (e.g., runtime constraints, time pressure, lack of alternative)
- **Risk:** Low/Medium/High - Impact assessment
- **Future fix:** Proposed solution when time/resources allow
- **Phase introduced:** Phase number when this was added

---

## Resolved items

*(Move items here when addressed, with resolution notes)*

---

## Notes

- Items are prefixed TD-NNN for easy reference in code comments and PR reviews
- When adding new debt, include: location, issue description, why accepted, risk level, and proposed future fix
- Review this list at the start of each development phase to see if any items should be addressed
- Low-risk items can remain indefinitely; High-risk items should be addressed within 2-3 phases
