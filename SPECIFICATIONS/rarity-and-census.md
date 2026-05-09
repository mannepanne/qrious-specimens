# Rarity scoring and weekly Census Notice

**Status:** Spec
**Type:** Feature (post-launch)
**Working branch:** `feature/rarity-and-census` (real implementation)
**Mock route (dev only):** `/gazette-mock` — see `src/pages/GazetteFeedMockPage.tsx`
**Sibling spec:** [`gazette-feed-redesign.md`](./gazette-feed-redesign.md) — must ship first

---

## Overview

The `badges` table already includes `rare_find` and `connoisseur` — both implying that some specimens are rarer than others. To date, no rarity signal has ever fired (TD-012: `rare_discovery` event was defined and never posted). This spec defines what *rare* means in the context of a procedurally-generated catalogue, and establishes a weekly cadence — the **Census Notice** — that surfaces shifts in the rarity landscape as a Gazette post.

Three principles drive the design:

1. **Rarity is statistical, not editorial.** Discovery-count rarity is gameable (a single user with a private QR generator can manufacture "rare" species). Trait-distribution rarity is invariant under that attack — you can't farm uniqueness by hiding scans, because the trait population still says what it says. We score on traits.
2. **Never reveal mechanics.** Users see one composite label per dispatch — "Top 4%", "Provisional" — and the weekly Census narrates *outcomes*, never inputs. No trait breakdowns, no algorithmic language. The Society reviews specimens and revises its tiers; the working is private.
3. **Field-note prose is timeless.** Field notes and pull-quotes never reference a specimen's current or past rarity tier. They describe the creature, not the catalogue's opinion of it. This means a specimen's prose stays accurate as the catalogue grows around it — no need to regenerate when "rare" becomes "common."

This spec also **supersedes the existing discovery-count rarity system** in `src/lib/rarity.ts` (`'rare' | 'uncommon' | 'common'` tiers derived from `discovery_count`). That system surfaces in the cabinet, the catalogue filter, species detail, and the explorer rank breakdown. All of those are touched here — see §Existing rarity surfaces.

---

## Goals

- Make rarity emerge from the engine — uncheatable, defensible, honest
- Give every species a single, stable rarity label that fits the Victorian-naturalist tone
- Snapshot rarity at the moment of discovery so explorers keep their finds even as the catalogue grows
- Use the weekly recalculation as a content event — a printed Census Notice in the Gazette that links to the species it discusses
- Replace the existing discovery-count rarity tiers with the new percentile system across every surface that currently uses them
- Resolve TD-012 cleanly: no resurrection of `rare_discovery`; the `census` event type takes its place

## Non-goals

- Per-trait or per-axis rarity surfacing in the UI ("unusual eye colour, common body shape" — kept server-side)
- A rarity leaderboard or filter on the Catalogue page
- Hand-curated rarity overrides
- Per-explorer "rarity portfolio" stats — could come later, not now
- Real-time rarity recalculation on every discovery (we batch weekly — see §Cadence)
- Localisation of Census Notice copy

---

## Reference: visual mock

The standalone mock at `/gazette-mock` previews two surfaces this spec ships:

1. **Rarity stamps** on compact dispatches — small monospace label inline with the explorer/time-of-day metadata. Examples in the mock: *Larva nocturnalis* "Top 4%", *Concha occidentalis* "Top 24%", *Folium susurrans* "Provisional".
2. **Census Notice** — a no-image, framed card with serif italic prose, fleuron rules top and bottom, with mentioned binomials rendered as subtle inline links to the species page (with `state: { origin: 'gazette' }` for back-link routing).

The mock uses placeholder qr_hashes; production resolves real species. The visual treatment is the contract.

---

## The rarity model

### What we score

Each species in `species` has a vector of categorical trait values produced by the DNA engine — body axis, limb count, surface texture, colour palette family, eye type, taxonomy tier, habitat, and so on. Continuous traits (size, hue values) are bucketed into a fixed number of bins (5–8) at distribution-build time so they participate as categorical values.

