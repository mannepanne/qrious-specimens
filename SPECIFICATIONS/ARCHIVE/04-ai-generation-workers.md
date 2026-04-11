# Phase 4: AI generation & Cloudflare Worker

## Phase overview

**Phase number:** 4
**Phase name:** AI generation & Cloudflare Worker
**Dependencies:** Phase 3 complete — creature engine, cabinet, and excavation animation scaffold in place

**Brief description:**
Brings the AI-powered Cloudflare Worker to life: a single Worker calls Google Gemini to generate Victorian naturalist illustrations, calls Claude Haiku to compose field notes, uploads images to R2, and registers the discovery. This phase also wires up the full discovery registration flow (the `register_discovery` RPC), completes the excavation animation with AI wait phases, and integrates the generated illustration throughout the app — full size on the specimen page and as a 256px thumbnail in cabinet teasers. After this phase, the app's signature experience — scan a QR code, watch it illustrated in real time — is complete.

---

## Scope and deliverables

### In scope
- [ ] `workers/generate-creature/` — single Cloudflare Worker that calls Gemini (illustration) + Claude Haiku (field notes), uploads images to R2, registers discovery
- [ ] Worker auth: verify caller's Supabase JWT before processing
- [ ] Worker caching: check `species_images` table first; skip generation if already cached; return cached result immediately
- [ ] R2 image upload from Worker: original + 512px + 256px variants
- [ ] `species_images` table writes from Worker (using service role)
- [ ] `register_discovery` RPC called from Worker after generation; RPC updates `is_first_discoverer` on the existing `creatures` row via service role (Option A: creature is inserted client-side at scan time, Worker updates the flag)
- [ ] `useSpeciesImage` hook — queries `species_images`, triggers Worker mutation if image missing
- [ ] Full excavation animation sequence including AI wait phases
- [ ] `SpecimenPage` displays AI illustration from R2 (falls back to Victorian sketch renderer if not yet generated)
- [ ] `SpecimenTeaser` displays 256px R2 thumbnail (falls back to Victorian sketch renderer)
- [ ] `TypewriterText` animates field notes on first view of a specimen page
- [ ] First discoverer notification on excavation completion
- [ ] Toast notifications: first discoverer vs. returning visitor vs. duplicate scan
- [ ] Worker route configured in `wrangler.toml`
- [ ] Tests for Worker (mocked Gemini and Claude responses)
- [ ] Tests for `useSpeciesImage` hook

### Out of scope
- Badge awarding system (Phase 7)
- Explorer rank calculation (Phase 7)
- Activity feed entries (Phase 6)

### Acceptance criteria
- [ ] Scanning a new QR code → Gemini illustration generated, stored in R2, visible in app
- [ ] Scanning same code again (any user) → cached image returned instantly, no second Gemini call
- [ ] Field notes generated and displayed with TypewriterText animation
- [ ] First discoverer notification on excavation completion
- [ ] Duplicate scan (same user, same QR) → toast message, no new creature added
- [ ] Worker rejects requests without valid Supabase JWT (401)
- [ ] Generated image URLs point to R2 (not Supabase Storage)
- [ ] Cabinet teasers show 256px R2 thumbnail; specimen page shows full-size image
- [ ] Victorian sketch renderer shown as fallback while image loads or on error
- [ ] `bun run test` passes; `bun run typecheck` passes
- [ ] Worker deployed and callable from production

---

## Technical approach

### Architecture decisions

**Single Worker for illustration + field notes**
- Choice: one Worker (`generate-creature`) calls Gemini and Claude Haiku sequentially, returns everything in one response
- Rationale: simpler Cloudflare dashboard, one set of secrets, one deployment, one route to maintain; the sequential calls (image first, then multimodal field notes using the image) are natural in a single handler
- Trade-off: slightly longer Worker execution time vs. two parallel Workers; acceptable given Gemini already dominates latency

