# Phase 5: Catalogue

## Phase overview

**Phase number:** 5
**Phase name:** Catalogue
**Dependencies:** Phase 4 complete — AI generation working; species_images populated with real data

**Brief description:**
Builds the public-facing species catalogue: a paginated, searchable, filterable index of every species ever discovered by anyone. The Catalogue is accessible to unauthenticated visitors (with a sign-up CTA) and is the primary showcase of the project's accumulated discoveries. It includes a hierarchical Taxonomic Index sidebar, full-text search, trait filters, and a species detail page with page-flip animation between entries.

---

## Scope and deliverables

### In scope
- [ ] `CataloguePage` — paginated grid of all discovered species
- [ ] Species cards: creature illustration (or client-side SVG), species name, family, rarity badge
- [ ] **Taxonomic Index sidebar** — hierarchical tree of Orders with species counts; click to filter by order
- [ ] **Search** — by species name, order, habitat (debounced input)
- [ ] **Trait filters** — symmetry, body shape, limb style, pattern type, habitat, temperament (dropdown/chip filters)
- [ ] **Rarity filter** — Rare / Uncommon / Common
- [ ] Pagination — load 24 species per page; "Load more" button or infinite scroll
- [ ] Species detail view — click card → full species detail page within Catalogue
- [ ] `PageFlip` animation between species in detail view (existing component from Phase 3)
- [ ] Detail view content: illustration, full taxonomy, field notes, discovery metadata (date, rarity, discoverer count, total scans), first discoverer credit
- [ ] Sign-up CTA banner for unauthenticated visitors
- [ ] `useCatalogue` hook — wraps `get_catalogue` RPC with pagination + filter params
- [ ] `get_catalogue` RPC must support: search query, order filter, trait filters, pagination offset/limit
- [ ] Tests for `useCatalogue`, filter logic, search debounce

### Out of scope
- User-specific data (favourite, personal notes) — this is a public index
- Editing species data (admin only, Phase 8)

### Acceptance criteria
- [ ] Unauthenticated user can browse the catalogue (sign-up CTA visible but catalogue accessible)
- [ ] All 18 existing species visible in catalogue
- [ ] Searching "Nebulo" filters to matching orders/species
- [ ] Selecting a trait filter reduces the visible species accordingly
- [ ] Clicking an Order in the Taxonomic sidebar filters to that order
- [ ] Clicking a species card opens the detail view
- [ ] PageFlip animation plays between species
- [ ] Detail view shows AI illustration (or SVG fallback) + full taxonomy + field notes
- [ ] "Load more" loads next page of species
- [ ] `bun run test` passes; `bun run typecheck` passes

---

## Technical approach

### Architecture decisions

**`get_catalogue` RPC**
- Choice: Use the existing Supabase RPC (already in migrations) which joins `species_discoveries`, `species_images`, and applies filters server-side
- Rationale: Keeps complex filtering logic in Postgres where it's efficient; avoids fetching all species to the client and filtering in JS
- The RPC accepts: `search_query text`, `order_filter text`, `trait_filters jsonb`, `page_offset int`, `page_limit int`

**Taxonomic sidebar data**
- Built from the catalogue results (or a separate lightweight query) — group species by Order, count per Order
- Clicking an Order sets `order_filter` and refetches
- On mobile: sidebar collapses behind a "Taxonomy" toggle button

**Search debounce**
- 300ms debounce on the search input before triggering a new RPC call
- Clear filters button resets all active filters

### Key files

```
src/
├── pages/
│   └── CataloguePage.tsx
├── hooks/
│   ├── useCatalogue.ts
│   └── useCatalogue.test.ts
├── components/
│   ├── TaxonomicSidebar/
│   │   └── TaxonomicSidebar.tsx
│   ├── SpeciesCard/
│   │   └── SpeciesCard.tsx           # Catalogue grid card
│   └── SpeciesDetail/
│       └── SpeciesDetail.tsx         # Detail view (reuses SpecimenPage layout)
```

---

## Testing strategy

### Unit tests

**`useCatalogue.test.ts`**
- Default fetch returns paginated species list
- Search query is passed correctly to RPC
- Order filter is applied
- `loadMore` appends next page to results
- Empty results handled gracefully

**Filter logic tests**
- Active filters are reflected in RPC params
- Clearing filters resets to default catalogue
- Multiple filters combine correctly (AND logic)

### Manual testing checklist
- [ ] Catalogue loads with all 18 species visible (in paginated form)
- [ ] Search for a species name → filters results
- [ ] Select Order from Taxonomic sidebar → filters to that order
- [ ] Apply habitat filter → species list narrows
- [ ] Clear filters → full catalogue returns
- [ ] Click species card → detail view opens
- [ ] Navigate between species in detail view with arrows (PageFlip animation)
- [ ] Sign-up CTA banner visible when not logged in
- [ ] CTA banner not shown when logged in
- [ ] Mobile: sidebar toggle works

---

## Pre-commit checklist

- [ ] `bun run test` passes
- [ ] `bun run typecheck` passes
- [ ] RPC query tested with various filter combinations
- [ ] Empty state handled (no results for a filter)
- [ ] Unauthenticated access tested (Supabase anon key, RLS allows public read of species_images and species_discoveries)

---

## PR workflow

### Branch naming
```
feature/phase-5-catalogue
```

### Review requirements
- Use `/review-pr` — standard feature, no security concerns (all data is public)

---

## Related documentation

- [Phase 4](./04-ai-generation-workers.md) — Prerequisite
- [Phase 6](./06-gazette.md) — Next phase
- [Master specification](./ORIGINAL_IDEA/SPEC-DOWNLOADED-ORIGINAL-IMPLEMENTATION.md) — Catalogue section
- Reference: `downloads-claude-ship/qrious-project-code-2e8ffbe/src/pages/CataloguePage.tsx`
