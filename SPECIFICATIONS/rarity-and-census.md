# Rarity and the Society's Census

**Status:** Spec
**Type:** Feature (post-launch)
**Working branch:** `feature/rarity-and-census` (when implementation begins)
**Sibling spec:** [`gazette-feed-redesign.md`](./ARCHIVE/gazette-feed-redesign.md) — shipped; the Field Dispatches feed is the home for the new tier-change posts
**Predecessor (rejected):** [`rarity-and-census-trait-surprisal.md`](./ARCHIVE/rarity-and-census-trait-surprisal.md) — explains why the trait-distribution approach was rejected and what was kept for this spec

---

## Overview

Rarity in QRious Specimens reflects **how many distinct explorers have found a given species**. A specimen with three discoverers is genuinely uncommon; a specimen with fifty is commonplace. Rarity is a live property of the world, not a frozen badge stamped at the moment of discovery: as the catalogue fills, specimens move between tiers, and the cabinet reflects each shift the next time it's visited.

This spec also adds a small Gazette content layer: when a discovery moves a species across a tier boundary, the Society notices and publishes a short notice. These posts fire organically — only when something actually changes — so the feed stays meaningful without a weekly cron.

Three principles drive the design:

1. **Rarity is observable, not algorithmic.** Tier is derived live from `species_discoveries.discovery_count`. Three tiers, retuned absolute thresholds, no percentile labels, no surprisal scoring. A user can read the count themselves and predict the tier. *(See the rejected predecessor spec for why we are not pursuing trait-distribution rarity.)*
2. **Rarity changes when the world changes.** No `rarity_at_discovery` snapshot. A specimen you found when it was Extraordinary may show as Notable today; that is the point. The cabinet is a window onto the current world, not a museum of past states.
3. **Field-note prose is timeless.** Field notes and pull-quotes never reference a specimen's current or past tier. They describe the creature, not the catalogue's opinion of it. A specimen's prose stays accurate as the catalogue grows around it.

This spec **renames** the existing `rare/uncommon/common` system to `Extraordinary/Notable/Common`, retunes thresholds, and introduces a single new `tier_change` activity-feed event type. It does **not** add new tables, schedulers, or snapshot columns.

---

## Goals

- Rebadge tier vocabulary to fit the Victorian-naturalist Society voice
- Retune count thresholds against current catalogue state and future growth
- Surface tier changes as organic Gazette posts when they happen, not on a cron
- Replace `rare_count` semantics across the explorer rank and showcase to keep the new vocabulary internally consistent
- Resolve TD-012 cleanly (the unfired `rare_discovery` event was already removed; nothing to revive)

## Non-goals

- Snapshot at discovery (`rarity_at_discovery` column) — explicitly rejected; tier is live
- Trait-distribution rarity / percentile scoring — see rejected predecessor spec
- Weekly batch recalculation or scheduled Census Notice — replaced by per-event tier-change posts
- Anti-gameability defences (out of scope; single-trusted-team threat model)
- Hand-curated rarity overrides (a `species.editor_pick` orthogonal feature could come later, separate spec)
- Cabinet-side tier-change highlighting (deferred — see §Future considerations)
- Localisation of tier-change copy

---

## The model

### Vocabulary

| Internal | Display | Sense |
|---|---|---|
| `extraordinary` | "Extraordinary" | Rarely found; the Society notes it |
| `notable` | "Notable" | Documented, but uncommon enough to remark on |
| `common` | "Common" | Settled into the catalogue; routinely retrieved |

### Thresholds

| Tier | `discovery_count` |
|---|---|
| Extraordinary | `≤ 3` |
| Notable | `4–15` |
| Common | `≥ 16` |

These are the existing thresholds, kept under the new names. The numbers are an editorial judgement, not a derivation; they should be revisited if the catalogue's actual discovery-count distribution drifts away from the intended split (roughly: the long tail is Extraordinary, the bulge is Notable, the well-known specimens are Common).

The constants live in `src/lib/rarity.ts` and the catalogue filter in `get_catalogue.sql`. Both must be kept in sync — see §Implementation plan.

### Storage

Tier is **derived live** from `discovery_count` at every read. There is no stored `rarity_label` column on `species_images`, no `rarity_at_discovery` column on `creatures`, and no `rarity_snapshots` table. `getRarityFromCount()` and the catalogue's `CASE` clause are the source of truth.

This means a specimen's tier reflects the world at read time, which is the design intent. It also means there is nothing to migrate, nothing to backfill, and no snapshot job to maintain.

---

## Tier-change Gazette posts

### When a post fires

When `register_discovery` increments `species_discoveries.discovery_count`, it computes the tier *before* the increment and the tier *after*. If they differ, it emits a row into `activity_feed` with `event_type = 'tier_change'`. The discovery itself still emits its own `discovery` or `first_discovery` event — these are two separate Gazette entries on the same beat.

In practice, threshold crossings are rare:

