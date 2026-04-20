# ADR: Cloudflare Images (not R2) for specimen illustration storage

**Date:** 2026-04-20
**Status:** Active
**Supersedes:** Informal decision recorded in commit `aeb31f9` ("stick with R2 for images")

---

## Decision

Specimen illustrations are stored in Cloudflare Images. The R2 bucket `qrious-specimens-images`, its worker binding `IMAGES`, and the `PUBLIC_R2_URL` var are retired. All existing images were backfilled to Cloudflare Images with `qr_hash` as the custom image ID.

## Context

Phase 4 introduced a three-variant R2 upload path (original + 512 + 256) in `workers/generate-creature/index.ts`. Commit `aeb31f9` evaluated Cloudflare Images during Phase 9 and chose to stay on R2 on cost grounds ("$5/month minimum vs cents"). Two things then changed the calculus:

1. The R2 pipeline had a TOCTOU race where a concurrent scan of the same QR could leave orphaned R2 objects (tracked in `REFERENCE/technical-debt.md` as TD-005), and the three-variant upload was storing the original bytes at every size (TD-003 — "proper resizing deferred").
2. At this project's scale (a hobby/personal app with 18 species and low traffic) the $5 CF Images minimum is already less than the operational overhead of maintaining the R2 variant logic, and it scales below any realistic traffic we care about.

## Alternatives considered

- **Stay on R2 (status quo):** Fix TD-003 with real resizing via `@cloudflare/workers-types` Image API or Sharp in a separate Worker; fix the TOCTOU via a cleanup scan.
  - Why not: Adds another Worker + scheduled job to the architecture, still leaves three-object book-keeping, does not solve CDN variant caching automatically.

- **R2 + CF Image Resizing:** Keep originals on R2, serve resized variants via `/cdn-cgi/image/` URL transforms.
  - Why not: Image Resizing is a separate paid product with per-request pricing; requires configuration on a route. Combining R2 public URLs with Image Resizing is fiddly and the feature's exact availability in front of R2's `pub-*.r2.dev` host is a known grey area.

- **Chosen: Cloudflare Images:** Single upload, named variants (`qriousoriginal`, `qrious512`, `qrious256`) served from `imagedelivery.net` CDN, `qr_hash` as custom image ID for idempotency.

## Reasoning

**Single upload, fewer failure modes:**
- One `POST /images/v1` call replaces three R2 `put()` calls.
- CF Images computes the variants; the worker no longer decides what "512" means.
- Idempotent: using `qr_hash` as the custom image ID means retries and re-runs collapse on the same object.

**The race condition disappears:**
- TD-005 hinges on two concurrent requests both uploading to R2 before the DB upsert. With CF Images, the `qr_hash`-as-custom-ID means the second upload is a no-op (duplicate ID → 409, treated as success) so the orphaned-object class of bugs is eliminated.

**Variants are now real:**
- TD-003 ("512 and 256 store original bytes") was planned future work. CF Images ships it for free.

**Cost is acceptable for the project:**
- $5/month minimum vs a few cents on R2 for this workload. For a personal portfolio project this is a fair trade for the simpler code + proper variants. The decision to flip was easier once we'd already validated the code path in production for new scans.

## Trade-offs accepted

**Fixed monthly minimum:**
- $5/month floor regardless of usage. R2 at this scale was effectively free.
- Accepted: the operational simplification is worth the line item. Revisit only if the project is shut down or moved off Cloudflare entirely.

**Vendor lock-in to Cloudflare Images API:**
- Migration off CF Images would require a reverse backfill — download every image and re-upload somewhere else.
- Accepted: we are already all-in on Cloudflare (Workers, R2, DNS). The marginal lock-in from using one more Cloudflare service is negligible.

**Local-dev friction:**
- Previously the worker fell back to R2 for local dev without CF Images secrets. That fallback is removed, so local runs of the illustration path now require the three CF Images env vars. Tests mock the API; `wrangler dev` requires the secrets to be set.
- Accepted: this is a very narrow surface — only the full end-to-end generation path is affected, and nothing in the scan/cabinet UX requires hitting this path in development.

## Implications

**Enables:**
- Simpler `generate-creature` worker (one upload call, no variant book-keeping).
- Automatic variant regeneration if we want to change sizes later — just edit the CF Images dashboard, no re-upload.
- TD-003 and TD-005 close out (see `REFERENCE/technical-debt.md` update). TD-004 (rate limiting) and TD-006 (`register_discovery` auth check) are unrelated and remain open.

**Prevents/complicates:**
- Worker can no longer run in local dev without the CF Images secrets exported (no R2 fallback).
- Any future switch away from Cloudflare Images requires a backfill script run in reverse.

---

## References

- Backfill script: `scripts/backfill-cf-images.ts` (one-off — migrated 18 pre-existing rows from R2 to CF Images)
- Implementation: `workers/cloudflare-images/index.ts`, `workers/generate-creature/index.ts`
- Supersedes: commit `aeb31f9` — "Phase 9: Resend contact notification via Worker; stick with R2 for images"
- Related technical debt: TD-003 and TD-005 (closed by this change) in `REFERENCE/technical-debt.md`