**Cloudflare Workers for AI calls (not Supabase Edge Functions)**
- Choice: Cloudflare Workers rather than Supabase Deno edge functions
- Rationale: we own the Cloudflare account and Workers environment; Workers integrate naturally with R2 for image storage; same TypeScript/JS environment as the frontend
- Trade-off: slightly more setup than Supabase edge functions, but better long-term control

**JWT verification in Worker**
- Choice: verify the Supabase JWT in the Worker before processing
- Implementation: fetch Supabase JWKS endpoint (`{SUPABASE_URL}/auth/v1/keys`) and verify the token's signature using the `jose` library
- Rationale: without verification the Worker is an open API endpoint burning API quota

**Discovery flow: parallel insert + Worker RPC update (Option A)**
- Phase 3 already inserts the creature row client-side at scan time (parallel to animation start), with `is_first_discoverer: false`
- The Worker calls `register_discovery` RPC (service role) which atomically determines first discoverer and updates the `is_first_discoverer` field on the existing `creatures` row
- Worker returns `isFirstDiscoverer` to the frontend for the completion notification
- Rationale: creature appears in cabinet immediately; `is_first_discoverer` is set authoritatively server-side with atomic uniqueness guarantees

**Image storage: three R2 variants**
- Original (full resolution PNG from Gemini)
- 512px JPEG — displayed on SpecimenPage
- 256px JPEG — displayed in SpecimenTeaser cabinet grid
- R2 paths: `species/original/{hash}.png`, `species/512/{hash}.jpg`, `species/256/{hash}.jpg`
- Public R2 URLs written to `species_images` table

**AI image as direct `<img>` element**
- `CreatureRendererGenerative` was removed in Phase 3 simplification
- AI images are displayed as plain `<img>` elements in `SpecimenPage` and `SpecimenTeaser`
- Victorian sketch renderer (`CreatureRenderer`) used as fallback while image loads or if generation failed

**Field notes: Claude Haiku (multimodal)**
- Model: `claude-haiku-4-5-20251001`
- Called after Gemini completes; the generated image is passed as a base64 image input so field notes can reference the actual illustration
- Voice: Victorian natural historian — precise taxonomic observations, period-appropriate wonder
- The prompt includes the full `CreatureDNA` (body plan, anatomy, colours, habitat, temperament, estimated size)

**Gemini model selection**
- Try `gemini-2.0-flash-preview-image-generation` first; fall back to available image generation models
- Build a detailed Victorian naturalist illustration prompt from the creature DNA — body plan, limb style, surface pattern, colouration, habitat context
- Reference: `downloads-claude-ship/qrious-project-code-2e8ffbe/` contains the gold-standard prompt used in the original implementation

### Worker structure

```
workers/
└── generate-creature/
    ├── index.ts          # Main Worker handler — orchestrates all steps
    ├── prompt.ts         # Build Gemini and Claude prompts from CreatureDNA
    ├── gemini.ts         # Gemini API client (image generation)
    ├── claude.ts         # Claude API client (field notes)
    ├── r2.ts             # R2 upload helpers (resize + upload three variants)
    └── index.test.ts
```

**Worker request/response contract:**

`POST /api/generate-creature`
```typescript
// Request (JSON body)
{ qrHash: string; dna: CreatureDNA }
// Authorization: Bearer <supabase_jwt>

// Response (JSON)
{
  imageUrl: string        // R2 public URL — original
  imageUrl512: string     // R2 public URL — 512px
  imageUrl256: string     // R2 public URL — 256px
  fieldNotes: string      // Victorian naturalist field notes
  isFirstDiscoverer: boolean
  discoveryCount: number
  cached: boolean         // true if image was already in species_images
}

// Error responses
// 401 — missing or invalid JWT
// 400 — missing or invalid body
// 500 — generation or upload failure (with message)
```

**Worker execution order:**

