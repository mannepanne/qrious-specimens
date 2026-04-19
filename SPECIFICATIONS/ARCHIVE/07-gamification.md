# Phase 7: Gamification — badges & explorer rank

## Phase overview

**Phase number:** 7
**Phase name:** Gamification — badges & explorer rank
**Dependencies:** Phase 6 complete — Gazette working; Phase 4 complete — discovery registration in place

**Brief description:**
Implements the achievement system: the 10 badge types across three tiers (Bronze/Silver/Gold), the badge-checking RPC that evaluates and awards badges after each discovery, and the Explorer Rank progression system (Unranked → Bronze → Silver → Gold → Platinum). Badge icons appear in the Gazette Explorer Showcase, rank-up toasts fire when a user crosses a threshold, and the full rank card with progress bar is visible in the Settings page (Phase 8 integrates this into the Settings layout). This phase adds the motivational loop that rewards continued exploration.

---

## Scope and deliverables

### In scope
- [ ] Wire up `check_and_award_badges` RPC call after each successful discovery (in the scan/hatching flow)
- [ ] Wire up `calculate_explorer_rank` RPC call after each discovery and badge award
- [ ] Toast notifications for newly awarded badges (badge icon, name, tier)
- [ ] Toast notification for rank-up (new rank name with tier-specific styling)
- [ ] `ExplorerRankCard` component — rank name, tier-specific colours/glow, progress bar to next rank, score, stat breakdown (badges, specimens, species, rare finds, first discoveries, days active)
- [ ] `BadgeCollection` component — all 10 badge definitions displayed; earned show tier (Bronze/Silver/Gold); unearned show "LOCKED"
- [ ] Badge icons in Explorer Showcase (Gazette) populated now that badges are being awarded
- [ ] `useBadges` or extend `useCommunity` — queries `explorer_badges` and `badge_definitions`
- [ ] Badge award entries written to `activity_feed` (badge-type entries in the Gazette timeline)
- [ ] Explorer rank badge displayed in Cabinet header
- [ ] Tests for badge notification rendering, rank card rendering

### Out of scope
- Settings page layout (that's Phase 8 — the rank card and badge collection components built here will be dropped into the Settings layout there)
- Admin tools for managing badges

### Acceptance criteria
- [ ] Scanning a new QR code triggers badge check after discovery registration
- [ ] First-specimen badge awarded immediately on first discovery
- [ ] Toast appears with badge name, tier, and icon
- [ ] Badge appears in `BadgeCollection` as earned (with tier label)
- [ ] `ExplorerRankCard` shows current rank, score, and progress to next
- [ ] Rank-up toast fires when score crosses a threshold
- [ ] Badge award appears in Gazette activity feed
- [ ] Explorer Showcase shows badge icons for each explorer
- [ ] `bun run test` passes; `bun run typecheck` passes

---

## Technical approach

### Badge definitions (from database, not hardcoded)

The `badge_definitions` table holds all 10 badge types (slug, name, description, icon emoji, tier, sort order). The evaluation logic lives in the `check_and_award_badges` PL/pgSQL function already in the database (from migrations). The frontend just calls the RPC and receives `{ badge_slug, tier, newly_awarded }[]` in response.

**Badge criteria (evaluated in PL/pgSQL):**
- First specimen collected
- 5, 10, 25 specimens
- Rare specimen discovered
- First discoverer of a species
- 3, 5 first discoveries
- 5 distinct species orders
- 7 consecutive days active

**Explorer Rank scoring formula** (evaluated by `calculate_explorer_rank` RPC):
- Badge points: bronze=1, silver=2, gold=3
- Breadth multiplier per badge tier
- `floor(sqrt(specimen_count)) * 0.8`
- `0.5` per unique species
- `0.8` per rare find
- Pioneer bonus: `power(first_discoveries, 1.1) * 0.5`
- Activity: `ln(days_active + 1) * 1.5`
- Curiosity: `ln(page_views + 1) * 0.8`
- Hidden bonuses (Collector's Resolve, Naturalist's Instinct)

**Rank thresholds:** Bronze=8, Silver=35, Gold=100, Platinum=250

### Discovery flow integration

After `register_discovery` RPC succeeds:
1. Call `check_and_award_badges` RPC → get list of newly awarded badges
2. For each newly awarded badge, show toast notification
3. Write badge entries to `activity_feed` (one entry per new badge)
4. Call `calculate_explorer_rank` RPC → get new rank + score
5. If rank tier has increased since last cached value, show rank-up toast

### Key files

```
src/
├── hooks/
│   ├── useBadges.ts
│   └── useBadges.test.ts
├── components/
│   ├── ExplorerRankCard/
│   │   ├── ExplorerRankCard.tsx
│   │   └── ExplorerRankCard.test.tsx
│   └── BadgeCollection/
│       ├── BadgeCollection.tsx
│       └── BadgeCollection.test.tsx
```

The rank card and badge collection are built as standalone components here, then composed into the Settings page in Phase 8.

---

## Testing strategy

### Unit tests

**`ExplorerRankCard.test.tsx`**
- Renders correct rank name for each tier
- Progress bar width reflects score-to-next-rank ratio
- Stat grid shows correct values
- Platinum rank shows "MAX" instead of progress bar

**`BadgeCollection.test.tsx`**
- Earned badges show tier label
- Unearned badges show "LOCKED"
- All 10 badge definitions rendered
- Sort order respected

**`useBadges.test.ts`**
- Returns merged list of definitions + earned status
- `checkAndAwardBadges` calls correct RPC

### Manual testing checklist
- [ ] Scan a new QR → badge toast appears within seconds of hatching completion
- [ ] Badge appears as earned in Settings → Achievements (Phase 8 integration)
- [ ] Rank-up toast fires after crossing threshold
- [ ] Badge entry appears in Gazette timeline
- [ ] Explorer Showcase shows badge icons on profile cards
- [ ] Cabinet header shows current rank badge

---

## Pre-commit checklist

- [ ] `bun run test` passes
- [ ] `bun run typecheck` passes
- [ ] Badge RPCs return correct `newly_awarded` flags (test with fresh user)
- [ ] Rank calculation is idempotent (calling twice with same data returns same result)

---

## PR workflow

### Branch naming
```
feature/phase-7-gamification
```

### Review requirements
- Use `/review-pr` — badge logic is in Postgres (already tested in migrations); frontend is display only

---

## Edge cases and considerations

### Known risks
- **Race condition on badge check:** If the user triggers two discoveries very quickly, two `check_and_award_badges` calls could run concurrently. The RPC must be idempotent (it is, by design — it only inserts badges not already in `explorer_badges`).
- **Rank score caching:** `calculate_explorer_rank` is called on every discovery. If a user has thousands of specimens, this RPC could be slow. At current scale (16 creatures, one user) this is not a concern. Add to technical debt for future optimisation.

### Mary Anning connection
- The badge names and descriptions are a great opportunity. Consider badge names like "Coastal Naturalist" (first rare find), "The Lyme Connexion" (first discoverer of 3 species), "Specimen of Note" (featured in gazette). These feel Victorian without being on-the-nose.

---

## Related documentation

- [Phase 6](./06-gazette.md) — Prerequisite (Gazette needed for badge feed entries)
- [Phase 8](./08-settings-admin.md) — Integrates ExplorerRankCard and BadgeCollection into Settings layout
- [Master specification](./ORIGINAL_IDEA/SPEC-DOWNLOADED-ORIGINAL-IMPLEMENTATION.md) — Achievement system section
