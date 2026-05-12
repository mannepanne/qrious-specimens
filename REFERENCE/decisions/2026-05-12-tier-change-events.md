# ADR: Live-derived rarity tiers + per-event tier-change Gazette posts

**Date:** 2026-05-12
**Status:** Active
**Supersedes:** N/A

---

## Decision

Rarity tier (`extraordinary` / `notable` / `common`) is derived **live** from `species_discoveries.discovery_count` everywhere it is rendered. No snapshot column, no scheduled re-evaluation. When a discovery crosses a tier boundary (count goes 3→4 or 15→16) the `register_discovery` RPC inserts a single `tier_change` row into `activity_feed`; the worker then issues a one-shot text-only Claude Haiku call (`generateTierChangeBody`) and PATCHes the row's `tier_change_body` with the resulting Society notice. Anthropic failure leaves `tier_change_body` NULL and `TierChangeDispatch` renders a hand-written template fallback.

## Context

The Gazette redesign needed a rarity treatment. Two questions had to be settled before any code:

1. **Where does tier live — on the row or in the count?** A `creatures.rarity_at_discovery` snapshot column would freeze the badge at scan time. A live derivation reads it from the species discovery count every render.
2. **When do users find out a tier changed?** Either as it happens (per-event posts at threshold crossings) or as a periodic Census Notice batch (weekly cron summarising movements).

The predecessor spec [`rarity-and-census-trait-surprisal.md`](../../SPECIFICATIONS/ARCHIVE/rarity-and-census-trait-surprisal.md) had additionally proposed a trait-distribution percentile score. That was rejected for a separate set of reasons (opacity, taxonomy mismatch) and is out of scope here.

Three constraints shaped this decision:

- **Prose stays accurate as the world changes.** Field notes describe the creature, not the catalogue's current opinion of it. A specimen you found when it was Extraordinary still reads the same prose today — only its tier badge shifts.
- **The cabinet is a window onto the present.** "I have an Extraordinary specimen" is a claim about the current world, not a frozen moment. Users explicitly liked this framing in spec discussion.
- **Tier-change posts are rare and bursty.** Each species crosses each forward boundary exactly once; the Anthropic spend ceiling is bounded by species growth, not discovery volume.

## Alternatives considered

