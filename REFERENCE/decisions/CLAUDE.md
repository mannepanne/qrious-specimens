# Architecture Decision Records (ADRs)

Auto-loaded when working with files in this directory. Documents architectural decisions and their reasoning.

---

## What are ADRs?

**Architecture Decision Records** capture the reasoning behind significant technical choices. They prevent re-debating decisions by documenting:

- What was decided
- Why this came up
- What alternatives were considered
- Why this option won
- What trade-offs were accepted

**Key insight:** Written reasoning compounds. Opinions evaporate.

---

## When to create an ADR

**Create an ADR when making decisions that:**
- Affect architecture beyond today's PR
- Choose between meaningful alternatives (library, pattern, API design)
- Involve significant trade-offs
- Decide NOT to do something (equally important)
- Will constrain or enable future work

**Don't create for:**
- Tactical implementation details (belongs in code comments)
- Obvious choices (no alternatives considered)
- Easily reversible decisions
- Preferences without reasoning

**Rule of thumb:** If you spent >15 minutes debating it with reasoning, it probably deserves an ADR.

---

## How it works

### When decision is made

**Claude's role:**
1. Recognize when a decision "outlasts today's PR"
2. Prompt: "This decision affects future architecture. Should I create an ADR in REFERENCE/decisions/?"
3. User confirms or declines
4. If confirmed, Claude creates ADR using template format

**User's role:**
- Confirm when Claude suggests ADR
- Or request ADR explicitly: "Let's document this decision"

### Before making similar decision

**Search precedent first:**
```bash
grep -r "library" REFERENCE/decisions/
grep -r "authentication" REFERENCE/decisions/
```

**Follow existing ADR unless:**
- New information invalidates the reasoning
- Context has changed significantly
- Trade-offs no longer apply

**If superseding:** Create new ADR referencing the old one, mark old as "Superseded"

---

## ADR format

**Filename:** `YYYY-MM-DD-{topic}.md` (chronological + descriptive)

**Example:** `2026-03-29-jwt-authentication.md`

**Template:**
```markdown
# ADR: {What you decided}

**Date:** YYYY-MM-DD
**Status:** Active | Superseded | Deprecated
**Supersedes:** (if applicable)

---

## Decision

[One sentence: what was decided]

## Context

[Why this decision came up. What problem are we solving?]

## Alternatives considered

- **Option A:** [Description] - [Why not this]
- **Option B:** [Description] - [Why not this]
- **Chosen: Option C:** [Description] - [Why this won]

## Reasoning

[Detailed explanation of why this option was chosen]

[Key factors that influenced the decision]

## Trade-offs accepted

[What we gave up by choosing this]

[Limitations or constraints this introduces]

## Implications

[What this enables going forward]

[What this prevents or makes harder]

---

## References

- Related ADRs: (if applicable)
- External resources: (if applicable)
- Relevant specs: (if applicable)
```

---

## ADR Index

**Format:** Listed chronologically (newest first)

