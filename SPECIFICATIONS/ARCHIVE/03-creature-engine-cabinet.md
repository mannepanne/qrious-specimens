# Phase 3: Creature engine & cabinet

## Phase overview

**Phase number:** 3
**Phase name:** Creature engine & cabinet
**Dependencies:** Phase 2 complete — auth working, navigation shell in place

**Brief description:**
Implements the core creature mechanics: the deterministic DNA engine that turns any QR code into a unique species, the QR scanner, all four creature rendering styles, the hatching animation (without the AI wait phases — those come in Phase 4), and the Cabinet — the user's personal specimen collection. By the end of this phase, a user can scan a QR code, watch the hatching sequence, and see a rendered creature added to their cabinet.

Note: In this phase, the "Generative Sketch" style (AI illustration) will fall back to the "Explorer Sketch" client-side SVG style until Phase 4 wires up the Cloudflare Worker image generation. The rest of the hatching phases that depend on AI calls will be skipped.

---

## Scope and deliverables

### In scope
- [ ] `creatureEngine.ts` — deterministic DNA generation from QR content string (16-char hex hash, full taxonomy, anatomy, colours, habitat, temperament)
- [ ] `rarity.ts` — rarity computation from unique discoverer count
- [ ] QR scanner (`QrScanner` component) — camera overlay, decodes QR codes
- [ ] `HatchingAnimation` component — multi-phase cinematic sequence with Victorian Gothic compass rose spinner; AI-dependent phases skipped for now (a simplified "SPECIMEN CATALOGUED" flow)
- [ ] `CreatureRenderer` — delegates to style-specific renderer
- [ ] `CreatureRendererSketch` — client-side SVG ink-on-parchment style
- [ ] `CreatureRendererVolumetric` — client-side SVG with shaded volumetric forms
- [ ] `CreatureRendererScifi` — client-side SVG neon sci-fi aesthetic
- [ ] `CreatureRendererGenerative` — displays AI illustration if available, falls back to Sketch
- [ ] `useCreatureStyle` hook + context — localStorage-backed style preference
- [ ] Cabinet view (`CabinetPage`) — authenticated grid of user's collected specimens
- [ ] `SpecimenTeaser` card — thumbnail + species name + family + rarity badge
- [ ] `SpecimenPage` overlay — full detail view: illustration, taxonomy, field notes placeholder, discovery metadata, nickname field, navigation arrows
- [ ] `useCreatures` hook — fetch user's creatures, insert new creature
- [ ] Duplicate scan detection — toast if same QR already in cabinet
- [ ] First discoverer detection (from `register_discovery` RPC response)
- [ ] `TypewriterText` component — typewriter effect for field notes (renders static text for now)
- [ ] `PageFlip` animation component (for specimen navigation)
- [ ] Tests for `creatureEngine`, `rarity`, `useCreatures`, `CreatureRendererSketch`

