# AI generation worker

**When to read this:** Working on the illustration generation flow, the Worker handler, the excavation animation, or the discovery pipeline.

**Related documents:**
- [creature-engine.md](./creature-engine.md) — DNA pipeline and scan flow (Phase 3)
- [environment-setup.md](./environment-setup.md) — API keys and secrets
- [technical-debt.md](./technical-debt.md) — Known limitations (TD-003 through TD-010)

---

## Overview

When a user scans a QR code, two things happen in parallel:

1. The creature row is inserted into `creatures` via `addCreature` mutation
2. The `ExcavationAnimation` runs — at the COMMISSIONING ILLUSTRATION phase it calls `handleCommission`, which calls the Cloudflare Worker at `/api/generate-creature`

The Worker generates a Victorian naturalist illustration via Gemini, writes field notes via Claude Haiku, uploads the image to Cloudflare Images, writes to `species_images`, and calls the `register_discovery` RPC.

---

## Worker modules

All Worker code lives in `workers/generate-creature/`:

| File | Responsibility |
|---|---|
| `index.ts` | Main handler — JWT verification, cache check, orchestration, Supabase REST calls |
| `gemini.ts` | Gemini API client — illustration generation with model fallback |
| `claude.ts` | Anthropic API client — field notes generation (Claude Haiku, multimodal) |
| `prompt.ts` | Prompt builders — `buildGeminiPrompt(dna)` and `buildClaudePrompt(dna, hasImage)` |
| `../cloudflare-images/index.ts` | Cloudflare Images upload helper — single POST, three named variants served by CDN |

The Worker is registered in `src/worker.ts` and routes `POST /api/generate-creature` to `handleGenerateCreature`.

---

## Request flow (8 steps)

```
Client → Worker (POST /api/generate-creature)
  Step 1: Verify JWT (ES256/RS256 via Supabase JWKS, or legacy HS256; checks exp + sub)
  Step 2: Parse body (qrHash + dna), validate qrHash format (/^[0-9a-f]{16}$/)
  Step 3: Check species_images cache — if hit, skip to Step 8
  Step 4: Generate illustration via Gemini
  Step 5: Upload to Cloudflare Images (single POST; CDN serves qriousoriginal/qrious512/qrious256 variants)
  Step 6: Generate field notes via Claude Haiku (multimodal with the image)
  Step 7: Upsert into species_images (ON CONFLICT qr_hash DO NOTHING)
  Step 8: Call register_discovery RPC → returns is_first_discoverer + discovery_count
  → Response: { imageUrl, imageUrl512, imageUrl256, fieldNotes, isFirstDiscoverer, discoveryCount, cached }
```

Steps 6 and 7 are non-fatal — the Worker still returns a result if field notes fail or the DB write fails.

---

## Gemini illustration generation

`workers/generate-creature/gemini.ts`

- Tries `gemini-2.0-flash-preview-image-generation` directly (no model list call on the happy path)
- If the preferred model fails, fetches the model list and tries image-specific models first, then flash models
- Returns `{ imageBase64, mimeType }` — bytes passed to the Cloudflare Images upload and to Claude for multimodal field notes

The prompt (`buildGeminiPrompt`) specifies: Victorian naturalist lithograph style, exact limb and eye counts, no text in the image, ink and watercolour washes.

---

## Claude field notes generation

`workers/generate-creature/claude.ts`

- Model: `claude-haiku-4-5-20251001`
- Multimodal: sends the Gemini-generated image as a base64 inline image alongside the text prompt
- Returns two paragraphs of field notes in Victorian naturalist voice
- Strips markdown headers (`##`) before returning
- Failure is non-fatal — Worker returns `fieldNotes: ''` and continues

The prompt (`buildClaudePrompt`) instructs Claude to write as a Victorian naturalist who has just received the illustration, naming specific observed features from the DNA.

---

## Cloudflare Images storage

`workers/cloudflare-images/index.ts`

Single POST per species. The `qr_hash` is the custom image ID (idempotent — re-uploads of the same hash are a no-op). Three named variants are configured in the CF Images dashboard and served at the CDN edge:

```
https://imagedelivery.net/{CF_IMAGES_DELIVERY_HASH}/{qrHash}/qriousoriginal   — full resolution (SpecimenPage on desktop)
https://imagedelivery.net/{CF_IMAGES_DELIVERY_HASH}/{qrHash}/qrious512        — 512px (cabinet detail)
https://imagedelivery.net/{CF_IMAGES_DELIVERY_HASH}/{qrHash}/qrious256        — 256px (cabinet grid)
```

Variant names must be alphanumeric only — CF Images validates against `/^[a-z0-9]+$/`.

See [ADR 2026-04-20](./decisions/2026-04-20-cloudflare-images-over-r2.md) for the migration rationale. Pre-existing R2 images were backfilled via `scripts/backfill-cf-images.ts` on 2026-04-20.

---

## Database writes

### `species_images` table

Written once per unique `qr_hash`. Columns:

| Column | Written by |
|---|---|
| `qr_hash` | primary key |
| `image_url` | CF Images `qriousoriginal` URL |
| `image_url_512` | CF Images `qrious512` URL |
| `image_url_256` | CF Images `qrious256` URL |
| `field_notes` | Claude Haiku output |
| `prompt_used` | Gemini prompt (for debugging) |
| `first_discoverer_id` | JWT `sub` of first caller |
| `discovery_count` | starts at 1 |

The insert uses `ON CONFLICT (qr_hash) DO NOTHING` — if a concurrent request already wrote the row, this is a silent no-op.

### `register_discovery` RPC

Called after the `species_images` write (or cache hit). Atomically increments `discovery_count` and determines `is_first_discoverer`. Uses `ON CONFLICT` internally so it is race-safe.

---

## Client-side hooks

### `useSpeciesImage(qrHash, dna)`

`src/hooks/useSpeciesImage.ts`

Used by `SpecimenPage` and `SpecimenTeaser` for passive background loading:

1. React Query checks `species_images` via Supabase client (5-minute cache)
2. If no cached row and `dna` is non-null, auto-triggers the Worker via `useMutation`
3. Returns `{ imageUrl, imageUrl512, imageUrl256, fieldNotes, isFirstDiscoverer, isLoading, error }`

**Note:** Pass `dna: null` to disable the auto-trigger (used in `SpecimenTeaser` to avoid generating on cabinet grid render).

### `handleCommission` in `App.tsx`

The scan flow calls the Worker directly (not via `useSpeciesImage`) because:
- It needs to pass the result to `ExcavationAnimation` at a precise phase
- The timing is controlled by the animation state machine, not React Query

---

## Excavation animation

`src/components/ExcavationAnimation/ExcavationAnimation.tsx`

7-phase state machine:

| Phase | Label | Duration |
|---|---|---|
| 0 | FIELD SPECIMEN DETECTED | 800ms |
| 1 | SCANNING THE STRATA | 900ms |
| 2 | DECODING FOSSIL MATRIX | 1100ms |
| 3 | COMMISSIONING ILLUSTRATION | 800ms — fires `onCommission` |
| 4 | THE ARTIST IS AT WORK | open-ended — waits for `workerResult` prop |
| 5 | (reveal) | 1600ms — AI image fades in, sketch fades out |
| 6 | SPECIMEN CATALOGUED | 1300ms — fires `onComplete` |

Two independent `useEffect` rAF loops:
- **Loop 1:** Runs phases 0–3, fires `onCommission` at phase 3 start, stops at phase 4
- **Loop 2:** Starts when `workerResult` prop becomes non-null, runs phases 5–6

If `workerResult.imageUrl512` is null (Gemini failed), the sketch stays visible at full opacity through the reveal — no blank viewport.

---

## Discovery flow summary

```
User scans QR code
  → addCreature (parallel DB insert)
  → ExcavationAnimation starts (phases 0–3 fixed)
  → Phase 3: handleCommission fires
      → Worker: JWT verify → cache check → Gemini → Cloudflare Images → Claude → DB upsert → RPC
      → setExcavationWorkerResult (unblocks phase 4)
  → Animation phases 5–6: reveal
  → onComplete fires → finishExcavation
      → setViewingCreature (with is_first_discoverer patched if applicable)
      → toast: "First discoverer!" if applicable
      → toast: "The specimen eluded our naturalist." if Worker failed
```
