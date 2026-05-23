# The Explorer's Gazette — Implementation Reference

**When to read:** Working on the Gazette tab, community feed, explorer profiles, badge awarding, or cross-tab species navigation.

---

## Overview

The Gazette is the community layer of QRious Specimens. It shows a live activity timeline of public discoveries and badge awards, a showcase grid of public explorer profiles, and headline community statistics. Users opt in by creating a Gazette profile with a display name; discoveries only appear in the feed if the profile is set to public.

---

## Database schema

### Tables

| Table | Purpose |
|---|---|
| `explorer_profiles` | One row per user who has created a Gazette profile. `is_public` controls feed visibility. |
| `badge_definitions` | Static reference table: 10 badge types seeded at migration time. |
| `explorer_badges` | Earned badges per user (UNIQUE on `user_id + badge_slug`). Per-badge `is_public` toggle. |
| `activity_feed` | Append-only log of public discovery and badge events. Includes `qr_hash` for thumbnail lookup. |

### RLS model

- `explorer_profiles`: public reads for `is_public = true`; authenticated users read their own regardless of visibility
- `explorer_badges`: public badges of public profiles are visible to all; users read all their own badges
- `activity_feed`: entries are readable when the `user_id` has a public profile; users read and delete their own regardless of profile visibility

---

## RPCs

All RPCs are `SECURITY DEFINER` with `SET search_path = public`. GRANTs:
- `get_community_feed`, `get_explorer_showcase`, `get_community_stats` — `anon, authenticated`
- `check_and_award_badges` — `authenticated` only

### `get_community_feed(p_limit integer DEFAULT 20)`

Returns the `p_limit` most recent activity entries from public profiles, joined to display names, badge definitions, badge tier (for ring-tinting on `BadgeDispatch`), species thumbnails (`species_images.image_url_256`), field notes (for the render-time excerpt fallback), and pull-quote.

Returns: `id, event_type, species_name, badge_slug, badge_name, badge_icon, badge_tier, rarity, display_name, created_at, qr_hash, species_image_url, field_notes, pull_quote, tier_change_body`

Migration: `20260510000001_get_community_feed_field_notes_pull_quote.sql` recreated the function (DROP + CREATE because the RETURNS TABLE shape changed). The Field Dispatches redesign of the Gazette feed reads `pull_quote` first and falls back to `excerptFromFieldNotes(field_notes)` (`src/lib/feedDate.ts`) when null. See ADR [`2026-05-10-pull-quote-generation.md`](./decisions/2026-05-10-pull-quote-generation.md). Migration `20260511000003_get_community_feed_tier_change_body.sql` then extended the payload with `tier_change_body` so `TierChangeDispatch` renders the worker-generated prose directly; the new-tier label is read from the existing `rarity` column.

### `get_explorer_showcase()`

Returns all public explorer profiles ranked by `specimen_count DESC`. Per-explorer stats are computed via a lateral join against `creatures` + `species_discoveries`. Badge JSONB is aggregated inline.

Returns: `user_id, display_name, specimen_count, extraordinary_count, first_discovery_count, badges (jsonb), joined_at`

The `extraordinary_count` column was renamed from `rare_count` in migration `20260511000002_rarity_vocabulary_rename.sql` (rarity-and-census vocabulary rename). The threshold (`discovery_count <= 3`) is unchanged.

### `get_community_stats()`

Returns three headline numbers. Excludes test accounts (`%@test.com`, `%@qrfossils.com`) via a join to `auth.users`.

Returns: `total_explorers, total_specimens, total_species`

Note: `total_species` counts `species_images WHERE image_url IS NOT NULL` — a species with a failed AI illustration is not counted. See TD-012.

### `check_and_award_badges(p_user_id uuid)`

Computes specimen count, extraordinary count, first-discovery count, and distinct active days for the given user. Awards all newly earned badges via `INSERT ... ON CONFLICT DO NOTHING`. Returns all the user's badges with an `r_is_new` flag indicating which were just awarded.

Uses `FOREACH` loop with `r_`-prefixed return columns to avoid column-name ambiguity.