- [2026-05-29 — Security response headers via a Worker-wide wrapper](./2026-05-29-security-response-headers.md) — CSP + four hardening headers applied to every response by `withSecurityHeaders()` in `workers/shared/securityHeaders.ts`, with `run_worker_first = true` so static assets flow through it. CSP ships **enforcing directly** (report-only gives no signal without a collection endpoint); HSTS stays edge-owned to avoid duplicate headers. Supersedes the 2026-04-09 CSP ADR, whose report-only-first phase rollout never executed. Operations reference: [`REFERENCE/security-headers.md`](../security-headers.md).
- [2026-05-12 — Live-derived rarity tiers + per-event tier-change Gazette posts](./2026-05-12-tier-change-events.md) — rarity (Extraordinary / Notable / Common) is derived live from `species_discoveries.discovery_count` everywhere it renders; no snapshot column. When a discovery crosses a tier threshold, `register_discovery` inserts a `tier_change` row into `activity_feed` and the worker PATCHes `tier_change_body` with a one-shot text-only Haiku notice (mirrors the pull-quote pipeline). Soft-fail to a hand-written template. `pickFeaturedId` excludes `tier_change` from the featured slot. Predecessor spec rejected the trait-distribution / percentile rarity approach.
- [2026-05-10 — Pull-quote generation as a separate text-only Claude follow-up call](./2026-05-10-pull-quote-generation.md) — Field Dispatches Gazette redesign needs a one-line evocative quote per dispatch. Done as a second sequential text-only Haiku call after the multimodal field-notes call, soft-fail (`pull_quote = null` + render-time excerpt fallback), rather than a single-call delimited output. The load-bearing argument: trial harness, backfill, and live worker all reuse the same `generatePullQuote()` function, so the corpus variety regression test is genuinely guarding the production path. Independent prompt iteration with isolated tests; ~600–900ms added to cold-cache discovery latency, accepted.
- [2026-05-04 — Route Supabase Auth emails through Resend SMTP](./2026-05-04-resend-smtp-for-supabase-auth.md) — switch Supabase Auth's email delivery from the built-in dev mailer (~4/hour) to Resend's SMTP relay (3000/day), reusing the existing Resend account and verified `hultberg.org` domain; sender becomes `QRious Specimens <gazette@hultberg.org>`. Triggered by hitting the built-in limit during template iteration. Two integration paths to Resend now coexist (HTTP API for contact-form, SMTP for auth); accepted as intentional.
- [2026-05-04 — Worker-mediated account erasure for full GDPR Article 17 compliance](./2026-05-04-worker-mediated-account-erasure.md) — close TD-019 with a `/api/admin-delete-user` Worker route that wraps `admin_delete_user_data` RPC + Supabase Auth Admin API delete behind a JWT + `is_admin()` gate. Admin-only path; no self-service deletion. Honest about non-atomicity — partial failure surfaces in the response shape rather than being faked through discipline (runbook) or privilege escalation (Postgres cross-schema function).
- [2026-05-04 — Adopt pgTAP for a database-level smoke suite covering SECURITY DEFINER RPCs](./2026-05-04-pgtap-smoke-suite.md) — eleven `SECURITY DEFINER` RPCs across Phases 4–9 currently have no DB-level tests; pgTAP suite (~50–80 lines) under `supabase/tests/` run by `pg_prove` against `postgres:16` + `pgtap` in CI. Sequenced after Phase 9 launch-critical work, before public sign-ups. Tracked as TD-021.
- [2026-04-26 — PreToolUse hook as the authoritative path for silencing SCRATCH/ Write prompts](./2026-04-26-scratch-write-pretooluse-hook.md) — `Write(/SCRATCH/*)` allow-list entries empirically don't silence the prompt across five sightings; a project-local `PreToolUse` hook emits `permissionDecision: "allow"` and is the supported path until upstream is fixed. Operations reference at [`REFERENCE/scratch-write-hook.md`](../scratch-write-hook.md); diagnosis trail at `SPECIFICATIONS/ARCHIVE/INVESTIGATION-claude-code-write-path-normalisation.md`.
- [2026-04-26 — Pin allow-list rules to subcommands when binaries can evaluate code](./2026-04-26-allowlist-pinning-principle.md) — when adding to `permissions.allow`, pin to specific subcommands for binaries with `-c`/`-e`/`-m` style code-eval (`python3`, `node`, `bash`); allow at binary level for pure data transformers with no shell-out (`jq`). Companion to the threat-model ADR — that one sets the posture, this one sets the granularity. Includes a per-binary risk table.
- [2026-04-25 — PR review system assumes a solo trusted contributor](./2026-04-25-pr-review-threat-model.md) — why permissions and reviewer-agent severity defaults are calibrated for a single-contributor or small-trusted-team setting, what's in/out of scope, and the tightening checklist for derivative projects whose contributor model differs.
- [2026-04-22 — Opt-in config flag for the review system, with local override](./2026-04-22-prreviewmode-opt-in-config.md) — why `prReviewMode` is a tri-state enum (`enabled` / `disabled` / `prompt-on-first-use`), why the template default is the prompt state, why there's a gitignored local override, and why the gate logic is canonical-not-copied (single source of truth in `.claude/skills/review-gate.md`, referenced from each skill's Step 0 rather than duplicated).
- [2026-04-22 — Tiered PR review via a triage dispatcher](./2026-04-22-tiered-pr-review-dispatcher.md) — why `/review-pr` triages into light/standard/team tiers, why the rubric lives in a prompt, and why `/review-pr-team` stays independent.
- [2026-04-20 — JWKS JWT verification (with HS256 fallback)](./2026-04-20-jwks-jwt-verification.md) — Worker verifies Supabase ES256/RS256 tokens via JWKS with per-isolate cache and kid-miss refetch; HS256 retained for legacy projects; resolves TD-007
- [2026-04-20 — Cloudflare Images over R2](./2026-04-20-cloudflare-images-over-r2.md) — Specimen illustrations stored in CF Images; R2 bucket retired; supersedes earlier "stick with R2" decision
- [2026-04-19 — Retain contact messages on GDPR delete](./2026-04-19-retain-contact-messages-on-gdpr-delete.md) — Contact messages kept after erasure requests; GDPR Art. 17(3) legal basis, provability of acting on user requests
- [2026-04-09 — Layered navigation model](./2026-04-09-layered-navigation-model.md) — Tab/overlay/subpage state, why no URL router, auth gate per destination
- [2026-04-09 — CSP before Phase 4](./2026-04-09-csp-before-phase-4.md) — *(Superseded by 2026-05-29)* CSP delivery via Cloudflare Worker, report-only in Phase 3, enforce before Phase 4 merges — the phase rollout never executed

---

## Example ADR

See [TEMPLATE-adr.md](./TEMPLATE-adr.md) for a complete example.

---

## Integration with other docs

**ADRs complement:**
- **SPECIFICATIONS/** - Plans reference ADRs for context ("We're doing X because ADR-015")
- **REFERENCE/** - How-it-works docs reference ADRs for "why this way"
- **Code comments** - Link to relevant ADR for architectural choices
- **PR descriptions** - Mention ADR if decision was made during PR work

**ADRs are permanent:**
- Committed to version control
- Survive compaction, crashes, months
- Searchable and linkable
- Build institutional knowledge over time

---

## Best practices

**Writing ADRs:**
- Be specific about alternatives (not "considered other options")
- Explain reasoning clearly (someone reading 6 months later should understand)
- Include trade-offs honestly (every choice has downsides)
- Use British English (project standard)
- Keep concise but complete

**Maintaining ADRs:**
- Never delete (mark as Superseded instead)
- Update index in this CLAUDE.md when adding new ADR
- Link related ADRs together
- Reference from specs/docs where relevant

**Using ADRs:**
- Search before making similar decision
- Follow precedent unless context changed
- Create new ADR if superseding old decision
- Link to ADRs in PR descriptions for context

---

## Credits

Inspired by:
- [Michael Nygard's ADR pattern](http://thinkrelevance.com/blog/2011/11/15/documenting-architecture-decisions)
- LinkedIn post about preventing re-debate of settled decisions
- Experience with Claude Code sessions losing decision context
