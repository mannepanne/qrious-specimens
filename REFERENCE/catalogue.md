# Species catalogue — implementation reference

**When to read:** Working on the catalogue page, `get_catalogue` RPC, species filters, or the `useCatalogue` hook.

---

## Overview

The species catalogue is the public-facing index of every creature species ever discovered. It is accessible to unauthenticated visitors (with a sign-up CTA) and is read-only for everyone — no personal data is displayed.

---

## Data architecture

### Source tables

| Table | Purpose |
|---|---|
| `species_images` | One row per unique QR hash. Stores image URLs, field notes, prompt, and discovery counters (initial values written by the Worker). |
| `creatures` | Each user's discovered creature rows. Contains `dna` JSONB with full taxonomy (genus, species, order, family, habitat, etc.). |
| `species_discoveries` | Authoritative discovery count and first-discoverer tracking. Updated atomically by the `register_discovery` RPC. |

### Why the join is needed

`species_images` stores only image/media data. All taxonomy fields (genus, species, order, family, habitat, temperament, estimated_size, symmetry, body_shape, limb_style, pattern_type) live in `creatures.dna` as JSONB. The `get_catalogue` RPC joins them via:

```sql
LEFT JOIN LATERAL (
  SELECT cr.dna
  FROM public.creatures cr
  WHERE cr.dna->>'hash' = si.qr_hash
  LIMIT 1
) c ON true
```

The `dna->>'hash'` field is the same 16-char hex hash stored as `species_images.qr_hash`.

---

## `get_catalogue` RPC

**Migration:** `supabase/migrations/20260411000000_add_catalogue_filtering.sql`

### Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `p_search` | text | NULL | ILIKE search across genus, species, order, family |
| `p_order_filter` | text | NULL | Exact match on taxonomic order |
| `p_habitat_filter` | text | NULL | Exact match on habitat |
| `p_symmetry_filter` | text | NULL | Exact match on symmetry |
| `p_body_shape_filter` | text | NULL | Exact match on body_shape |
| `p_limb_style_filter` | text | NULL | Exact match on limb_style |
| `p_pattern_type_filter` | text | NULL | Exact match on pattern_type |
| `p_rarity_filter` | text | NULL | `'rare'` (≤3), `'uncommon'` (4–15), `'common'` (≥16) discoverers |
| `p_limit` | integer | 24 | Page size |
| `p_offset` | integer | 0 | Pagination offset |

### Returns

Each row includes all taxonomy fields extracted from `creatures.dna`, image URLs, field notes, discovery metadata, and a `total_count` window-function column (total matching rows regardless of LIMIT).

### Security

- `SECURITY DEFINER` with `SET search_path = public` (prevents search path hijacking)
- Granted to `authenticated` and `anon` roles

---

## Frontend

### Hook: `useCatalogue(filters)`

**File:** `src/hooks/useCatalogue.ts`

`useInfiniteQuery` wrapping the `get_catalogue` RPC. Page size is 24. `getNextPageParam` uses `total_count` from the first row of each page to determine whether more pages exist.

```typescript
const { data, hasNextPage, fetchNextPage, isFetchingNextPage } = useCatalogue({
  search: 'Nebulo',
  order: 'Arachnoida',
  rarity: 'rare',
})
// data.pages is CatalogueEntry[][]
```

### Hook: `useCatalogueTaxonomy()`

Separate `useQuery` (not derived from infinite pages) that fetches up to 500 species with no filters and builds a `Map<string, number>` of order → count. Used by `TaxonomicSidebar`. Kept separate so sidebar counts are stable across paginated catalogue fetches.

### Components

| Component | File | Purpose |
|---|---|---|
| `CataloguePage` | `src/pages/CataloguePage.tsx` | Main page: search, filters, sidebar, grid, infinite scroll, detail overlay |
| `SpeciesCard` | `src/components/SpeciesCard/` | Grid card: thumbnail or sketch fallback, name, family, rarity badge |
| `TaxonomicSidebar` | `src/components/TaxonomicSidebar/` | Order list with counts; click to filter |
| `SpeciesDetail` | `src/components/SpeciesDetail/` | Full detail view inside dialog overlay |

### Species detail overlay

`SpeciesDetail` is rendered inside a `role="dialog" aria-modal="true"` overlay. Closes on:
- Click outside the content area
- Escape key (via `document.addEventListener`)
- Close button (✕)

Prev/next navigation between species uses `PageFlip` for the page-turn animation.

### Field notes auth-gating

- **Authenticated users:** Full field notes text shown
- **Unauthenticated visitors:** First 120 characters (nearest word boundary) shown, followed by a "Sign in to read the complete field notes" prompt

First discoverer credit is shown in `SpeciesDetail` when the discoverer has a public Gazette profile and the viewer is authenticated. Lookup runs via `useFirstDiscoverer(entry.first_discoverer_id, isAuthenticated && !!selectedEntry)` in `CataloguePage`; private profiles return no row, so their credit is suppressed at the DB layer. See `gazette.md` for full details.

### Sketch fallback

When no AI image (`image_url_512`/`image_url_256`) is available for a species, `generateCreatureDNA(entry.qr_hash)` is called to produce a deterministic sketch. Note: this uses the `qr_hash` string as the creature engine seed — it produces a different creature than the original scan (which used the full QR content string), but is visually consistent per species across all views.

---

## Known edge cases

- **Pagination drift:** `total_count` is a window function re-evaluated per page fetch. If a new species is discovered between page 1 and page 2 fetches, the counts can disagree slightly. See `technical-debt.md` TD-011.
- **Taxonomy sidebar lag:** `useCatalogueTaxonomy` has a 5-minute stale time. Sidebar counts won't reflect new discoveries immediately.