- `3 → 4` (Extraordinary → Notable): once per species, the first time a fourth distinct explorer finds it
- `15 → 16` (Notable → Common): once per species, when the sixteenth explorer finds it

Each species crosses each boundary at most once in the forward direction. (Tier *regressions* — a species losing discoveries via account deletion — are possible in principle; same prose template, different verb. See §Edge cases.)

### What a post says

The Society's voice. One to two sentences. Mentions the binomial as an inline link to the species page. Notes the new tier in the Society's idiom ("settled into Notable", "elevated to Extraordinary", "lapsed into Common"). Optionally references the discovery count or the act of recent retrieval. Never speculates about *why* the change happened.

Example copy:

> *Concha occidentalis* has settled into the Notable tier this morning, the eighth specimen retrieved from the eastern shores.

> *Folium susurrans* has lapsed into the Common tier; the Society has noted thirty-seven retrievals to date.

> *Larva nocturnalis* has been elevated to the Extraordinary tier following recent reassessment.

The copy is generated by a one-shot Claude Haiku call from the discovery worker, in the same style as the existing `pull_quote` generation. The prompt template lives at `workers/generate-creature/prompt.ts`. The output is stored on the `activity_feed` row (in a new column, see §Database changes).

### How a post renders

A new `TierChangeDispatch` component in `src/components/ActivityTimeline/`, sitting alongside `CompactDispatch`, `FeaturedDispatch`, and `BadgeDispatch`. Visual weight: similar to `BadgeDispatch` — a noteworthy-but-not-headline event. Italic serif Society copy, fleuron decoration, binomial as a styled inline link.

The `pickFeaturedId` rule in `ActivityTimeline.tsx` does not promote `tier_change` events to dispatch-of-the-day. They are always rendered as compact-tier inline.

---

## Existing rarity surfaces — audit and rename

These surfaces all read `discovery_count` today and assign a tier from it. The model is unchanged; only the vocabulary and the threshold constants are touched.

| Surface | File | Change |
|---|---|---|
| Cabinet card | `src/components/CabinetCard.tsx` | Read tier via `getRarityFromCount()`; rename label string |
| Catalogue card | `src/components/SpeciesCard.tsx` | Same as cabinet card |
| Species detail page | `src/pages/SpecimenPage.tsx` | Same |
| Catalogue filter | `src/components/CatalogueFilter.tsx` + `get_catalogue.sql` | Rename `p_rarity_filter` accepted values to `extraordinary | notable | common`; CASE keeps the count ranges |
| Explorer rank breakdown | `src/components/ExplorerRank.tsx` | Rename "Rare" → "Extraordinary" in the breakdown copy |
| Showcase profile stats | `useCommunity.ts:41` (`rare_count`) | Rename to `extraordinary_count`; keep the same `discovery_count <= 3` derivation |
| Badge gating | `check_and_award_badges` (`supabase/migrations/20260419000001_phase9_coastal_perseverance_badge.sql:35,53-54`) | `rare_find` and `connoisseur` badges keep their count-threshold logic; comment updated to use the new vocabulary |

There is **no separate** `species.rarity_label` column to keep in sync. There is **no** `rarity_at_discovery` to backfill. The audit is purely a label rename plus a threshold-constant centralisation.

---

## Database changes

Only two migrations:

**1. Loosen `activity_feed_event_type_check`** to admit `tier_change`:

```sql
ALTER TABLE public.activity_feed
  DROP CONSTRAINT IF EXISTS activity_feed_event_type_check,
  ADD CONSTRAINT activity_feed_event_type_check
    CHECK (event_type IN ('discovery', 'first_discovery', 'badge_earned', 'tier_change'));
```

**2. Modify `register_discovery`** to compute old and new tiers from the count and insert a `tier_change` event row when they differ. The function returns a structured row indicating whether a tier change occurred so the worker can issue the follow-up Anthropic call:

```sql
CREATE OR REPLACE FUNCTION public.register_discovery(p_qr_hash text, p_user_id uuid)
RETURNS TABLE (
  is_first_discoverer boolean,
  tier_changed boolean,
  old_tier text,
  new_tier text,
  new_discovery_count integer
) ...
```

The function uses three constants for the thresholds — defined inline in the function body, mirrored in `src/lib/rarity.ts`. A short comment in both places notes the cross-file invariant.

Tier prose is stored on the `activity_feed` row itself. The `activity_feed` table has no general-purpose JSON payload column; rather than adding one, this spec adds a single nullable `tier_change_body text` column on `activity_feed`. The worker fills it in immediately after the Anthropic call. `get_community_feed` returns it in the row payload.

(Open question: is a dedicated column the right call, or should we add a generic `payload jsonb`? See §Open questions.)

---

## Worker pipeline

When the discovery flow calls `register_discovery` and sees `tier_changed = true`:

1. Build a tier-change prompt with `buildTierChangeNoticePrompt({ binomial, oldTier, newTier, newDiscoveryCount })`
2. Call Claude Haiku via the existing `generate-creature` worker's Claude pathway
3. UPDATE the just-inserted `activity_feed` row to set `tier_change_body` to the returned prose
4. If the Claude call fails, the row stays with `tier_change_body = NULL`; `TierChangeDispatch` falls back to a hand-written template that uses just the binomial and tier names. The post is never silently dropped.

The Anthropic call costs are bounded by the rate of threshold crossings (rare). No new rate limiting is required beyond what `generate-creature` already has.

---

## Implementation plan

Single PR, single deploy. Migrations land before merge; worker + frontend deploy together.

1. **Migrations** — `…_activity_feed_tier_change_event_type.sql` (constraint + column), `…_register_discovery_tier_change.sql` (function rewrite)
2. **`src/lib/rarity.ts`** — Rename `Rarity` union to `'extraordinary' | 'notable' | 'common'`; rename helpers; centralise threshold constants (`EXTRAORDINARY_MAX = 3`, `NOTABLE_MAX = 15`)
3. **Frontend rename pass** — every consumer of `Rarity` (cabinet card, species card, specimen page, explorer rank, useCommunity types, catalogue filter)
4. **`get_catalogue` rarity filter** — rename accepted values; CASE ranges unchanged
5. **`get_community_feed` RPC** — surface `tier_change_body` and the species `binomial` for `tier_change` rows; `useCommunity` `FeedEntry` type extended
6. **`TierChangeDispatch` component** + tests
7. **`ActivityTimeline.tsx`** — wire the new event type into the dispatcher; `pickFeaturedId` excludes `tier_change` from featured slot
8. **Worker** — `buildTierChangeNoticePrompt()`, `generateTierChangeNotice()`, discovery-flow integration
9. **Worker tests** — corpus regression for tier-change copy variety
10. **REFERENCE/gazette.md** — extend the activity-feed event-type table with `tier_change`
11. **REFERENCE/creature-engine.md** — note the rarity vocabulary and live-derivation rule

No backfill is required. Existing discoveries continue to read their tier live from `discovery_count`; the rename is mechanical.

---

## Edge cases

- **Tier regression.** If `discovery_count` ever decreases (e.g. account deletion of a first discoverer where no other explorer has found the species), the tier may regress. `register_discovery` is increment-only, so regressions happen elsewhere — `delete_user_account` would need to detect this and emit a regression `tier_change` event with `old_tier > new_tier`. **Recommendation: defer this.** Account deletion is rare; tier regression from deletion is even rarer. Left as a known gap, tracked as TD when this spec ships.
- **Concurrent tier crossings.** Two near-simultaneous discoveries that would each cross a tier boundary cannot both fire — the atomic UPDATE in `register_discovery` serialises increments. Whichever transaction commits first is the one that emits the `tier_change` event.
- **First discovery is also a tier change.** Cannot happen: a brand-new species starts with `discovery_count = 1` (Extraordinary), and the first row inserted is a `first_discovery`, not a `tier_change`. There is no tier *before* the first discovery to compare against.
- **Anthropic call fails after `register_discovery` succeeds.** The `tier_change` row is committed without a body. `TierChangeDispatch` renders a hand-written fallback. A subsequent retry script (out of scope for v1) could fill in missing bodies later if needed.

---

## Open questions

1. **Tier-change body storage.** `tier_change_body text` column on `activity_feed`, or generic `payload jsonb`? Dedicated column is simpler and clearer; jsonb is more extensible if future event types want their own bodies. *Recommendation: dedicated column. Re-evaluate if a third event type also needs a body.*
2. **Threshold validation.** The current numbers (`≤3`, `4–15`, `≥16`) inherit from the launched system and have never been validated against actual discovery cadence. Worth a one-off SQL query against production once shipped to see how the catalogue currently distributes across tiers, and whether the split feels right.
3. **Cabinet visual cue on tier change** (deferred — see §Future considerations). Ship without and add only if the silent-change UX feels too quiet in practice.

---

## Future considerations

- **Subtle "tier shifted" cabinet highlight.** First visit to the cabinet after a specimen you found has changed tier could show a small visual cue (a fleuron, a one-line italic note in the card hover) dismissed on click. Not part of v1; revisit if the silent-change UX feels too quiet. Cheap to add later if introduced.
- **`species.editor_pick boolean`** as an orthogonal admin curation surface. The Society's "noteworthy specimens" need not coincide with the rarity tiers. Not part of this spec; mentioned here so it's on the radar.
- **Tier-change-rate retro.** A periodic admin-only view showing how many tier changes have fired and across which species would help validate that the threshold numbers feel right. Pure observability, not user-facing.

---

## Out of scope (and why)

- **Trait-distribution surprisal scoring.** See the rejected predecessor spec — solves an out-of-scope threat at high cost.
- **Snapshot at discovery.** Explicitly rejected. The cabinet showing live tiers *is* the design.
- **Weekly Census Notice cron.** Replaced by organic per-event `tier_change` posts.
- **Anti-gameability defences.** Project's threat model is single-trusted-team; magic-link auth; Magnus as admin.
