# Phase 4: AI generation & Cloudflare Workers

## Phase overview

**Phase number:** 4
**Phase name:** AI generation & Cloudflare Workers
**Dependencies:** Phase 3 complete — creature engine, cabinet, and hatching animation scaffold in place

**Brief description:**
Brings the two AI-powered Cloudflare Workers to life: one calls Google Gemini to generate Victorian naturalist illustrations and stores them in R2, the other calls Claude to write field notes in the voice of a Victorian natural historian. This phase also wires up the full discovery registration flow (the `register_discovery` RPC), completes the hatching animation with all AI wait phases, and integrates the full image display in the Specimen page. After this phase, the app's signature experience — scan a QR code, watch it illustrated in real time — is complete.

---

## Scope and deliverables

### In scope
- [ ] `workers/generate-creature/` — Cloudflare Worker that calls Gemini API, uploads image to R2, saves URL to Supabase
- [ ] `workers/generate-field-notes/` — Cloudflare Worker that calls Claude API, saves field notes to Supabase
- [ ] Worker auth: verify caller's Supabase JWT before processing
- [ ] Worker caching: check `species_images` table first; skip generation if already cached
- [ ] R2 image upload from Worker: original + 512px + 256px variants
- [ ] `species_images` table writes from Workers (using service role)
- [ ] `register_discovery` RPC called after successful generation (tracks unique discoverers, total scans, first discoverer)
- [ ] `useSpeciesImage` hook — queries species image + field notes, triggers generation mutation if needed
- [ ] Full hatching animation sequence including AI wait phases ("COMMISSIONING ILLUSTRATION", "THE ARTIST IS DRAWING", "COMPOSING FIELD NOTES")
- [ ] `CreatureRendererGenerative` now displays actual AI illustration from R2
- [ ] `TypewriterText` animates field notes on first view of a Specimen page
- [ ] First discoverer badge/notification on hatching completion
- [ ] Duplicate scan handling (reject at `register_discovery` level)
- [ ] Toast notification: first discoverer vs. returning visitor
- [ ] Worker routes configured in `wrangler.toml`
- [ ] Tests for Workers (mock Gemini and Claude responses)
- [ ] Tests for `useSpeciesImage` hook

### Out of scope
- Badge awarding system (Phase 7)
- Explorer rank calculation (Phase 7)
- Activity feed entries (Phase 6)

### Acceptance criteria
- [ ] Scanning a new QR code → Gemini illustration generated, stored in R2, visible in app
- [ ] Scanning same code again → cached image returned instantly (no second API call)
- [ ] Field notes generated and displayed with typewriter animation
- [ ] First discoverer gets special notification; subsequent discoverers see cached results
- [ ] Duplicate scan (same user, same QR) → toast message, no new creature added
- [ ] Worker rejects requests without valid Supabase JWT (401)
- [ ] Generated image URLs point to R2 (not Supabase Storage)
- [ ] `bun run test` passes; `bun run typecheck` passes
- [ ] Worker deployed and callable from production

---

## Technical approach

### Architecture decisions

**Cloudflare Workers for AI calls (not Supabase Edge Functions)**
- Choice: Cloudflare Workers (`workers/`) rather than Supabase Deno edge functions
- Rationale: We own the Cloudflare account and Workers environment; no dependency on Supabase compute; Workers integrate naturally with R2 for image storage; same TypeScript/JS environment as the frontend
- Trade-off: Slightly more setup than Supabase edge functions, but better long-term control

**JWT verification in Workers**
- Choice: Verify the Supabase JWT in each Worker before processing
- Implementation: Fetch Supabase JWKS endpoint (`{SUPABASE_URL}/auth/v1/keys`) and verify the token's signature. Use the `jose` library for JWT verification.
- Rationale: Workers must not be called without a valid authenticated session — otherwise anyone could rack up Gemini API costs

**Image storage: three R2 variants**
- Original (full resolution PNG from Gemini)
- 512px JPEG (resized in Worker using `@cf/image-resizing` or canvas-based approach)
- 256px JPEG (thumbnail)
- R2 paths: `species/original/{hash}.png`, `species/512/{hash}.jpg`, `species/256/{hash}.jpg`
- Public R2 URLs written to `species_images` table

**Field notes: Claude Haiku**
- Choice: Claude claude-haiku-4-5-20251001 for field notes generation
- Rationale: Fast, cheap, excellent at constrained creative writing; the Victorian naturalist voice prompt is well-suited to a fast model
- The prompt includes the creature DNA, and optionally the generated image (multimodal) to make the notes more specific

**Gemini model selection**
- The original implementation tried multiple models with fallback. Replicate this pattern: try `gemini-2.0-flash-preview-image-generation` first, fall back to available models.
- Build a detailed Victorian naturalist illustration prompt from the creature DNA (body plan, anatomy, colours, habitat — the reference prompt in `downloads-claude-ship/` is the gold standard)

### Worker structure

```
workers/
├── generate-creature/
│   ├── index.ts              # Main Worker handler
│   ├── prompt.ts             # Build Gemini prompt from DNA
│   ├── gemini.ts             # Gemini API client
│   ├── r2.ts                 # R2 upload helpers
│   └── index.test.ts
└── generate-field-notes/
    ├── index.ts              # Main Worker handler
    ├── prompt.ts             # Build Claude prompt from DNA
    ├── claude.ts             # Claude API client (Anthropic SDK)
    └── index.test.ts
```