The catalogue's trait distribution is derived from the **set of species that have at least one discovery event** (i.e., species users have actually encountered). Species that exist in the table but have never been scanned by anyone don't influence the distribution. This keeps rarity grounded in the *observed* catalogue, not the potential one.

### How the score is computed

For each species *s* with trait vector *(t₁, t₂, …, tₙ)*:

```
score(s) = Σᵢ −log₂(P(tᵢ.value | observed catalogue))
```

This is the Shannon information content (or *surprisal*) of the species against the population. Higher score = more unusual combination. The score is then converted to a **percentile rank** across all observed species — that's the user-facing number.

Why surprisal rather than raw probability product:

- Logs sum cleanly; products underflow with many traits
- Adding new trait axes scales linearly without rescaling existing scores
- Independent of the absolute number of trait values per axis (no need for per-trait normalisation tuning)

The exact formula is implementation detail and **must not be exposed in any UI**. Reviewers must reject any screen that shows trait-level breakdowns.

### Score → label

The percentile rank is mapped to a label only when meaningfully rare; otherwise no label is displayed. Default thresholds (configurable):

- `percentile <= 5` → `"Top 5%"` (extraordinary)
- `percentile <= 25` → `"Top {percentile}%"` (rounded to nearest whole percent)
- `percentile > 25` → no rarity stamp shown

This keeps the feed mostly clean, with rarity surfacing only when it's a real flag. The mock's "Top 24%" entries are at the visible edge — not flashy, but informative. "Top 4%" entries stand out.

### Low-N suppression

Below a threshold of **100 observed species**, all rarity stamps are suppressed and replaced with the literal string `"Provisional"`. Reasoning: at low N, percentiles are mostly noise — "top 5% of 12 species" means literally one creature, and the user feels the maths. The threshold is server-side configuration; tune as the catalogue grows.

The Census Notice does not run while the catalogue is provisional — see §Cadence.

### Snapshot strategy

Two layers of state, with different semantics:

- `species.rarity_score` and `species.rarity_label` (text) — **current** values, refreshed weekly. This is what appears next to a species on the Catalogue page and on new compact-dispatch rows posted *after* the next census.
- `discoveries.rarity_at_discovery` (text) — **frozen** at the moment of discovery, copied from `species.rarity_label` at insert time. Never recomputed. This is what appears next to *that explorer's* dispatch in their cabinet history and in the Gazette compact-dispatch line.

Result: a species can be "Top 4%" when first discovered, then drift to "Top 24%" over time as more similar specimens are catalogued. The discoverer's dispatch keeps the original "Top 4% at discovery" stamp (label suffix added at render time when the two values differ); the species page shows the current "Top 24%". The two numbers tell a story.

`rarity_snapshots(species_id, week_of, percentile, label)` — append-only history table, retained for the most recent ~12 weeks. Used by the Census Notice cron to compute diffs (this week's percentile vs. last week's). Cheap — bytes per row, kilobytes per week.

---

## Existing rarity surfaces — audit and reconcile

The current count-based system in `src/lib/rarity.ts` exposes a `Rarity` type (`'rare' | 'uncommon' | 'common'`) used across the app. The new system replaces it. Per-surface decisions:

### Tier mapping

We need both **per-specimen labels** ("Top 4%") and **bucketed labels** for filters and aggregations (you can't filter a catalogue by "Top 4%" — that's a single specimen). The percentile maps onto three tiers:

| Tier label | Percentile range | Used in |
|---|---|---|
| `Extraordinary` | top 5% | Catalogue filter, cabinet stats bar, explorer rank breakdown |
| `Notable` | top 6–25% | Same |
| `Common` | top 26%+ | Same — and as the "everything else" bucket |

When the catalogue is provisional (<100 observed species), all tier labels are suppressed, replaced with `"Provisional"`. The catalogue rarity filter is hidden in that state.

