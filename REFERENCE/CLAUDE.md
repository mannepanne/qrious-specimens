# Reference Documentation Library

Auto-loaded when working with files in this directory. How-it-works documentation for implemented features.

## Files in this directory

### [testing-strategy.md](./testing-strategy.md)
**When to read:** Writing tests, setting up test coverage, or implementing TDD workflow.

Complete testing philosophy, framework setup (Vitest), test categories, coverage requirements, and CI/CD integration.

### [technical-debt.md](./technical-debt.md)
**When to read:** Planning refactors, reviewing known issues, or documenting accepted shortcuts.

Tracker for known limitations, accepted risks, and deferred improvements with risk assessments.

### [environment-setup.md](./environment-setup.md)
**When to read:** Setting up local development, configuring secrets, or deploying to production.

Environment variables, API key configuration, third-party service setup (Supabase, Readwise, Perplexity, Resend).

### [troubleshooting.md](./troubleshooting.md)
**When to read:** Debugging issues, fixing deployment problems, or resolving API integration errors.

Common issues and solutions for local development, deployment, and API integrations.

### [pr-review-workflow.md](./pr-review-workflow.md)
**When to read:** Creating PRs or running code reviews.

How to use `/review-pr` and `/review-pr-team` skills for automated code review.

### [creature-engine.md](./creature-engine.md)
**When to read:** Working on the scan flow, DNA generation, rendering, cabinet, or rarity system.

DNA pipeline (djb2 → FNV-1a → mulberry32 → CreatureDNA), scan flow with parallel DB insert, renderer architecture, infinite scroll pattern, rarity system, and DB schema.

### [gazette.md](./gazette.md)
**When to read:** Working on the Gazette tab, community feed, explorer profiles, badge awarding, activity posting, or cross-tab species navigation.

Community layer: explorer profiles privacy model, three RPCs (`get_community_feed`, `get_explorer_showcase`, `get_community_stats`, `check_and_award_badges`), `useCommunity` hooks, activity feed write timing, Victorian name generator, cross-tab navigation pattern, and first discoverer credit.

### [catalogue.md](./catalogue.md)
**When to read:** Working on the catalogue page, `get_catalogue` RPC, species filters, or the taxonomy sidebar.

Data architecture (species_images + creatures.dna join), `get_catalogue` RPC parameters and security notes, `useCatalogue` / `useCatalogueTaxonomy` hooks, component overview, field notes auth-gating, sketch fallback, and known edge cases.

### [ai-generation-worker.md](./ai-generation-worker.md)
**When to read:** Working on illustration generation, the Cloudflare Worker, the excavation animation, or the discovery pipeline.

Worker request flow (8 steps), Gemini + Claude Haiku integration, R2 image storage, `useSpeciesImage` hook, `ExcavationAnimation` state machine, and end-to-end discovery flow.

### [decisions/](./decisions/)
**When to read:** Making architectural decisions, choosing between alternatives, or looking up why something was built the way it was.

Architecture Decision Records (ADRs) — permanent log of significant technical choices, alternatives considered, and trade-offs accepted.