Called silently after each excavation. Badge toast notifications (with tier label) fire in Phase 7. On success, invalidates both `['community-showcase']` and `['explorer-badges', userId]` query keys.

### `calculate_explorer_rank(p_user_id uuid)`

Computes a cumulative score for the user and maps it to a rank tier. Migration: `20260425000004_fix_calculate_explorer_rank_page_events_column.sql`.

Returns a single JSON object: `{ rank, rank_icon, score, next_rank, next_threshold, progress, breakdown }`.

- `rank` — `'unranked' | 'bronze' | 'silver' | 'gold' | 'platinum'`
- `progress` — float 0–1 representing progress toward `next_threshold`
- `breakdown` — `{ badges, specimens, species, extraordinary, firsts, days_active }` (the `extraordinary` key was renamed from `rare` in migration `20260511000002_rarity_vocabulary_rename.sql`)

Rank thresholds: Bronze = 8, Silver = 35, Gold = 100, Platinum = 250.
Rank display names and icons live in `RANK_DISPLAY` in `src/hooks/useBadges.ts`.

Fetched via `useExplorerRank(userId)` in `useBadges.ts`. Invalidated after badge check completes (ensures rank reflects newly awarded badges).

---

## Hooks (`src/hooks/useCommunity.ts`)

| Hook | Purpose | Cache |
|---|---|---|
| `useExplorerProfile(userId)` | Fetch or null the current user's profile | 5 min stale |
| `useCreateProfile()` | Mutation: insert a new profile (caller must pass a name from `generateExplorerName()`) | Invalidates showcase + stats |
| `useUpdateProfile()` | Mutation: toggle profile visibility (`is_public`) only | Invalidates showcase + stats + feed |
| `useRegenerateDisplayName()` | Mutation: replace `display_name` with a fresh `generateExplorerName()` value (the only client-side path that writes the name) | Invalidates showcase + stats + feed |
| `useCommunityFeed(limit)` | Activity feed, polls every 30s | 30s stale |
| `useExplorerShowcase()` | Public profiles ranked by count, polls 60s | 60s stale |
| `useCommunityStats()` | Headline stats | 5 min stale |
| `usePostActivity()` | Mutation: insert into `activity_feed` | Invalidates feed |
| `useCheckBadges()` | Mutation: call `check_and_award_badges` RPC | Invalidates showcase + `explorer-badges` |
| `useFirstDiscoverer(userId, enabled)` | Look up display name of a species' first discoverer | 10 min stale; only fetches when `enabled && !!userId` |

---

## Activity feed write timing

The frontend writes to `activity_feed` after a successful excavation, but only if the user has a public Gazette profile (`explorerProfile.data?.is_public`). This is a deliberate architecture choice: the Worker does not know the user's profile visibility, and adding that join to the discovery RPC would add latency to the scan flow.

**Insert contract:** `usePostActivity` callers must pass `user_id` — the column is `NOT NULL` with no default, and the `Insert own activity` RLS policy requires `user_id = auth.uid()`. Omitting it fails both checks and the row is rejected.