**Worker request/response contract:**

`POST /api/generate-creature`
```typescript
// Request body
{ qrHash: string; dna: CreatureDNA }

// Response
{
  imageUrl: string        // R2 public URL (original)
  imageUrl512: string
  imageUrl256: string
  fieldNotes: string
  isFirstDiscoverer: boolean
  discoveryCount: number
}
```

`POST /api/generate-field-notes`
```typescript
// Request body
{ qrHash: string; dna: CreatureDNA; imageUrl?: string }

// Response
{ fieldNotes: string }
```

### Wrangler routes

```toml
[[routes]]
pattern = "/api/generate-creature"
script = "workers/generate-creature/index.ts"

[[routes]]
pattern = "/api/generate-field-notes"
script = "workers/generate-field-notes/index.ts"
```

### Discovery registration flow

After successful image generation:
1. Call `register_discovery` RPC (Supabase, service role from Worker)
2. RPC atomically increments `unique_discoverers`, `total_scans`, sets `first_discoverer_id` if first
3. Worker returns `isFirstDiscoverer` flag to frontend
4. Frontend stores creature in `creatures` table (client-side, user's JWT)
5. Frontend checks badge eligibility (Phase 7 will add this)

### Full hatching sequence (Phase 4 completion)

```
"FIELD SPECIMEN DETECTED"          1s
"SCANNING THE STRATA"              1s
"DECODING FOSSIL MATRIX"           1s
"COMMISSIONING ILLUSTRATION"       → call generate-creature Worker
"THE ARTIST IS DRAWING"            wait for Gemini response
[creature illustration fades in from shattering QR fossil matrix]
"COMPOSING FIELD NOTES"            → call generate-field-notes Worker (parallel or sequential)
"SPECIMEN CATALOGUED"              → complete
```

---

## Testing strategy

### Unit tests

**`workers/generate-creature/index.test.ts`**
- Valid JWT + valid DNA → returns image URLs
- Invalid/missing JWT → 401 response
- Already cached species → returns cached data, no Gemini call
- Gemini API error → graceful error response (500 with message)
- Uses mocked Gemini client and mocked R2 binding

**`workers/generate-field-notes/index.test.ts`**
- Valid request → returns field notes string
- Invalid JWT → 401
- Cached field notes → returns cached, no Claude call

**`useSpeciesImage.test.ts`**
- Returns cached image immediately if `species_images` has data
- Triggers Worker call if no cached image
- Handles Worker error gracefully

### Manual testing checklist
- [ ] Scan a brand new QR code → full hatching animation plays including AI phases
- [ ] AI illustration appears (Victorian engraving style, correct anatomy)
- [ ] Field notes appear with typewriter animation
- [ ] "FIRST DISCOVERER" notification appears on first scan
- [ ] Scan same code → instant cached result, no re-generation
- [ ] Scan same code as same user → duplicate toast
- [ ] Network error during generation → graceful error state, option to retry
- [ ] Worker responds in under 30 seconds (Gemini can be slow)
- [ ] Generated image stored correctly in R2 (check bucket in Cloudflare dashboard)

---

## Pre-commit checklist

- [ ] `bun run test` passes
- [ ] `bun run typecheck` passes
- [ ] `GEMINI_API_KEY` and `ANTHROPIC_API_KEY` in Wrangler secrets (not in `wrangler.toml`)
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
- Use `/review-pr-team` — security-sensitive (API keys, JWT verification, service role usage), and this is the core value-delivery feature of the entire app

### Deployment steps
1. Set Worker secrets: `wrangler secret put GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`
2. Deploy Workers: `wrangler deploy`
3. Test end-to-end: scan a real QR code in production
4. Verify image appears in R2 bucket
5. Verify `species_images` row created in Supabase

---

## Edge cases and considerations

### Known risks
- **Gemini latency:** Image generation can take 10–30 seconds. The hatching animation must handle extended waits gracefully without timing out. The "THE ARTIST IS DRAWING" phase should have no fixed timeout — it simply waits for the Worker response.
- **Gemini API changes:** The original implementation already handles multi-model fallback. The Gemini API for image generation is newer and models change. Keep the model selection list easy to update.
- **Worker cold starts:** Cloudflare Workers have near-zero cold start, but the first request to a new deployment can occasionally be slower. Not a concern in practice.
- **Concurrent first discoveries:** Two users scanning the same QR code simultaneously — the `register_discovery` RPC must be atomic (it is, using Postgres transactions). Both get a cached image after the first one completes generation.

### Security considerations
- JWT verification is the critical gate — without it, the Worker is an open API endpoint burning your API quota
- Service role key must never appear in frontend code or client-side requests
- R2 bucket: public read (images are public), write restricted to Workers only

### Cost considerations
- Gemini: pricing varies by model; free tier may apply for low volume
- Claude Haiku: very cheap per call (~$0.001 or less for field notes length)
- R2: first 10GB free, operations are fractions of a cent at this scale

---

## Related documentation

- [Phase 3](./03-creature-engine-cabinet.md) — Prerequisite (provides hatching animation scaffold)
- [Phase 5](./05-catalogue.md) — Next phase
- [environment-setup.md](../REFERENCE/environment-setup.md) — All API keys and secrets
- Reference: `downloads-claude-ship/qrious-project-code-2e8ffbe/supabase/functions/` — original Deno edge functions to adapt