### Out of scope
- AI image generation (Phase 4) — `CreatureRendererGenerative` falls back to Sketch
- Field notes generation (Phase 4) — specimen page shows placeholder text
- Discovery registration RPC (that's wired up in Phase 4 alongside generation)
- Badge checking (Phase 7)
- Explorer rank (Phase 7)
- Public catalogue (Phase 5)

### Acceptance criteria
- [ ] Given a QR content string, `creatureEngine.generateFromContent(str)` always returns the same DNA object deterministically
- [ ] DNA contains all required fields: hash (16 hex chars), taxonomy (order/family/genus/species), body plan, colours, habitat, temperament, size
- [ ] QR scanner opens camera, decodes a QR code, triggers hatching sequence
- [ ] Hatching sequence plays through all non-AI phases, ends with specimen visible
- [ ] Specimen card appears in Cabinet after scan
- [ ] Scanning same QR code again shows duplicate toast, does not add to cabinet
- [ ] Specimen page opens with full taxonomy, renders creature in current style
- [ ] Switching creature style (via selector) re-renders all specimens in new style
- [ ] `bun run test` passes; `bun run typecheck` passes

---

## Technical approach

### Architecture decisions

**DNA generation from QR content (not URL)**
- Choice: Hash the entire QR code content string (SHA-256 → 16 hex chars) to get the species hash; use a seeded PRNG to generate all DNA fields deterministically from that hash
- Rationale: Deterministic — same QR code always → same creature, regardless of when or where scanned. Works with any QR code, not just URLs.
- The existing `creatureEngine.ts` in `downloads-claude-ship/` is the reference implementation — adapt it directly

**Four creature rendering styles**
- Choice: Client-side SVG for Sketch, Volumetric, Sci-Fi; AI illustration (R2 image) for Generative
- Rationale: Client-side styles work offline and instantly; Generative is the premium experience that requires the AI Worker (Phase 4)
- Style stored in localStorage so it persists across sessions

**QR scanning library**
- Choice: `html5-qrcode` (same as original implementation)
- Rationale: Proven, handles camera permissions, works on iOS/Android, pure JS
- Alternative: `@zxing/browser` — also good, either works

**Cabinet layout**
- Responsive grid: 2 columns on mobile, 3 on tablet, 4+ on desktop
- Infinite scroll with `useIntersectionObserver` (load more as user scrolls)
- Each card: creature renderer at fixed aspect ratio, species name, family, rarity badge

### Creature DNA structure

```typescript
interface CreatureDNA {
  hash: string           // 16-char hex — unique species identifier
  order: string          // e.g. "Nebulozoa"
  family: string         // e.g. "Arcturidae"
  genus: string          // e.g. "Corderma"
  species: string        // e.g. "gracilis"
  bodyShape: string      // elongated | compact | spherical | flat | branching
  symmetry: string       // bilateral | radial | asymmetric | fractal
  limbCount: number
  limbStyle: string      // spike | tendril | paddle | claw | fin | none
  eyeCount: number
  eyeStyle: string       // slit | compound | single | stalked
  habitat: string        // benthic | pelagic | arboreal | subterranean | aerial
  temperament: string    // sessile | docile | territorial | migratory
  estimatedSize: string  // e.g. "12–18 cm"
  patternType: string    // dots | stripes | mottled | iridescent | plain
  hue1: number           // 0–360
  hue2: number           // 0–360
  saturation: number     // 0–100
  lightness: number      // 0–100
}
```

### Key files

**New files to create:**
```
src/
├── lib/
│   ├── creatureEngine.ts
│   ├── creatureEngine.test.ts
│   ├── rarity.ts
│   └── rarity.test.ts
├── types/
│   └── creature.ts
├── hooks/
│   ├── useCreatures.ts
│   ├── useCreatures.test.ts
│   ├── useCreatureStyle.tsx          # Context + hook
│   └── useIntersectionObserver.ts
├── pages/
│   └── CabinetPage.tsx
├── components/
│   ├── QrScanner/
│   │   └── QrScanner.tsx
│   ├── HatchingAnimation/
│   │   └── HatchingAnimation.tsx     # Compass spinner SVG + phase text
│   ├── CreatureRenderer/
│   │   ├── CreatureRenderer.tsx
│   │   ├── CreatureRendererGenerative.tsx
│   │   ├── CreatureRendererSketch.tsx
│   │   ├── CreatureRendererVolumetric.tsx
│   │   ├── CreatureRendererScifi.tsx
│   │   └── CreatureRenderer.test.tsx
│   ├── SpecimenTeaser/
│   │   └── SpecimenTeaser.tsx
│   ├── TypewriterText/
│   │   └── TypewriterText.tsx
│   └── PageFlip/
│       └── PageFlip.tsx
├── pages/
│   └── SpecimenPage.tsx              # Full detail overlay
```

### Hatching animation phases (Phase 3 implementation)

Without AI calls, the sequence is:
1. "FIELD SPECIMEN DETECTED" — 1s
2. "SCANNING THE STRATA" — 1s
3. "DECODING FOSSIL MATRIX" — 1s
4. "SPECIMEN CATALOGUED" — creature fades in

Phases 5–7 (image generation, field notes) are added in Phase 4.

The Victorian Gothic compass rose spinner (ornate SVG with fleur-de-lis cardinal points, decorative rings, rosette, tick marks) rotates continuously during the wait. See the original `HatchingAnimation` in `downloads-claude-ship/` as reference.

---

## Testing strategy

### Unit tests

**`creatureEngine.test.ts`**
- Same QR content always produces same DNA (deterministic)
- DNA hash is always 16 hex characters
- All required DNA fields are present and within valid ranges
- Different QR content strings produce different DNA
- Edge cases: empty string, very long string, non-ASCII content

**`rarity.test.ts`**
- 1 discoverer → "Rare"
- 3 discoverers → "Rare"
- 4 discoverers → "Uncommon"
- 15 discoverers → "Uncommon"
- 16 discoverers → "Common"
- 0 discoverers → handle gracefully

**`useCreatures.test.ts`**
- Fetches user's creatures from Supabase
- `insertCreature` mutation adds a creature
- Duplicate detection returns correct boolean

**`CreatureRendererSketch.test.tsx`**
- Renders SVG element
- SVG reflects DNA properties (limb count, body shape, colours)

### Manual testing checklist
- [ ] Point phone at a QR code → scanner detects it
- [ ] Hatching animation plays smoothly, compass rotates
- [ ] Creature appears at end of hatching sequence
- [ ] Creature visible in Cabinet grid
- [ ] Tap creature card → Specimen page overlay opens
- [ ] Specimen page shows full taxonomy
- [ ] Navigate between specimens with arrows
- [ ] Scanning same code → duplicate toast, cabinet unchanged
- [ ] Switch render style → all creatures update
- [ ] Cabinet scrolls, loads more creatures as you scroll

---

## Pre-commit checklist

- [ ] `bun run test` passes
- [ ] `bun run typecheck` passes
- [ ] `creatureEngine` tested with at least 10 distinct inputs
- [ ] No camera permission errors on iOS Safari (requires HTTPS)
- [ ] Compass rose SVG renders correctly on mobile viewport

---

## PR workflow

### Branch naming
```
feature/phase-3-creature-engine-cabinet
```

### Review requirements
- Use `/review-pr` — standard feature PR; no security-sensitive code, no database migrations

---

## Edge cases and considerations

### Known risks
- **Camera on iOS:** `html5-qrcode` requires HTTPS on iOS for camera access. Fine in production (`https://qrious.hultberg.org`) but local dev needs either a self-signed cert or testing on Android.
- **QR code content variety:** QR codes can contain URLs, plain text, vCards, WiFi credentials, binary data. The DNA engine must handle any content as a raw string and hash it — the content type doesn't matter.
- **SVG creature rendering complexity:** The three client-side SVG styles are intricate. The reference implementations in `downloads-claude-ship/` should be adapted directly rather than rewritten from scratch.

### Performance considerations
- Cabinet uses infinite scroll — fetch 20 specimens at a time to avoid loading everything at once
- Client-side SVG rendering is synchronous but fast — no async needed
- Creature renderer should memoize SVG output based on DNA hash to avoid re-renders

### Mary Anning connection
- The hatching animation phase texts are a wonderful place for Victorian field expedition language. Mary Anning's field notes described fossils she uncovered layer by layer. "SCANNING THE STRATA" is already perfect — she literally scanned the Blue Lias strata at Lyme Regis.

---

## Related documentation

- [Phase 2](./02-auth-design-system.md) — Prerequisite
- [Phase 4](./04-ai-generation-workers.md) — Adds AI illustration and field notes to this phase's scaffold
- [Master specification](./ORIGINAL_IDEA/SPEC-DOWNLOADED-ORIGINAL-IMPLEMENTATION.md) — Scanning, hatching, and cabinet sections
- Reference implementation: `downloads-claude-ship/qrious-project-code-2e8ffbe/src/lib/creatureEngine.ts`