```
1. Verify JWT
2. Check species_images for existing entry → if found, return immediately (cached: true)
3. Call Gemini → generate Victorian naturalist illustration
4. Upload original + 512px + 256px variants to R2
5. Call Claude Haiku (multimodal, with image) → generate field notes
6. Write to species_images table (service role)
7. Call register_discovery RPC (service role) → updates is_first_discoverer on creatures row
8. Return all data to frontend
```

### Wrangler route

```toml
[[routes]]
pattern = "/api/generate-creature"
script = "workers/generate-creature/index.ts"
```

### Excavation animation (Phase 4 completion)

The excavation animation gains AI wait phases. The early phases have fixed durations; the "THE ARTIST IS AT WORK" phase is open-ended — it waits for the Worker response with no timeout.

```
"FIELD SPECIMEN DETECTED"     ~800ms   (fixed)
"SCANNING THE STRATA"         ~900ms   (fixed)
"DECODING FOSSIL MATRIX"      ~1100ms  (fixed)
"COMMISSIONING ILLUSTRATION"  ~800ms   (fixed — fires Worker call)
"THE ARTIST IS AT WORK"       open-ended — waits for Gemini + Claude
[illustration fades in as fossil fragments scatter]
"SPECIMEN CATALOGUED"         ~1300ms  (fixed — completes)
```

**Cached path (species already illustrated):** Worker returns immediately; the open-ended phase resolves within ~500ms, making the full animation take ~5s — similar to Phase 3.

**New discovery path:** Gemini can take 10–30 seconds. The animation waits gracefully. The compass spinner continues; the QR fossil pattern slowly dissolves. When the Worker responds, the illustration fades in through the scattering fossil fragments — the reveal is the payoff for the wait.

**Architecture:** The excavation animation component remains passive — it plays phases and exposes callbacks. `App.tsx` (or a dedicated hook) orchestrates the Worker call and signals the animation when the result is ready. The animation does not make API calls directly.

**Terminology:** rename "hatching" → "excavation" throughout the codebase:
- `HatchingAnimation` → `ExcavationAnimation`
- `overlay === 'hatching'` → `overlay === 'excavating'`
- Variable names: `hatchingDna` → `excavatingDna`, `hatchingResultRef` → `excavationResultRef`, etc.

---

## Testing strategy

### Unit tests

**`workers/generate-creature/index.test.ts`**
- Valid JWT + valid DNA → returns image URLs, field notes, discovery data
- Invalid/missing JWT → 401 response
- Already cached species → returns cached data, no Gemini or Claude call
- Gemini API error → graceful 500 response with message
- Claude API error → graceful 500 response (image may still be uploaded)
- Uses mocked Gemini client, mocked Claude client, mocked R2 binding, mocked Supabase client

**`useSpeciesImage.test.ts`**
- Returns cached image immediately if `species_images` has data for the hash
- Triggers Worker mutation if no cached image found
- Returns loading state while Worker is in flight
- Handles Worker error gracefully (returns null, allows sketch fallback)

### Manual testing checklist
- [ ] Scan a brand new QR code → full excavation animation plays including AI wait phase
- [ ] AI illustration appears (Victorian engraving style, matches creature anatomy)
- [ ] Field notes appear with TypewriterText animation
- [ ] "FIRST DISCOVERER" notification on first scan of a species
- [ ] Scan same code as same user → duplicate toast, no animation
- [ ] Scan same code as different user → cached image returned, shorter animation
- [ ] Network error during generation → graceful error state
- [ ] Generated image visible in R2 bucket (Cloudflare dashboard)
- [ ] `species_images` row created in Supabase
- [ ] Cabinet teaser shows 256px thumbnail after generation
- [ ] SpecimenPage shows full-size image after generation

---

## Frontend changes

### New hook: `useSpeciesImage`

```typescript
// src/hooks/useSpeciesImage.ts
function useSpeciesImage(qrHash: string, dna: CreatureDNA): {
  imageUrl: string | null       // 512px for SpecimenPage
  imageUrl256: string | null    // 256px for SpecimenTeaser
  fieldNotes: string | null
  isFirstDiscoverer: boolean
  isLoading: boolean
  error: Error | null
}
```