The vocabulary shift — `rare/uncommon/common` → `Extraordinary/Notable/Common` — is deliberate: the old words don't fit the Victorian tone (they read like a free-to-play loot tier list), and "Extraordinary" / "Notable" are how a 19th-century Society would actually have annotated a specimen drawer.

`src/lib/rarity.ts` keeps its name and stays the single source of truth for label rendering, but its internals change:

- `Rarity` type rebadged: `'extraordinary' | 'notable' | 'common'`
- `getRarityFromCount()` deleted
- New: `getRarityTierFromPercentile(p: number | null): Rarity | 'provisional'`
- New: `formatPercentileLabel(p: number | null): string` → `"Top 4%"`, `"Provisional"`, or `null`
- `getRarityLabel()` updated to return the new tier names in display caps
- `getRarityColor()` updated for the three-tier scheme

### Per-surface changes

| Surface | Today | After this spec |
|---|---|---|
| `SpeciesDetail` Discovery Record panel | `RARITY: RARE` (count-derived), `DISCOVERERS: N explorers` | `CATALOGUED RARITY: TOP 24% (NOTABLE)`. If `discoveries.rarity_at_discovery` exists for the viewer's own discovery and differs from current, append `"— Top 4% when you found it"` as a small italic line. `DISCOVERERS` row stays unchanged (still useful, doesn't pretend to be rarity) |
| `SpeciesCard` (Catalogue grid) | Coloured tier label below name | Coloured tier label below name, sourced from `species.rarity_label` |
| `SpecimenTeaser` (preview cards) | Same | Same |
| `CabinetPage` rarity stats bar | `COMMON 12 · UNCOMMON 5 · RARE 3` from `getRarityFromCount(discoveryCount)` | `COMMON 12 · NOTABLE 5 · EXTRAORDINARY 3`, derived from each specimen's `rarity_at_discovery` (frozen) — preserves "you found these when they were rare" |
| `CataloguePage` rarity filter | `rare / uncommon / common` dropdown | `extraordinary / notable / common` filter (label rename), filtering on `species.rarity_label` (current) |
| `ExplorerRankCard` rank breakdown | `RARE FINDS: N` | `EXTRAORDINARY FINDS: N`, counting `discoveries.rarity_at_discovery === 'extraordinary'` |
| `ActivityTimeline` (legacy compact line) | `"discovered a rare X"` | Replaced by Field Dispatches redesign — no copy change needed here, the new dispatches use the rarity stamp |

### "Was rare at find, but now common" — UX treatment

Three places where the divergence between at-discovery and current rarity surfaces:

- **Cabinet card / SpecimenTeaser** — explorer's own view: shows the at-discovery label only. The cabinet is a record of what *they* found, frozen at the moment of finding. They keep their EXTRAORDINARY stamp regardless of where the species drifts.
- **Species page (Discovery Record)** — public view: shows the *current* catalogued rarity as the primary number. If the current viewer is logged in *and* discovered this species, an additional small line below reads `"Top 4% when you found it"`. If they didn't discover it, no historical line — the comparison isn't theirs to see.
- **Gazette compact dispatch** — public view of one explorer's discovery moment: shows the at-discovery label with a `"at discovery"` suffix when it differs from current. This is how the divergence gets *narrated* — "Top 4% at discovery" tells the reader the species *was* rare when found, even if it isn't now.

The Census Notice carries the divergence at the catalogue level — it's the thing that announces "*Manticora rubicunda* … recedes to the company of the merely uncommon." It does the storytelling that individual rows can't.

### Field notes and pull-quotes — explicit principle

Field notes and pull-quotes are written about the specimen, not the catalogue's view of it. They never use the words *rare, common, uncommon, scarce, plentiful, abundant, extraordinary, notable* in the rarity sense, nor reference the discovery count, nor the species' position relative to others. The Claude prompts (existing field-note prompt and the new pull-quote prompt from the gazette redesign spec) include this constraint explicitly. Worker tests assert that the prompts contain the relevant negative instructions.

This means existing field notes and pull-quotes do not need regeneration when rarity shifts — they were timeless to begin with, and the updated prompts keep them so.