- **Snapshot at discovery (`rarity_at_discovery` column):**
  - Why not: The first three discoverers of a species would forever hold "Extraordinary" cabinet cards even after the species became Common. Users would file appeals when "their" Extraordinary specimen displayed as Common (it shouldn't, because rarity is observable, not earned). Predictability suffers — two users with the same species can show different rarity. The snapshot also creates schema drift between cabinet view and catalogue view (catalogue is always live).

- **Scheduled Census Notice (weekly cron):**
  - Why not: Decouples the post from the moment of crossing. Users who pulled the threshold-crossing scan would not see the tier change attributable to their action — undermines the "live world" narrative. Weekly batch also requires a separate scheduler (Cloudflare Cron Trigger or pg_cron), separate failure mode (silent missed weeks), and breaks the "everything that happens flows through `activity_feed`" simplicity. Per-event posts piggyback on the existing RPC pipeline.

- **Per-event posts with a pre-baked template body (no Anthropic call):**
  - Why not: Tier-change copy benefits from the same Society voice the rest of the Gazette uses. A pure template ("X has crossed into the Notable tier") sits awkwardly against the AI-generated pull-quotes and field notes already populating the feed. Adding an LLM call for the rarest events on the platform (count growth, ~once per species per threshold) is cheap.

- **Per-event posts with the body produced in the same call as the field notes:**
  - Why not: Field-notes call is multimodal (image + text), runs only on the first scan of a species, and never knows whether the count crossed a threshold (that's decided by `register_discovery` inside Postgres, after the field-notes call). Bundling the two outputs would require restructuring the flow to defer field notes until after the RPC, lengthening the discovery path.

- **Chosen: live-derived tiers + per-event posts with a separate text-only Claude call, soft-fail to template:**
  - Why this won: Each piece is structurally simple. Tier display is a pure function of `discovery_count`. Tier-change post is a `register_discovery` side effect with a worker follow-up identical in shape to `generatePullQuote`. Failure path is a typed NULL with a deterministic frontend fallback.

## Reasoning

**Live derivation is the load-bearing call.** It makes the catalogue, cabinet, and Gazette show the same number for the same species, always. No backfill, no migration when thresholds change, no "why does this say Notable here and Common there" support burden. The `rarity` column on `activity_feed` is still populated (used by the eyebrow on `TierChangeDispatch` and by historical filters) but every other surface reads it via `getRarityFromCount()` from a centralised threshold table (`src/lib/rarity.ts`).

**Per-event posts win on narrative coherence.** The Gazette feed is already a stream of moments — first discoveries, badge awards, ordinary scans. A tier change is another moment. Surfacing it in-line preserves the rhythm of the feed and the cabinet remains the source of truth for the *current* state. A weekly batch would conflict with both halves: feed loses immediacy, cabinet has to either lag the batch or anticipate it.

**Symmetry with the pull-quote pipeline is intentional.** `generateTierChangeBody()` lives next to `generatePullQuote()`, follows the same shape (text-only, max-tokens cap, same response cleanup), and uses the same soft-fail contract (failure logs, returns NULL, frontend renders a fallback). Future Society-voice prose features (e.g. milestone notices, expedition postcards) can layer on the same harness — corpus regression test under `workers/generate-creature/` and trial harness under `scripts/`.

**The frontend renders the worker prose verbatim** with binomial extraction by `body.indexOf(binomial)` for italic-underline + species-page-link styling. This puts a hard contract on the prompt: the binomial must appear *exactly* as the worker passed it. The prompt enforces this (`prompt.ts` line 173), and the corpus regression test (`tierChangeBody.test.ts`) asserts every sample contains its binomial verbatim. Drift breaks the dispatch silently — hence the test guard.

**`pickFeaturedId` excludes `tier_change`** from the featured slot. Tier changes are noteworthy but not dispatch-of-the-day material — they describe a count crossing, not a creature. Featured slot stays reserved for `first_discovery` (preferred) and `discovery` (fallback). `tier_change` and `badge_earned` always render compact-inline.

## Trade-offs accepted

**Anthropic outage during a tier-cross loses the AI prose.** The fallback template ("X has settled into the Notable tier.") is plain and Society-flavoured but lacks the surrounding clause variety of the live-generated body. Accepted because tier-cross events are infrequent and the fallback is still in-voice. We do not retry — the post is decorative once the row exists, and the row is what unlocks the feed entry.

**Tier-change posts are not deletable independently of the underlying discovery.** The row is inserted in the same `register_discovery` transaction that records the discovery; both share the same RLS lifecycle. Accepted — there is no UX surface that asks to delete a tier-change without deleting the scan.

**Reverse-direction transitions (account deletion lowering a count below a threshold) use the same prompt path but only the forward verb-phrases are corpus-tested.** The prompt builder picks "elevated to the {Tier}" for reverse transitions but the trial harness and regression test only exercise forward transitions because reverse is rare (only fires on account deletions that move a species from 16→15 or 4→3). Accepted — if reverse transitions become common, extend the harness; until then forward-only coverage is sufficient.

**`tier_change` rows carry duplicate context vs the underlying discovery row.** Both rows reference the same species and timestamp range. Accepted because querying-by-event-type is the dominant access pattern; a join from a single row would complicate the feed RPC.

## Implications

**Enables:**
- Threshold retuning is a one-line change in `src/lib/rarity.ts` (the centralised thresholds); cabinet, catalogue, and `register_discovery` all read it. No backfill, no migration.
- Live tier means the cabinet visibly evolves as the catalogue fills — a marquee narrative property of the app.
- Future tier-related features (filter "show me my specimens that just crossed a tier", explorer-stats "you discovered the 4th of N species") read off `discovery_count` directly with no schema work.
- Society-voice prose pipeline is reusable: any future event type that needs an in-voice notice can copy the `generatePullQuote` / `generateTierChangeBody` pattern with a new prompt builder and a new soft-fail PATCH path.

**Prevents/complicates:**
- A user cannot "lock in" their Extraordinary discovery — there is no rarity-at-discovery to display alongside the live tier. If users start asking for this, the schema change is non-trivial (re-introducing the column means choosing a backfill semantic and updating six surfaces).
- The Anthropic API contract is now hit on three distinct paths per cold discovery: field notes (multimodal), pull-quote (text), and *sometimes* tier-change body (text). Quota exposure scales modestly with species growth.
- Adding new tiers (a "Legendary" tier above Extraordinary, say) requires updating thresholds, the prompt's idiom table, the RLS-RPC CHECK constraints, and the corpus regression test. The places to touch are well-named but spread across the worker / DB / frontend.

---

## References

- Spec: [`SPECIFICATIONS/rarity-and-census.md`](../../SPECIFICATIONS/rarity-and-census.md)
- Rejected predecessor: [`SPECIFICATIONS/ARCHIVE/rarity-and-census-trait-surprisal.md`](../../SPECIFICATIONS/ARCHIVE/rarity-and-census-trait-surprisal.md)
- Centralised thresholds: `src/lib/rarity.ts`
- Tier-change prompt: `workers/generate-creature/prompt.ts` (`buildTierChangeBodyPrompt`)
- Tier-change API client: `workers/generate-creature/claude.ts` (`generateTierChangeBody`)
- Worker integration: `workers/generate-creature/index.ts` (`maybeWriteTierChangeBody`)
- Frontend dispatch: `src/components/ActivityTimeline/TierChangeDispatch.tsx`
- Trial harness: `scripts/trial-tier-change-bodies.ts`
- Corpus regression: `workers/generate-creature/tierChangeBody.test.ts`
- Migrations: `20260511000000_activity_feed_tier_change_event_type.sql`, `20260511000001_register_discovery_tier_change.sql`, `20260511000002_rarity_vocabulary_rename.sql`, `20260511000003_get_community_feed_tier_change_body.sql`
- Related ADR: [`2026-05-10-pull-quote-generation.md`](./2026-05-10-pull-quote-generation.md) — same pattern, sibling pipeline