Checks `species_images` table first. If no record, fires the Worker mutation. Invalidates relevant queries on success.

### SpecimenPage

Replace the current `<CreatureRenderer dna={dna} size={200} showAnnotations />` specimen viewport with:
- If `imageUrl` available: `<img src={imageUrl512} alt="..." />` in a styled frame
- If loading: sketch renderer as placeholder with subtle pulse
- If error or not yet generated: sketch renderer with `showAnnotations`

Field notes section: replace the TypewriterText placeholder with the actual field notes when available, animated on first reveal.

### SpecimenTeaser

Replace `<CreatureRenderer dna={dna} size={120} />` with:
- If `imageUrl256` available: `<img src={imageUrl256} alt="..." />`
- If not yet generated: `<CreatureRenderer dna={dna} size={120} />` (sketch fallback)

---

## Pre-commit checklist

- [ ] `bun run test` passes
- [ ] `bun run typecheck` passes
- [ ] `GEMINI_API_KEY` and `ANTHROPIC_API_KEY` in Wrangler secrets (never in `wrangler.toml`)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` in Wrangler secrets (never in source code)
- [ ] Worker CORS headers set correctly (allow requests from `https://qrious.hultberg.org`)
- [ ] R2 bucket bound correctly in `wrangler.toml`
- [ ] All test mocks cover error paths

---

## PR workflow

### Branch naming
```
feature/phase-4-ai-generation-workers
```

### Review requirements
Use `/review-pr-team` — security-sensitive (API keys, JWT verification, service role usage), and this is the core value-delivery feature of the entire app.

### Deployment steps
1. Set Worker secrets: `wrangler secret put GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`
2. Deploy Worker: `wrangler deploy`
3. Test end-to-end: scan a real QR code in production
4. Verify image appears in R2 bucket
5. Verify `species_images` row created in Supabase

---

## Edge cases and considerations

### Known risks
- **Gemini latency:** Image generation can take 10–30 seconds. The "THE ARTIST IS AT WORK" phase has no fixed timeout — it waits indefinitely. Set a sensible Worker timeout (default Cloudflare is 30s on free plan, 30s on paid; paid plan allows up to 30s CPU time but requests can be longer with `waitUntil`). If Gemini exceeds the timeout, return a graceful error and let the frontend show the sketch fallback.
- **Gemini API changes:** Keep the model selection list easy to update. The original implementation used multi-model fallback — replicate this pattern.
- **Concurrent first discoveries:** Two users scanning the same QR simultaneously — `register_discovery` RPC must be atomic (Postgres transaction). Both get the cached image after the first completes generation.
- **Image resize in Worker:** Cloudflare Workers can use the `@cf/image-resizing` binding or a lightweight canvas-based resize. Check what's available in the Workers runtime and use the simplest available approach.

### Security considerations
- JWT verification is the critical gate — without it, the Worker is an open API burning API quota
- Service role key must never appear in frontend code or client-side requests
- R2 bucket: public read (images are served publicly), write restricted to Worker only
- CORS: restrict `Access-Control-Allow-Origin` to `https://qrious.hultberg.org`

### Cost considerations
- Gemini: pricing varies by model; new discoveries are the only paid operations (cached results are free)
- Claude Haiku: ~$0.001 or less per field notes generation
- R2: first 10GB free; operations are fractions of a cent at this scale

---

## Related documentation

- [Phase 3 (archived)](./ARCHIVE/03-creature-engine-cabinet.md) — Prerequisite
- [Phase 5](./05-catalogue.md) — Next phase
- [environment-setup.md](../REFERENCE/environment-setup.md) — API keys and secrets
- [creature-engine.md](../REFERENCE/creature-engine.md) — DNA pipeline and discovery flow
- Reference: `downloads-claude-ship/qrious-project-code-2e8ffbe/` — original implementation to adapt (Gemini prompt, image upload logic)
