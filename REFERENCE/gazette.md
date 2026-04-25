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
- `activity_feed`: entries are readable when the `user_id` has a public profile; users read their own regardless

---

## RPCs

All RPCs are `SECURITY DEFINER` with `SET search_path = public`. GRANTs:
- `get_community_feed`, `get_explorer_showcase`, `get_community_stats` — `anon, authenticated`
- `check_and_award_badges` — `authenticated` only

### `get_community_feed(p_limit integer DEFAULT 20)`

Returns the `p_limit` most recent activity entries from public profiles, joined to display names, badge definitions, and species thumbnails (`species_images.image_url_256`).

Returns: `id, event_type, species_name, badge_slug, badge_name, badge_icon, rarity, display_name, created_at, qr_hash, species_image_url`

### `get_explorer_showcase()`

Returns all public explorer profiles ranked by `specimen_count DESC`. Per-explorer stats are computed via a lateral join against `creatures` + `species_discoveries`. Badge JSONB is aggregated inline.

Returns: `user_id, display_name, specimen_count, rare_count, first_discovery_count, badges (jsonb), joined_at`

### `get_community_stats()`

Returns three headline numbers. Excludes test accounts (`%@test.com`, `%@qrfossils.com`) via a join to `auth.users`.

Returns: `total_explorers, total_specimens, total_species`

Note: `total_species` counts `species_images WHERE image_url IS NOT NULL` — a species with a failed AI illustration is not counted. See TD-012.

### `check_and_award_badges(p_user_id uuid)`

Computes specimen count, rare count, first-discovery count, and distinct active days for the given user. Awards all newly earned badges via `INSERT ... ON CONFLICT DO NOTHING`. Returns all the user's badges with an `r_is_new` flag indicating which were just awarded.

Uses `FOREACH` loop with `r_`-prefixed return columns to avoid column-name ambiguity.

Called silently after each excavation. Badge toast notifications (with tier label) fire in Phase 7. On success, invalidates both `['community-showcase']` and `['explorer-badges', userId]` query keys.

### `calculate_explorer_rank(p_user_id uuid)`

Computes a cumulative score for the user and maps it to a rank tier. Migration: `20260425000004_fix_calculate_explorer_rank_page_events_column.sql`.

Returns a single JSON object: `{ rank, rank_icon, score, next_rank, next_threshold, progress, breakdown }`.

- `rank` — `'unranked' | 'bronze' | 'silver' | 'gold' | 'platinum'`
- `progress` — float 0–1 representing progress toward `next_threshold`
- `breakdown` — `{ badges, specimens, species, rare, firsts, days_active }`

Rank thresholds: Bronze = 8, Silver = 35, Gold = 100, Platinum = 250.
Rank display names and icons live in `RANK_DISPLAY` in `src/hooks/useBadges.ts`.

Fetched via `useExplorerRank(userId)` in `useBadges.ts`. Invalidated after badge check completes (ensures rank reflects newly awarded badges).

---

## Hooks (`src/hooks/useCommunity.ts`)

| Hook | Purpose | Cache |
|---|---|---|
| `useExplorerProfile(userId)` | Fetch or null the current user's profile | 5 min stale |
| `useCreateProfile()` | Mutation: insert a new profile | Invalidates showcase + stats |
| `useUpdateProfile()` | Mutation: update display name or `is_public` | Invalidates showcase + stats + feed |
| `useCommunityFeed(limit)` | Activity feed, polls every 30s | 30s stale |
| `useExplorerShowcase()` | Public profiles ranked by count, polls 60s | 60s stale |
| `useCommunityStats()` | Headline stats | 5 min stale |
| `usePostActivity()` | Mutation: insert into `activity_feed` | Invalidates feed |
| `useCheckBadges()` | Mutation: call `check_and_award_badges` RPC | Invalidates showcase + `explorer-badges` |
| `useFirstDiscoverer(userId, enabled)` | Look up display name of a species' first discoverer | 10 min stale; only fetches when `enabled && !!userId` |

---

## Activity feed write timing

The frontend writes to `activity_feed` after a successful excavation, but only if the user has a public Gazette profile (`explorerProfile.data?.is_public`). This is a deliberate architecture choice: the Worker does not know the user's profile visibility, and adding that join to the discovery RPC would add latency to the scan flow.

**Current event types posted:**
- `discovery` — any new species found
- `first_discovery` — when `isFirstDiscoverer` flag is true from the Worker response

**`rare_discovery` is defined but not yet posted** — see TD-012. The rarity check requires a post-insert DB read of `species_discoveries.discovery_count`. Deferred to Phase 7.

---

## Explorer name generator (`src/lib/explorerNames.ts`)

Produces Victorian-style expedition-manifest names: `"Dr. E. Blackwood"`, `"Captain R. Huxley"`, etc.

- `generateExplorerName(seed?)` — deterministic when given a seed (testable), random when not
- `randomExplorerName()` — convenience wrapper for the sparkle button

Easter egg: ~1-in-2000 chance of generating `"A. Anning"` — a nod to Mary Anning.

---

## Cross-tab navigation (Gazette → Catalogue)

When a user clicks a discovery entry in the `ActivityTimeline`, the app:

1. Sets `selectedCatalogueHash` state in `AppShell` to the entry's `qr_hash`
2. Switches `activeTab` to `'catalogue'`
3. `CataloguePage` receives `selectedSpeciesHash` prop and a `useEffect` searches `allEntries` for a matching entry
4. If found, opens `SpeciesDetail` and calls `onSpeciesViewed()` to clear `selectedCatalogueHash`

**Known limitation (TD-013):** if the species is on an unloaded catalogue page, the auto-open silently fails. A fallback single-species RPC lookup is the planned fix.

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

- **TD-012** — `rare_discovery` event type defined but never posted
- **TD-013** — Cross-tab auto-open fails for species beyond loaded catalogue pages
- **TD-014** — `activity_feed` has no DELETE RLS policy (GDPR gap for Phase 8)