**Current event types posted:**
- `discovery` — any new species found
- `first_discovery` — when `isFirstDiscoverer` flag is true from the Worker response
- `badge_earned` — written by `check_and_award_badges` RPC, not by client code
- `tier_change` — written by `register_discovery` when a discovery crosses a rarity-tier threshold (count goes 3→4 or 15→16). The same RPC returns `tier_change_event_id`; the Worker then PATCHes `activity_feed.tier_change_body` with a one-shot Claude Haiku Society notice (binomial + new tier in the Society's idiom). Soft-fail: if Claude errors, `tier_change_body` stays `NULL` and `TierChangeDispatch` renders a hand-written fallback. See [`rarity-and-census.md`](../SPECIFICATIONS/rarity-and-census.md) and ADR [`2026-05-12-tier-change-events.md`](./decisions/2026-05-12-tier-change-events.md).

The `rare_discovery` event type is not used. Migration `20260510000002_drop_rare_discovery_event_type.sql` rewrote any historical rows to `discovery` and redefined the CHECK constraint without it. Rarity treatment lives in the catalogue and as live-derived tier_change events in the Gazette — the cabinet itself shows tier live from `discovery_count` and never snapshots it.

---

## Explorer name generator (`src/lib/explorerNames.ts`)

Produces Victorian-style expedition-manifest names: `"Dr. E. Blackwood"`, `"Captain R. Huxley"`, etc.

- `generateExplorerName(seed?)` — deterministic when given a seed (testable), random when not
- `randomExplorerName()` — convenience wrapper for the sparkle button

Generated names are the only allowed shape — the `GazetteJoinPrompt` and `SettingsPage` UIs render them read-only beside a regenerate action, and the `useCreateProfile` / `useRegenerateDisplayName` hooks are the only client-side writers. This enforces the privacy-policy promise that explorers appear under auto-generated names, never their real ones (see TD-028).

Easter egg: ~1-in-2000 chance of generating `"A. Anning"` — a nod to Mary Anning.

---

## Field Dispatches — `ActivityTimeline` component breakdown

`src/components/ActivityTimeline/` composes the Gazette feed as a Victorian field journal. One component per dispatch type, plus shared header / divider primitives:

| Component | Role |
|---|---|
| `ActivityTimeline` | Top-level. Groups entries by UTC day via `groupByDay()`, picks one featured dispatch per day, derives each featured card's mirrored side from a stable per-entry-id parity (`charCodeAt(last) % 2`) so 30s polling-driven inserts at the top do not flip already-rendered cards, renders `<section aria-label="Activity timeline">`. |
| `DatelineHeader` | Italic `<h3>` with hairline rules. Wraps `dateline(date, now)` from `feedDate.ts` — emits "Today, on the 10th of May", "Yesterday, on the 9th", or "On the 1st of May" depending on UTC-day comparison. |
| `FeaturedDispatch` | Per-day "Dispatch of the Day" — eyebrow, species `<h2>`, italic pull-quote, signature with time-of-day phrase. Mirrored layout via `sm:flex-row-reverse` when `mirrored=true`. |
| `CompactDispatch` | Thumb + italic species name + quote excerpt + signature. Amber "First sighting" eyebrow when `event_type === 'first_discovery'`. Full card is a button when `qr_hash` and `onViewSpecies` are provided. |
| `BadgeDispatch` | Emoji icon in a tier-tinted ring (bronze/silver/gold), smallcaps prose. Never clickable — badges have no species detail page. |
| `TierChangeDispatch` | "Society notice · {Tier}" eyebrow with italic Society copy ending in a fleuron. Renders `tier_change_body` from the row when present; otherwise a hand-written template by direction. Binomial is rendered as a styled inline link to the species detail page. Never promoted to the featured slot. |
| `Fleuron` | Decorative divider between dispatches within a day. Hairline rules either side of a glyph (default `✽`). |

**Featured-pick rule** (`pickFeaturedId` inside `ActivityTimeline.tsx`):
1. Most-recent `first_discovery` in the day → featured
2. Otherwise most-recent ordinary `discovery` → featured
3. Days with only `badge_earned` and/or `tier_change` entries get no featured card; those events always render inline (BadgeDispatch / TierChangeDispatch)

**Render-time pull-quote fallback** (`excerptFromFieldNotes()` in `src/lib/feedDate.ts`): collapses whitespace, prefers the first sentence (`/^[^.!?]*[.!?]/`), word-boundary truncation at 200 chars otherwise. Used by both `FeaturedDispatch` and `CompactDispatch` when `pull_quote IS NULL`.

**Click contract preserved:** `onViewSpecies(qrHash)` callback flows through `ActivityTimeline` → dispatch → button. Badge dispatches don't carry the prop. `GazettePage` handles the click by setting `state.origin = 'gazette'` so the back button on `SpeciesDetail` returns to the right tab.

**Date helpers** (`src/lib/feedDate.ts`):
- `dateline(date, now)` — UTC-based "Today, on the Nth of Month" / "Yesterday, on the Nth" / "On the Nth of Month"
- `groupByDay(entries)` — UTC-day buckets, preserves entry order within each
- `excerptFromFieldNotes(notes)` — render-time pull-quote fallback
- `timeOfDay(date)` — "at first light" / "before noon" / "in the afternoon" / "as evening drew on" / "after dark"

All UTC, locale-free, deterministic.

**`/gazette-mock` route** (`src/pages/GazetteFeedMockPage.tsx`, registered in `src/App.tsx`): a static, fixture-driven preview of every dispatch shape against synthetic data. It does not call the RPC and is not linked from the navigation. Kept in production builds intentionally — a one-URL way to compare the live feed against the calibration baseline when iterating on dispatch components, mirroring layouts, or fleuron spacing. Do not delete as dead code.

---

## Pull-quote generation and backfill

The `pull_quote` column on `species_images` is populated by a sequential text-only Claude Haiku call after the multimodal field-notes call (Step 6b in `workers/generate-creature/index.ts`). Failure is soft — discovery completes, `pull_quote = null` is persisted, and the render-time excerpt covers the gap.

- Prompt builder: `buildPullQuotePrompt(fieldNotes, dna.seed)` — 6-way directive rotation seeded by `dna.seed`
- API client: `generatePullQuote(prompt, apiKey)` in `workers/generate-creature/claude.ts`
- Variety regression test: `workers/generate-creature/pullQuote.test.ts` — guards opener-shape distribution against `scripts/output/trial-pull-quotes.json`
- Trial harness: `scripts/trial-pull-quotes.ts` — regenerate the calibration corpus when iterating prompts
- Backfill: `scripts/backfill-pull-quotes.ts` — idempotent, fills rows with `pull_quote IS NULL AND field_notes IS NOT NULL`. Resolves `dna.seed` per row from `creatures` so the directive rotation produces statistically similar variety to live traffic.

ADR: [`2026-05-10-pull-quote-generation.md`](./decisions/2026-05-10-pull-quote-generation.md).

---

## Cross-tab navigation (Gazette → Catalogue)

When a user clicks a discovery entry in the `ActivityTimeline`, the app:

1. Sets `selectedCatalogueHash` state in `AppShell` to the entry's `qr_hash`
2. Switches `activeTab` to `'catalogue'`
3. `CataloguePage` receives `selectedSpeciesHash` prop and a `useEffect` searches `allEntries` for a matching entry
4. If found, opens `SpeciesDetail` and calls `onSpeciesViewed()` to clear `selectedCatalogueHash`

URL routing makes the auto-open robust — the catalogue page resolves the requested `qr_hash` via the route param rather than depending on whichever pages are currently loaded.

---

## First discoverer credit in SpeciesDetail

`SpeciesDetail` accepts an optional `firstDiscovererName` prop. It is only rendered when:
- `isAuthenticated === true` (never shown to visitors)
- `firstDiscovererName` is non-null (only when the first discoverer has a public Gazette profile)

The lookup is done via `useFirstDiscoverer(entry.first_discoverer_id, isAuthenticated && !!selectedEntry)` in `CataloguePage`, which fires a DB query filtered to `is_public = true`. Private profiles produce no row, so their credit is suppressed at the DB layer, not the UI layer.

---

## Gamification hooks (`src/hooks/useBadges.ts`)

Added in Phase 7. Separate from `useCommunity.ts` to keep badge/rank logic cohesive.

| Hook | Purpose | Cache |
|---|---|---|
| `useBadgeDefinitions()` | All badge definitions from `badge_definitions` table | 10 min stale |
| `useExplorerBadges(userId)` | Earned badges for a user from `explorer_badges` table | 5 min stale; disabled when `userId` is null |
| `useExplorerRank(userId)` | Explorer rank via `calculate_explorer_rank` RPC | 5 min stale; disabled when `userId` is null |

`RANK_DISPLAY` constants (label, name, icon per tier) are exported from `useBadges.ts` — canonical source used by `ExplorerRankCard`, `CabinetPage`, and `App.tsx` rank-up toasts.

---

## Known technical debt

Track deferred items as GitHub Issues with the `technical-debt` label.
