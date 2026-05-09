# Gazette feed redesign — Field Dispatches

**Status:** Spec
**Type:** Feature redesign (post-launch)
**Working branch:** `feature/gazette-feed-mock` (mock) → `feature/gazette-feed-redesign` (real implementation)
**Mock route (dev only):** `/gazette-mock` — see `src/pages/GazetteFeedMockPage.tsx`

---

## Overview

The Gazette's activity timeline today is a tidy but flat list of 40px thumbnails, explorer name, and species binomial. It reads like a Slack timeline with coloured dots — undersells the strongest assets we have (the illustration and the field notes), and doesn't carry the Victorian-naturalist tone the rest of the app is reaching for.

This spec redesigns the feed as **Field Dispatches**: a journal-flavoured, mixed-density layout that pulls field notes into the surface, reserves a featured-dispatch treatment for one entry per day, and groups entries under italic dateline headers.

A sibling spec, [`rarity-and-census.md`](./rarity-and-census.md), layers a rarity-scoring system and a weekly Census Notice on top of the redesigned feed. The two specs are independent — the redesign ships first; rarity stamps and Census Notices fold in afterwards without altering the layout established here.

---

## Goals

- Make the feed *feel* like reading a Victorian field journal, not a stream
- Surface the field-note prose, our most on-brand content asset, in every entry
- Use a render-time rule to drive visual variety — most entries stay compact; one entry per day earns a featured layout
- Treat first-discoveries as flagged but not visually dominant (because every species is a first-for-someone in the early app, so featuring all firsts would drown the feed)

## Non-goals

- Search, filter, or sort controls on the feed
- Realtime updates / push notifications
- Pagination beyond what `useCommunityFeed` already does
- Pull-quotes on the species page or share previews — Gazette only for now
- Mobile scroll-reveal effect — split into a follow-up PR (see §Mobile featured-card scroll reveal)
- Rarity stamps on dispatches and the weekly Census Notice — visible in the mock as preview only; both ship via [`rarity-and-census.md`](./rarity-and-census.md)

---

## Reference: visual mock

A fully-styled standalone mock lives at `/gazette-mock` (dev only) — `src/pages/GazetteFeedMockPage.tsx`. It demonstrates:

- Dateline headers (*"Today, on the 4th of may"*) with hairline rules either side
- Featured dispatches: horizontal layout, ~55% text / ~45% image, alternating image side across the feed
- Compact dispatches: 80px illustration thumb, italic species name, italic field-note excerpt (2-line clamp), signature line in mono
- First-sighting tag — small `⭐ First sighting` smallcaps row above the binomial
- Badge dispatches: real emoji icon (🔬, ⭐, etc.) with tier-tinted ring, smallcaps tier label
- Fleuron dividers (✽) bracketing featured dispatches

**Treat the mock as the visual contract for *this* spec.** Implementation may diverge in component structure but should reproduce the layout and spacing.

The mock additionally previews rarity stamps and the Census Notice; **those are out of scope here** — they belong to `rarity-and-census.md` and will be added once that work lands.

---

## Pull-quotes — the major back-end change

**Every dispatch displays a pull-quote** — compact and featured alike. There's no dedicated "compact excerpt" path or random-sentence picker. One evocative line per specimen, generated once by Claude, used wherever we surface the entry in the Gazette.

### Why pull-quotes

Empirically settled by the pre-flight evidence test (rendered live at the bottom of `/gazette-mock`): the first sentences of existing field notes are well-written prose, but they're shape-uniform — almost every entry opens with `"Upon"` or a similar temporal preposition. A feed where every dispatch leads with the same opening shape reads like a parody. Pull-quotes earn their keep by freeing Claude from the field-notes "moment of discovery" framing and letting it lead with the image, the metaphor, or the striking detail.

Other supporting reasons:

- Field notes are observational by design ("ridge of dorsal bristles, suggesting nocturnal habits") — half the sentences are stage-setting, not lyrical. Slicing them produces forgettable feed entries.
- Generating it inline costs ~50 extra output tokens (~$0.0001 per discovery on Haiku 4.5). Per-discovery cost is rounding error, full-corpus backfill is well under a cent.

### Quality bar

