# Creature engine — how it works

**When to read this:** Working on the scan flow, DNA generation, creature rendering, cabinet, or anything touching `CreatureDNA`.

**Related:**
- `src/lib/creatureEngine.ts` — DNA pipeline
- `src/hooks/useCreatures.ts` — DB reads/writes
- `src/components/CreatureRenderer/` — rendering
- `src/components/HatchingAnimation/` — scan ceremony
- `src/pages/CabinetPage.tsx` — cabinet grid
- `src/pages/SpecimenPage.tsx` — full specimen detail

---

## DNA pipeline

Any string (QR code content, manual entry) deterministically produces the same `CreatureDNA`. The pipeline is:

```
qrContent (string)
  → djb2 hash          → 32-bit integer seed for the PRNG
  → FNV-1a (two-round) → 16 hex character species hash (stored as qr_hash in DB)
  → mulberry32 PRNG    → sequence of floats used to derive all anatomy fields
  → CreatureDNA        → genus, species, order, family, body plan, colours, etc.
```

**Key properties:**
- Deterministic: same input always yields exactly the same DNA
- Collision-resistant: the double FNV-1a hash makes species-level collisions vanishingly unlikely
- Client-side only: no server involvement; DNA is generated in the browser before any DB write

The seed is stored in `dna.seed` and the hex hash in `dna.hash` (which matches `creatures.qr_hash` in the DB).

---

## Scan flow

```
User scans QR  →  handleScan()
                     │
                     ├─ Clamp content to 4096 chars
                     ├─ generateCreatureDNA(content)
                     ├─ Check React Query cache for dna.hash → duplicate? toast + exit
                     │
                     ├─ setOverlay('hatching')     ← animation starts immediately
                     │
                     └─ addCreature.mutateAsync()  ← DB insert runs in parallel
                              │
                              ├─ success → hatchingResultRef.current = row
                              └─ error  → hatchingErrorRef.current = message

Animation completes (onComplete via ref — no stale closure)
  →  handleHatchingComplete()
        │
        ├─ addCreature.isPending? → set animationDoneRef, wait
        │     (useEffect fires when isPending → false, calls finishHatching)
        │
        └─ finishHatching()
              ├─ hatchingResultRef.current → navigate to SpecimenPage
              ├─ error === 'DUPLICATE'     → toast (server-confirmed duplicate)
              └─ other error              → generic toast
```

**Why parallel insert + animation:** The ~4.9s hatching animation buys time for the DB insert. In practice a Supabase insert on a warm connection takes 200–800ms, so the result is ready well before the animation ends. The `animationDoneRef` pattern handles the rare slow-network case where the animation finishes first.

---

## Renderer

`CreatureRenderer` is a thin wrapper — all rendering goes through `CreatureRendererSketch`, which produces SVG output from `CreatureDNA` using:

- **Body shape:** Superformula (radiolarian/starfish/bell forms)
- **Limbs:** Catmull-Rom splines (tentacles), straight segments (jointed/spike), branching recursion
- **Surface pattern:** Stipple dots, cross-hatching, scales — drawn as additional SVG paths
- **Eye placement:** Distributed around the body perimeter using the PRNG
- **Optional features:** Shell, crown, antennae, tail — each conditionally rendered

The renderer is a pure function: `(CreatureDNA, props) → SVG`. No side effects, no external calls.

Phase 4 will add Gemini AI-generated illustrations shown on the SpecimenPage. The sketch renderer remains for teaser cards and as a fallback when no AI image exists yet.

---

## Cabinet and infinite scroll

`useCreatures(userId)` is a `useInfiniteQuery` with key `['creatures', userId]`. Pages are 30 items each, ordered by `discovered_at DESC`.

**Infinite scroll pattern:** `useIntersectionObserver` returns a callback ref (not a `useRef`). This matters — a callback ref fires whenever the sentinel element mounts or unmounts, so the observer attaches correctly even when the sentinel appears after the first data load (the empty-cabinet → populated transition).

```tsx
const sentinelRef = useIntersectionObserver(() => {
  if (hasNextPage && !isFetchingNextPage) fetchNextPage()
})
// ...
<div ref={sentinelRef} />
```

**Known limitation (TD-002):** `cabinetCreaturesRef` in `App.tsx` is a snapshot of `allCreatures` at the moment a specimen is opened. Subsequent page fetches don't update it, so prev/next navigation on the SpecimenPage operates on a stale list. Acceptable for Phase 3; will be addressed when the cabinet has enough users to make deep pagination common.

---

## Rarity

`useDiscoveryCounts(qrHashes)` fetches from `species_discoveries` — a count of unique users who have scanned each QR hash globally. `getRarityFromCount(count)` maps this to a tier:

- `undefined` / `null` → RARE (not yet in the discoveries table)
- 1 → RARE
- 2–5 → UNCOMMON
- 6–20 → COMMON
- 21+ → ABUNDANT

Rarity is intentionally "discovered" — a new user's entire cabinet shows RARE because they are the first (or among the first) to find each specimen. The label becomes meaningful as the community grows.

The first discoverer of a species is flagged via `is_first_discoverer` on the `creatures` row. This is set server-side by the `register_discovery` RPC in Phase 4. In Phase 3 it is always `false`; the nickname editing UI is present but gated by Phase 4 activation.

---

## DB schema (relevant tables)

```sql
creatures (
  id              uuid primary key,
  user_id         uuid references auth.users,
  qr_content      text,           -- raw QR string (clamped to 4096 chars)
  qr_hash         text,           -- 16 hex chars, deterministic from qr_content
  dna             jsonb,          -- full CreatureDNA object
  nickname        text,           -- user-assigned name (max 64 chars)
  discovered_at   timestamptz,
  is_first_discoverer boolean     -- set by register_discovery RPC (Phase 4)
)

species_discoveries (
  qr_hash   text,
  user_count int                  -- aggregated count of unique discoverers
)
```

Duplicate prevention: `UNIQUE(user_id, qr_hash)` constraint on `creatures`. A duplicate insert returns Postgres error code `23505`, which `useAddCreature` translates to the string `'DUPLICATE'`.