---

## Weekly Census Notice

### Cadence

A Cloudflare Cron Trigger fires every **Sunday at 21:00 UTC**. It:

1. **Recomputes** `species.rarity_score` and `species.rarity_label` for every observed species, from the current trait distribution
2. **Inserts** a row into `rarity_snapshots` for each species (week_of = current Sunday)
3. **Diffs** the new snapshots against last week's: identifies top 3 risers (got rarer), top 3 fallers (got commoner), new entries to the top tier, and any species crossing the 5% / 25% thresholds either direction
4. **Calls Claude** with the diff + counts to produce a Census Notice body in Victorian voice
5. **Inserts** an `activity_feed` row with `event_type = 'census'` and a payload containing `{ body, period_label, links }`

If the catalogue is still under the low-N threshold (<100 observed species), the cron skips steps 4–5 entirely. No Census Notice while rarity is provisional. It still runs steps 1–3 so we have history once the threshold is crossed.

### Linking species mentioned in the body

Census-to-species links are essential — a reader should be able to tap *Manticora rubicunda* and land on its species page. Approach:

1. The cron pre-resolves the qr_hashes of every species it intends to mention in the diff
2. The Claude prompt includes that list, with explicit instructions: *"wrap each binomial in `*asterisks*`. Mention each exactly once."*
3. The activity_feed `payload` stores both `body` (with asterisks) and `links: Record<binomial, qr_hash>` — the mapping resolved at generation time
4. At render time, the Gazette renderer parses the body, splits on asterisks, and consults `links`. Matched binomials become `<Link to="/species/{qr_hash}" state={{ origin: 'gazette' }}>`. Unmatched binomials (Claude hallucinated, or a species was deleted afterwards) render as plain italic — graceful degradation, never a broken link

Storing the mapping inline (rather than re-querying at render time) means historical Census Notices stay self-contained — a renamed species still links to what the post meant when it was published.

### Claude prompt — Census voice

The prompt establishes:

- Voice: Victorian Royal Society of naturalists, dry, slightly wry, observational
- Forbidden vocabulary: *algorithm, percentile, score, rank, distribution, computed* — anything mechanical
- Required: each pre-supplied binomial mentioned exactly once, wrapped in asterisks
- Length: 3–5 sentences, single paragraph
- Framing: outcomes ("once held to be among our great rarities, has now been observed by twenty-three correspondents and recedes to the company of the merely uncommon") not inputs ("colour-axis distribution shifted")

Iterate the prompt across 3–5 sample diffs before merging. Save representative diffs as fixtures for worker tests.

### Cost

- One Claude Haiku 4.5 call per week, ~250 input tokens + ~150 output ≈ $0.001/week
- One bulk SQL `UPDATE` over the species table (microseconds at any realistic scale)
- One row appended to `activity_feed`
- N rows appended to `rarity_snapshots` (N = species count)

Effectively free.

---

## Scope

### In scope

#### Backend

- [ ] New table `rarity_snapshots(species_id uuid, week_of date, percentile integer, label text, primary key (species_id, week_of))`
- [ ] Add `rarity_score numeric`, `rarity_label text` to `species`
- [ ] Add `rarity_at_discovery text` to `discoveries`; populate at insert time from the current `species.rarity_label`
- [ ] New table or scheduled view for the trait distribution build — or computed transactionally inside the recalc function
- [ ] PL/pgSQL function `recompute_rarity()` — recomputes `species.rarity_score` / `species.rarity_label` and writes a `rarity_snapshots` row for each species in a single transaction
- [ ] New Cloudflare Worker route `workers/census/` — invoked by Cron Trigger, calls `recompute_rarity()`, computes diff, calls Claude, inserts `activity_feed` row
- [ ] Add `census` to the `activity_feed.event_type` CHECK constraint (replacing `rare_discovery`, removed by the gazette redesign spec)
- [ ] Update `get_community_feed` RPC to surface `payload` for `census` rows (currently it ignores most non-discovery payloads — verify)
- [ ] `useCommunity.ts` `FeedEntry` type extended with optional `census_body`, `census_period`, `census_links` fields