- Up to ~35 words / 200 characters (roughly **2× the mock's current length**, per Magnus)
- Must stand alone as a self-contained line — no `"the specimen"`, no `"this creature"` referring to context not present
- Should aim for *extraordinary*: an image, a metaphor, a small turn of phrase. Not a summary.
- Match the Victorian naturalist voice already used in field notes
- Used **only in the Gazette feed** for now — not species page, not share previews. (Reframed as scope deferral, not architectural ceiling — see "Surface scoping" deferred-work list under §Out of scope.)

### Variety guidance — soft prompt, empirical trial loop

The pre-flight test surfaced the field-notes uniformity issue (every entry opens "Upon..."). The pull-quote prompt has to push against that, but **not by stacking absolute prohibitions** — that's the same kind of single rigid instruction that produced the "Upon..." problem in the first place. Ban "Upon" hard enough and Claude swings to a different uniform shape (every line starts with a colour, or with a noun) and we've replaced one shape-uniformity with another.

The pre-flight test pattern that just worked — *write the thing, look at the data, decide* — is the right pattern for the prompt itself.

**Directional guidance** (soft, in the prompt):

- Vary your openers across the corpus
- Avoid leaning repeatedly on temporal phrasings like `"Upon"`, `"When"`, `"Whilst"`, or on demonstratives like `"The specimen"`, `"This creature"`
- Lead with the most arresting concrete detail in the field notes — image, colour, action, gesture
- Match the Victorian naturalist voice already in the field notes
- Stand alone — no references to context not present in the line itself

**Hard rule (kept absolute):**

- **No rarity vocabulary.** Forward-compat with `rarity-and-census.md` — no `"rare"`, `"common"`, `"extraordinary"`, `"the rarest"`, percentile language. Not a stylistic call; pull-quotes must remain timeless as the catalogue grows and rarity shifts.

**Trial-and-score loop — explicit acceptance criterion:**

Before merging, run a 10-sample trial of `generatePullQuote()` against representative existing field notes. Log the openers. The prompt is good enough when:

- No single opener-shape (temporal, demonstrative, colour-led, noun-led, etc.) accounts for more than ~30% of samples
- Voice is consistently Victorian-naturalist; no slips into modern idiom or breathless ad-copy
- Each line stands alone — readable without the species page or the field notes around it

If any of those fail, iterate the prompt and re-run the trial. Capture the iteration log in the PR description as evidence the bar was met.

Expect 2–3 rounds of refinement against representative specimens before we're happy. Ship the redesign, then keep iterating on prompt quality and re-running backfill until the prose is genuinely lovely.

---

## Scope

### In scope

#### Backend
- [ ] Add `pull_quote text` column to `species_images`
- [ ] Add `generatePullQuote()` to `workers/generate-creature/claude.ts` — text-only Claude call, takes `field_notes` as input, returns one evocative line
- [ ] Add `buildPullQuotePrompt()` to `workers/generate-creature/prompt.ts`
- [ ] Update `workers/generate-creature/index.ts` to call generation in two sequential steps: `generateFieldNotes()` then `generatePullQuote()`; persist both; treat pull-quote failure as soft (write `null`, log, never block discovery)
- [ ] Backfill existing rows where `pull_quote IS NULL` using the same `generatePullQuote()` (see §Backfill)
- [ ] Update `get_community_feed` RPC to return both `field_notes` and `pull_quote`
- [ ] Update `useCommunity.ts` `FeedEntry` type accordingly

#### Frontend
- [ ] New components in `src/components/ActivityTimeline/`:
  - `FeaturedDispatch.tsx` — horizontal, alternating
  - `CompactDispatch.tsx` — thumb + italic excerpt + signature
  - `BadgeDispatch.tsx` — emoji + tier ring + smallcaps
  - `DatelineHeader.tsx` — italic dateline with hairline rules
  - `Fleuron.tsx` — decorative divider
- [ ] Replace existing `ActivityTimeline.tsx` to compose the above (keep the same export surface so `GazettePage` doesn't change)
- [ ] `dateline()` and `groupByDay()` helpers — `src/lib/feedDate.ts`
- [ ] `excerptFromFieldNotes()` helper for the null-pull-quote fallback (see §Pull-quote null fallback)
- [ ] Featured-card alternation: track a counter walking the chronological feed; `mirrored = featuredCount % 2 === 1`
- [ ] Tests for all new components and helpers (see §Testing)

#### Migrations
- [ ] `supabase/migrations/<ts>_species_images_pull_quote.sql` — `ALTER TABLE` + index not needed
- [ ] `supabase/migrations/<ts>_get_community_feed_v2.sql` — recreate RPC with new return columns

#### Documentation
- [ ] `REFERENCE/gazette.md` — update with new component breakdown
- [ ] `REFERENCE/decisions/<date>-pull-quote-generation.md` — ADR for "two consecutive Claude calls (field notes, then pull-quote), separate pull-quote column"
- [ ] **Mock-page lifecycle:** keep `/gazette-mock`, `GazetteFeedMockPage.tsx`, and `public/mock/*.jpg` through the redesign PR and the mobile scroll-reveal PR. Removal is a separate, final cleanup step once Magnus signs off that polish is complete on both surfaces.

### Out of scope

- Mobile featured-dispatch horizontal layout (collapses to vertical <640px — acceptable for now)
- Hand-curated "Dispatch of the day" override for low-rarity days
- Pull-quote regeneration UI in admin
- Localisation of dateline text

---

## Technical approach

### Pull-quote generation — two consecutive Claude calls

`generateFieldNotes()` and `generatePullQuote()` live as separate functions in `workers/generate-creature/claude.ts`. The discovery flow runs them sequentially:

1. **Field notes** — multimodal call (image + DNA traits), as today. Returns the multi-paragraph naturalist prose. `max_tokens: 300`. Voice: observational.
2. **Pull-quote** — text-only call. Input: the field notes from step 1, plus a tight prompt asking for a single evocative line of up to ~35 words, standalone (no leading "the specimen", no "this creature", no references to context not present in the line itself). Returns one line. `max_tokens: 80`. Voice: lyrical, image-rich.

Combined latency on Haiku 4.5 is ~1.5–2.5s, slotted entirely behind the excavation animation, so user-visible latency is unchanged.

**Why two calls, not one delimited call:**

- *Symmetry with backfill.* Backfill is text-only — existing field notes → pull-quote. With two calls, the production path's pull-quote step shares its prompt and parser with the backfill script. One delimited call would force two code paths for what is conceptually the same operation.
- *Independent prompt tuning.* Field notes and pull-quotes are different jobs: multimodal vs text-only, observational vs lyrical, ~300 vs ~40 tokens of output. Folding them together makes every prompt tweak a compromise.
- *Robust parsing.* A clean string per call; no delimiter discipline required of the model.
- *Negligible cost.* Pull-quote call is ~150 input + ~40 output tokens on Haiku — fractions of a cent. Two API calls is overhead, not cost.

**Failure mode:** if step 2 fails (network, rate-limit, malformed response), persist `field_notes` with `pull_quote = null` and log a warning. Discovery never blocks on pull-quote generation. The next backfill run picks up the orphan.

### `species_images.pull_quote`

- `text` column, nullable (covers backfill grace period and parse-failure fallback)
- No index — only ever read alongside the row
- RLS policies on `species_images` already cover this (read-anon, write-service-role)

### Backfill

We have ~18 seeded species + N organic discoveries since launch. Need to populate `pull_quote` for all rows where it's currently null.

**Approach:** one-off backfill script (admin-run, not a migration) at `scripts/backfill-pull-quotes.ts`. The script reuses the production `generatePullQuote()` so both code paths share a single prompt. For each row with `field_notes IS NOT NULL AND pull_quote IS NULL`:

- Invoke `generatePullQuote(field_notes)`
- Write the result to `species_images.pull_quote`
- Sleep 200ms between calls to stay polite

Cost: ~$0.0001 per row × ~50 rows ≈ $0.005. Run-time: ~1 minute. Run once locally with service-role key. Idempotent (`WHERE pull_quote IS NULL`), safe to re-run after prompt iteration.

### Deploy ordering

Auto-deploy fires the moment the PR merges to main. The frontend will read `pull_quote` from the RPC immediately, before backfill has run, so:

1. PR merges; GitHub Actions deploys the migration, worker, and frontend together
2. The live `/gazette` shows the redesigned feed; existing rows have `pull_quote = null` and render via the field-notes-excerpt fallback (see §Pull-quote null fallback)
3. Magnus runs the backfill script locally with service-role key — takes ~1 minute
4. Cards quietly upgrade from raw-excerpt to curated pull-quote on next refresh

The fallback makes the brief null-render window invisible to users — they see a slightly less polished line, not a broken card. Backfilling immediately after merge is the recommended cadence; nothing breaks if it slips.

### Featured-vs-compact tiering — *Dispatch of the Day*

We have no rarity signal in the data today (no `anatomy_rarity`, no rarity score). Rather than invent one, the rule is render-time and pure-frontend:

> **Per dateline group (per UTC day), exactly one entry is featured.** Picked, in order of preference: the most recent `first_discovery` of the day; failing that, the most recent `discovery`. Badge-earned events never qualify. All other entries that day render as compact dispatches.

Properties:

- Always exactly one featured per day, predictable visual rhythm
- Zero schema changes, zero new data, computed in the renderer
- Scales naturally as activity grows
- Magnus may layer an editorial override on top later (e.g. an `is_featured` admin flag on `species_images`) — not in scope here

This **supersedes the `rare_discovery` event type**, which is dead code (see TD-012). Removing it is part of this work — drop the value from the DB CHECK constraint, the TS union, and the `EVENT_DOT` lookup. No data migration needed (nothing was ever posted).

### Compact-card tiering

Within compact dispatches:

- `event_type === 'first_discovery'` → compact card + `⭐ First sighting` tag above the binomial
- `event_type === 'discovery'` → plain compact card
- `event_type === 'badge_earned'` → badge dispatch

### Pull-quote null fallback

`pull_quote` may be null for two reasons: pre-backfill rows, and step-2 generation failures. The renderer always shows *something* in that slot — never collapses to a blank card.

Fallback: derive a short excerpt from `field_notes` at render time. Take the first sentence; if longer than ~200 characters (the pull-quote ceiling), truncate to ~200 characters at a word boundary and append `…`. Same italic styling as a real pull-quote. No visible distinction to the reader; they just get the opening line of the notes instead of a curated quote.

Helper: `excerptFromFieldNotes(field_notes: string): string` in `src/lib/feedDate.ts` (or a new `src/lib/pullQuote.ts` if it grows). Tested independently. The fallback is the *only* remaining caller of any field-note slicing — there is no random-sentence picker.

### Click target: compact-card → species page → back to gazette

The whole compact card surface (illustration thumb + tag + binomial + pull-quote + signature line) is one clickable button — preserves today's behaviour. Clicking navigates to `/species/:qrHash` with `state: { origin: 'gazette' }`. `SpeciesPage` already routes the close-button back to `/gazette` when `origin === 'gazette'` (see `src/pages/SpeciesPage.tsx:34`). No changes needed there; just don't break it.

### Featured alternation

Track a counter walking the chronological list. Each featured render increments. Even index = image right (default), odd = image left (`mirrored`). Stable across re-renders because order is stable. Combined with the one-featured-per-day rule, alternation flips daily.

### Dateline grouping

Group entries by their `created_at` date in UTC (chosen for determinism — server-side timestamp). Each group renders a `DatelineHeader` whose copy is:

- Same UTC day as today → `Today, on the Nth of <month>`
- Yesterday → `Yesterday, on the Nth of <month>`
- Older → `On the Nth of <month>`

(Year is suppressed for in-year entries; reconsider if/when feed depth crosses year boundaries.)

---

## Database schema changes

```sql
-- supabase/migrations/<ts>_species_images_pull_quote.sql
ALTER TABLE public.species_images ADD COLUMN IF NOT EXISTS pull_quote text;

-- supabase/migrations/<ts>_get_community_feed_v2.sql
-- Recreate RPC; add field_notes and pull_quote to RETURNS TABLE and SELECT.
-- Existing callers gain the columns; types regen via `supabase gen types`.
```

No RLS changes needed — `species_images` is publicly readable.

---

## Testing strategy

### Unit tests

- `feedDate.test.ts` — today / yesterday / older dateline copy, ordinal suffixes, group-by-day across DST boundaries
- `excerptFromFieldNotes.test.ts` (or co-located in `feedDate.test.ts`) — short field notes returned whole; long field notes truncated at word boundary with `…`; first sentence preferred when shorter than the cap
- `FeaturedDispatch.test.tsx` — renders eyebrow, pull-quote, signature; mirrors when `mirrored` prop true
- `CompactDispatch.test.tsx` — renders excerpt; shows first-sighting tag when `event_type === 'first_discovery'`; omits when other
- `BadgeDispatch.test.tsx` — renders icon and tier ring class
- `ActivityTimeline.test.tsx` — alternation across multiple featured cards; group separators between days; preserves existing `onViewSpecies` click behaviour for compact cards

### Worker tests

- `claude.test.ts` — `generatePullQuote()` returns a non-empty string on a typical response; trims surrounding whitespace and stray quote marks; surfaces the original error to the caller so the index handler can decide to write `null`
- `index.test.ts` — discovery flow persists `field_notes` even when `generatePullQuote()` throws; logs a warning; never propagates the failure to the client

### Integration / manual

- [ ] Mock route `/gazette-mock` matches the real feed visually, side-by-side comparison
- [ ] Live `/gazette` shows redesigned feed with real data after backfill
- [ ] Discovery flow end-to-end: scan → discover → field notes + pull-quote both populated in DB
- [ ] First-sighting tag appears when expected (event_type === 'first_discovery')
- [ ] Featured card alternation feels right with whatever rare specimens exist

---

## Acceptance criteria

- [ ] `species_images.pull_quote` column exists and is populated for **every** existing row
- [ ] New discoveries persist both `field_notes` and `pull_quote` (two sequential Claude calls); pull-quote failure does not block discovery
- [ ] Pull-quote prompt has cleared a 10-sample trial-and-score loop (no opener-shape >30%, voice consistent, lines stand alone); iteration log captured in the PR description
- [ ] `/gazette` renders Field Dispatches treatment exactly as the mock at `/gazette-mock`
- [ ] No regressions on `/gazette` — explorer showcase, community stats, join-prompt all unchanged
- [ ] Test coverage ≥ 95% lines/functions/statements on new components and helpers
- [ ] `npx tsc --noEmit` clean
- [ ] `/gazette-mock` route remains for now — removal is a separate cleanup PR after Magnus confirms polish is complete on both desktop and mobile surfaces
- [ ] PR reviewed via `/review-pr`

---

## Mobile featured-card scroll reveal — follow-up PR

The desktop featured layout (text + image side-by-side, alternating) doesn't translate to <640px, where there's no horizontal real-estate for two columns. Instead of falling back to a static stacked card, we'll do something properly fancy on mobile only.

### Effect

- Featured card on mobile renders the illustration **full-bleed at ~80vh**, sticky to the top of the card
- Pull-quote and signature live below in a content block which, as the user scrolls, slides up *over* the image like a curtain rising
- The image fades and slightly scales as the content overlaps it
- Once the card is fully scrolled past, the image releases and the next entry begins

### Implementation

- `position: sticky; top: 0` on the image container, height ~80vh
- Content block has appropriate top padding so it scrolls over the sticky image
- Fade/scale driven by **CSS scroll-driven animations**: `animation-timeline: view(block)`, `animation-range: contain 0% contain 50%` — declarative, no JavaScript scroll listeners
- Optional `backdrop-filter: blur(...)` on the content as it overlaps, for legibility on busy illustrations

### Constraints (non-negotiable)

- `@media (prefers-reduced-motion: reduce)` short-circuits to a static stacked layout — non-negotiable
- Test on a real low-end Android device before merge — sticky + scroll-driven animations can cost on weak GPUs
- Firefox needs the [scroll-driven-animations polyfill](https://github.com/flackr/scroll-timeline) or a graceful static fallback via `@supports (animation-timeline: view())`

### Sequencing

**Split into a follow-up PR** after the core redesign lands. Conflating "make the feed great" with "make mobile sing" risks one blocking the other. Track as:

- PR 1 (this spec): redesign + pull-quotes + backfill + dispatch-of-the-day rule
- PR 2 (follow-up): mobile scroll-reveal effect on featured cards

---

## Deferred polish

Capture in `REFERENCE/technical-debt.md` if they bite:

- **Pull-quote regeneration UI** — no admin tool to regenerate a pull-quote we don't like. Fine for now; the backfill script accepts a `qr_hash` filter for one-off reruns
- **Translated datelines** — locale-aware dateline rendering (no current need)
- **Editorial override** — `is_featured` admin flag on `species_images` to force-feature a specimen we love. Not needed at launch; layer on top of the dispatch-of-the-day rule if/when it's wanted

---

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Pull-quote step fails after field notes succeed | Persist `field_notes` anyway with `pull_quote = null`; log a warning; backfill picks it up next run |
| Two sequential calls add latency to discovery | Combined ~1.5–2.5s sits inside the excavation animation; user-visible latency unchanged |
| Backfill script run partially (network / rate limit) | Script is idempotent (`WHERE pull_quote IS NULL`), safe to re-run |
| Pull-quote quality is hit-or-miss | 2–3 rounds of prompt iteration in the work; can rerun backfill with improved prompt as needed |
| Featured-dispatch alternation feels arbitrary across page-loads if order shifts | Order is stable (`created_at DESC`); counter walks chronologically; same input → same alternation |

---

## Related work

- TD-012: `rare_discovery` event-type defined but never posted — **resolved by removing the event type entirely** as part of this work (replaced by render-time dispatch-of-the-day rule). The `census` event type is added separately by the rarity spec.
- [`rarity-and-census.md`](./rarity-and-census.md) — sibling spec covering the rarity score, weekly Census Notice, and per-discovery rarity stamps that the mock previews
- `REFERENCE/gazette.md` — current feed implementation
- `SPECIFICATIONS/ARCHIVE/06-gazette.md` — original Gazette spec
- `SPECIFICATIONS/ARCHIVE/04-ai-generation-workers.md` — current Claude worker setup

---

## Open questions

*(none currently outstanding — settled in conversation 2026-05-04 / 2026-05-05)*