#### Frontend

- [ ] `src/lib/rarity.ts` — replace `getRarityFromCount()` with `getRarityTierFromPercentile()` and `formatPercentileLabel()`; rebadge tier names to `extraordinary | notable | common`; update `getRarityColor()` accordingly
- [ ] `RarityStamp.tsx` — small monospace label, used inline in `CompactDispatch` and `FeaturedDispatch` from the gazette redesign
- [ ] `CensusDispatch.tsx` — framed card with fleuron rules, body rendered via `renderCensusBody()` helper
- [ ] `renderCensusBody(text, links)` helper in `src/lib/censusBody.tsx` — splits on asterisks, renders matched binomials as `<Link>` to species, unmatched as plain italic
- [ ] At-discovery rarity rendering: when `rarity_at_discovery !== species.rarity_label`, the dispatch label reads `"Top 4% at discovery"`; otherwise just `"Top 4%"`. Decision happens at render time using both fields surfaced by the RPC
- [ ] Update `SpeciesDetail.tsx` — Discovery Record panel reads from `species.rarity_label` (current); appends explorer's at-discovery line when applicable
- [ ] Update `SpeciesCard.tsx` and `SpecimenTeaser.tsx` — read tier from `species.rarity_label` instead of computing from count
- [ ] Update `CabinetPage.tsx` rarity stats bar — derive from each specimen's `rarity_at_discovery`, use new tier vocabulary
- [ ] Update `CataloguePage.tsx` rarity filter — rename options, filter on `species.rarity_label` (current); hide filter entirely while `Provisional`
- [ ] Update `ExplorerRankCard.tsx` rank breakdown — count `discoveries.rarity_at_discovery === 'extraordinary'`
- [ ] Update `ActivityTimeline.tsx` legacy compact line copy if it survives the redesign (likely it doesn't — the redesign replaces it)
- [ ] Verify `useCommunity.ts` `FeedEntry.rarity` is wired to the new `species.rarity_label` source; deprecate or repurpose `rare_count` in `CommunityStats` if its definition shifts

#### Migrations

- [ ] `supabase/migrations/<ts>_rarity_columns.sql` — `species.rarity_score`, `species.rarity_label`, `discoveries.rarity_at_discovery`
- [ ] `supabase/migrations/<ts>_rarity_snapshots.sql` — table + indexes
- [ ] `supabase/migrations/<ts>_recompute_rarity.sql` — PL/pgSQL function
- [ ] `supabase/migrations/<ts>_event_type_census.sql` — drop `rare_discovery` (already done by gazette redesign), add `census` to CHECK constraint
- [ ] Backfill: run `recompute_rarity()` once on existing species before merging
- [ ] Backfill: populate `discoveries.rarity_at_discovery` for all existing rows by joining to `species.rarity_label` after the recompute (one-shot SQL `UPDATE`). This freezes everyone's existing finds at the *new* system's labels — old count-based tiers are not preserved
- [ ] Manual content audit: grep `species_images.field_notes` for rarity-vocabulary leakage (rare, scarce, common, abundant); regenerate the affected rows or leave alone if absent

#### Cloudflare configuration

- [ ] `wrangler.toml` — `[triggers] crons = ["0 21 * * SUN"]` on the new census worker
- [ ] Rate-limiting binding shared with existing Worker pattern (see `workers/shared/rateLimit.ts`)
- [ ] `ANTHROPIC_API_KEY` secret already provisioned via existing Worker — reuse

#### Documentation

- [ ] `REFERENCE/rarity.md` — public-facing how-rarity-works for *us*, not for users (the underlying maths, snapshot strategy, low-N rules, Cron schedule)
- [ ] `REFERENCE/decisions/<date>-rarity-via-trait-surprisal.md` — ADR documenting why we chose statistical trait rarity over discovery-count, why we batch weekly, and why we superseded the existing count-based system
- [ ] `REFERENCE/decisions/<date>-census-as-activity-event.md` — ADR for storing the Census Notice as an `activity_feed` row vs. a dedicated table
- [ ] Update `REFERENCE/gazette.md` with the rarity stamp + Census Notice rendering paths
- [ ] Update `REFERENCE/catalogue.md` — rarity filter values changed
- [ ] Add a one-time release notice for existing users about the tier vocabulary change (Rare/Uncommon/Common → Extraordinary/Notable/Common). Tone: Victorian Society announcing it has reviewed and recalibrated its taxonomy

### Out of scope

- Daily or per-discovery rarity recalculation
- Per-trait rarity breakdowns in the UI
- Regenerating existing field notes or pull-quotes (they are timeless by principle — see Principle 3)
- A user-facing FAQ explaining rarity (deliberate — see Principle 2)
- Translated Census Notice copy
- Pre-shift "you have an extraordinary" notification when a species you've discovered moves down a tier (could be a future feature; not now)

---

## Database schema changes

```sql
-- supabase/migrations/<ts>_rarity_columns.sql
ALTER TABLE public.species
  ADD COLUMN IF NOT EXISTS rarity_score numeric,
  ADD COLUMN IF NOT EXISTS rarity_label text;

ALTER TABLE public.discoveries
  ADD COLUMN IF NOT EXISTS rarity_at_discovery text;

-- supabase/migrations/<ts>_rarity_snapshots.sql
CREATE TABLE public.rarity_snapshots (
  species_id uuid NOT NULL REFERENCES public.species(id) ON DELETE CASCADE,
  week_of date NOT NULL,
  percentile integer NOT NULL,
  label text NOT NULL,
  PRIMARY KEY (species_id, week_of)
);
CREATE INDEX rarity_snapshots_week_idx ON public.rarity_snapshots (week_of);

-- supabase/migrations/<ts>_event_type_census.sql
ALTER TABLE public.activity_feed DROP CONSTRAINT IF EXISTS activity_feed_event_type_check;
ALTER TABLE public.activity_feed ADD CONSTRAINT activity_feed_event_type_check
  CHECK (event_type IN ('discovery', 'first_discovery', 'badge_earned', 'census'));
```

The PL/pgSQL `recompute_rarity()` function lives in its own migration; expect ~50 lines covering: build per-trait frequency CTEs from observed species, compute surprisal per species, percentile-rank, label-map, write back. Kept entirely server-side so the maths never leaks into client code.

RLS: `rarity_snapshots` is publicly readable; writes are service-role only (cron Worker auths via service-role key).

---

## Display rules

| Surface | What's shown | Source |
|---|---|---|
| Compact dispatch (Gazette) | `rarity_at_discovery` if set, else hidden. Label suffix `" at discovery"` appended if `rarity_at_discovery !== species.rarity_label` | `discoveries.rarity_at_discovery`, `species.rarity_label` |
| Featured dispatch (Gazette) | Same as compact, displayed below the binomial | Same as compact |
| Cabinet specimen card | `rarity_at_discovery` only — explorer's frozen state | `discoveries.rarity_at_discovery` |
| Cabinet rarity stats bar | Tier counts derived from each specimen's `rarity_at_discovery` | `discoveries.rarity_at_discovery` |
| Species page (Discovery Record) | Current `species.rarity_label` as primary; `"Top X% when you found it"` appended if logged-in viewer's own discovery diverges | `species.rarity_label`, viewer's `discoveries.rarity_at_discovery` |
| Catalogue card / SpecimenTeaser | Current tier label (`Extraordinary` / `Notable` / `Common`) from `species.rarity_label` | `species.rarity_label` |
| Catalogue rarity filter | Filter buttons over current tier; hidden in Provisional state | `species.rarity_label` |
| Explorer rank breakdown | `EXTRAORDINARY FINDS: N` count of discoveries where `rarity_at_discovery === 'extraordinary'` | `discoveries.rarity_at_discovery` |
| Census Notice | The post itself — body, period, links | `activity_feed.payload` |

If `rarity_label` is `NULL` (suppression for non-rare species), no stamp is rendered. If it's `"Provisional"`, render that string verbatim, slightly muted.

---

## Testing strategy

### Unit tests

- `surprisal.test.ts` — score increases when a trait value gets rarer; sums correctly across axes; deterministic for a fixed distribution
- `formatPercentileLabel.test.ts` — `1 → "Top 1%"`, `5 → "Top 5%"`, `25 → "Top 25%"`, `26 → null`, `null` (suppression) → `null`, low-N path → `"Provisional"`
- `getRarityTierFromPercentile.test.ts` — `≤5 → 'extraordinary'`, `≤25 → 'notable'`, `>25 → 'common'`, low-N path → `'provisional'`
- `renderCensusBody.test.tsx` — splits on asterisks; matched binomials render as `<Link>` with correct path and state; unmatched binomials render as italic; preserves surrounding prose
- `RarityStamp.test.tsx` — renders label; appends `" at discovery"` suffix when prop indicates divergence; muted styling for `"Provisional"`
- `CensusDispatch.test.tsx` — renders body, period, fleuron rules; null body → component renders nothing
- `SpeciesDetail.test.tsx` — Discovery Record shows current rarity; appends `"Top X% when you found it"` when logged-in viewer's own discovery diverges; omits when no divergence or when viewer didn't discover this species
- `CabinetPage.test.tsx` — rarity stats bar counts derive from `rarity_at_discovery`, not current label
- `CataloguePage.test.tsx` — rarity filter hidden in Provisional state; otherwise filters using current `rarity_label`

### Worker tests

- `census/recomputeRarity.test.ts` — fixture catalogue → deterministic snapshots; idempotent (running twice produces identical week-of rows)
- `census/diff.test.ts` — top-N risers/fallers identified correctly across realistic before/after distributions; no-change weeks produce empty diff
- `census/prompt.test.ts` — Claude prompt includes every binomial pre-resolved by the diff, instruction to wrap in asterisks, voice constraints
- `census/index.test.ts` — under low-N, recompute runs but no `activity_feed` row written; over threshold, full path runs; Claude error → snapshot still committed, no activity_feed row, error logged

### Manual / integration

- [ ] Run `recompute_rarity()` against staging data; verify labels feel right by eye
- [ ] Manually invoke the census Worker via a test trigger; verify Gazette shows the Census Notice; click a binomial; confirm species page loads with back-link returning to Gazette
- [ ] Cron runs in production for one full week; smoke-test the resulting Notice
- [ ] Discovery flow: scan a new species; confirm `discoveries.rarity_at_discovery` is populated from current `species.rarity_label` at insert

---

## Acceptance criteria

- [ ] `recompute_rarity()` runs against the production catalogue and produces sensible labels by visual inspection
- [ ] `rarity_snapshots` populated with one row per species per week
- [ ] Cloudflare Cron Trigger fires the census Worker on schedule
- [ ] Census Notice appears in the Gazette feed with body, period, and clickable binomials
- [ ] Clicking a binomial in a Census Notice navigates to the species page; back-link returns to Gazette
- [ ] Low-N suppression: forcing N below threshold in staging produces "Provisional" stamps and no Census Notice
- [ ] No surface in the app reveals trait-level rarity breakdowns or algorithmic terminology
- [ ] At-discovery rarity stamps render correctly in cabinet and Gazette compact dispatches; species page shows current rarity
- [ ] Test coverage ≥ 95% lines/functions/statements on new components, helpers, and worker code; ≥ 90% branches
- [ ] `npx tsc --noEmit` clean
- [ ] PR reviewed via `/review-pr` (will likely escalate to team review — multiple new tables, cron, cross-system)

---

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Trait distribution dominated by a small number of axes, so rarity becomes meaningless ("everyone is in the top 5%") | Bucketed continuous traits + categorical traits balance the surprisal contribution; tune bucket counts after observing real data; thresholds are configurable |
| Recompute is expensive at scale | O(species × traits); microseconds on PostgreSQL for any realistic catalogue. If we ever hit millions of species, we'll re-evaluate |
| Claude hallucinates a binomial not in the pre-supplied list | Renderer falls back to plain italic; logged as warning. Prompt explicitly instructs against fabrication |
| Rarity score moves on a weekly cycle, surprising users | Mitigated by `rarity_at_discovery` snapshot — discoverer's view never moves. Catalogue view does, and the Census Notice itself frames the shift as part of the experience |
| Gameability via QR farming | Trait surprisal is invariant to scan volume — manufacturing scans of the same species doesn't change its trait distribution. The only real attack is brute-forcing QR space to find rare combinations, which is visible in the public Gazette |
| `recompute_rarity()` runs while a discovery is being inserted (race) | Wrap recompute in a single transaction; insert path reads `species.rarity_label` for `rarity_at_discovery` snapshot — worst case the discoverer gets the *old* label, which is acceptable since their stamp is frozen anyway |
| Cron failure goes unnoticed | Existing Worker observability + a soft alert if `rarity_snapshots` has no row for the most recent Sunday |
| Existing users see their cabinet specimens shift tier on first deploy (count-based "rare" → trait-based "common", or vice-versa) | Acceptable — old tiers were never meaningful, and the new ones are explicitly badged differently (Extraordinary / Notable / Common, not Rare / Uncommon / Common). Cabinet uses `rarity_at_discovery` populated by a one-off backfill that snapshots the *new* label at the time of supersession. Magnus's discoveries from before this spec inherit the new tier, not the old one |
| Existing field notes implicitly reference rarity | Manual review: grep existing `species_images.field_notes` for the words *rare, common, uncommon, scarce, abundant* in the rarity sense. Spot-check ~50 rows. If found, regenerate; otherwise leave alone. Add the prompt-level constraint going forward |
| Vocabulary change (Rare → Extraordinary) confuses existing users | One-time release note in the Gazette explaining the recalibration, Victorian-tone — naturally framed as the Society having reviewed its tiers |

---

## Sequencing

This spec ships **after** [`gazette-feed-redesign.md`](./gazette-feed-redesign.md). The redesign establishes the `CompactDispatch`, `FeaturedDispatch`, and `pull_quote` infrastructure that the rarity stamps and Census Notice plug into. Order:

- **PR 1** (gazette redesign): layout, pull-quotes, dispatch-of-the-day rule, mock retired
- **PR 2** (gazette redesign follow-up): mobile scroll-reveal
- **PR 3** (this spec): rarity columns, snapshots, recompute function, rarity stamps in the redesigned dispatches, at-discovery snapshot in `discoveries`
- **PR 4** (this spec): census Worker, Cron Trigger, Census Notice rendering

PR 3 and PR 4 can be split or combined depending on review appetite — they're independent but the Census Notice has nothing to talk about until rarity scoring exists. If split, PR 3 lands the scoring system silently; PR 4 reveals it via the first weekly Notice.

---

## Open questions

- **Should the species page also show *discoverer's* at-discovery rarity for non-viewers** — i.e., should an explorer reading about a species someone else found see "First catalogued at Top 4%" as a static historical fact, regardless of who discovered it? Argument for: it's the species' biography; the moment it entered the catalogue is a fact worth recording. Argument against: the Census Notice already narrates these shifts at the catalogue level; per-species history bloats the species page. *Default: not in scope; surface only the viewer's own at-discovery if they're logged in and discovered this species.*
- **One-time release notice format** — Gazette post (one-off, pinned for a week)? In-app banner? Email? Default: a pinned `census` Notice with bespoke body, then it scrolls away into the regular Census cadence.
- **Provisional threshold** — `<100 observed species` is a guess. May want to revisit after running `recompute_rarity()` against staging data and seeing whether the percentages feel meaningful at, say, 75 or 150 species.
