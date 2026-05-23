# ADR: Adopt pgTAP for a database-level smoke suite covering SECURITY DEFINER RPCs

**Date:** 2026-05-04
**Status:** Active (planned — not yet implemented; tracked as TD-021)
**Supersedes:** N/A

---

## Decision

Adopt [pgTAP](https://pgtap.org/) as the test framework for a small, dedicated SQL-level smoke suite covering the project's `SECURITY DEFINER` RPCs and the RLS policies they sit alongside. The suite will be introduced in a single dedicated PR before public launch, sequenced after the Phase 9 user-facing work (Privacy/About/Contact, error handling) but before public sign-ups open.

## Context

Phase 8 and Phase 9 between them have produced eleven `SECURITY DEFINER` RPCs touching account data, attribution credit, community feeds, and statistics. None have direct database-level tests:

| RPC | Phase | Touches |
|---|---|---|
| `is_admin` | 8 | Used by every admin RLS check |
| `admin_list_users` | 8 | `auth.users` join |
| `admin_export_user_data` | 8 | All user data, GDPR Article 15 |
| `admin_delete_user_data` | 8 / 9 | All user data + first-discoverer credit, GDPR Article 17 |
| `admin_get_stats` | 8 | Cross-table aggregates |
| `register_discovery` | 4 | First-discoverer credit insert |
| `get_catalogue` | 5 | Public species data, COALESCEs first_discoverer_id |
| `get_species_by_hash` | 6 | Single-species lookup, COALESCEs first_discoverer_id |
| `get_community_feed` | 6 | Activity feed with privacy filtering |
| `get_explorer_showcase` | 6 | Explorer profile aggregation |
| `check_and_award_badges` | 6 / 9 | Badge insertion logic |

The current safety net for these is:
- TypeScript hook tests (`useAdmin.test.ts`, `useCommunity.test.ts`, etc.) that mock the Supabase client and verify the *frontend calls the right RPC with the right shape* — they do not verify what the RPC actually does.
- Manual smoke tests after deployment (admin clicks "delete" on a test account, verifies cleanup by inspection).

This was acceptable through Phase 8. PR #78 (TD-018: anonymise first-discoverer on delete) flagged the gap clearly: the migration had a non-trivial behavioural change (UPDATE-before-DELETE on two tables, plus an idempotent backfill block), defended only by a hook test that asserts the frontend calls `admin_delete_user_data`. A future migration could silently break the cleanup logic — wrong column name, missed FK, regression in the COALESCE fallback — and CI would not catch it.

The accumulated RPC surface plus the imminent public-launch threshold make a database-level test harness load-bearing rather than nice-to-have.

## Alternatives considered

- **Ad-hoc manual smoke tests in the admin runbook.** Document a checklist for each admin action and run it after every migration affecting an RPC.
  - Why not: relies on discipline, not enforcement; CI can't fail; regressions ship to production until someone manually retests; doesn't scale beyond a single admin.

- **Integration tests against a live Supabase instance via the JS client.** Spin up a test Supabase project (or use the local `supabase start` stack), seed fixtures, call RPCs through the `@supabase/supabase-js` client, assert on results.
  - Why not: tests the JS client + network + auth + RPC stack as a whole, not the RPC behaviour. Slow (network round-trips), flaky (auth tokens, network), and test failures don't isolate cleanly to "the RPC misbehaved." Also doesn't cover RLS testing well — RLS testing requires impersonating different roles, which is awkward through the JS client.

- **Postgres trigger-based assertions baked into the schema.** Add `CHECK` constraints and assertion triggers that fail loudly if invariants break.
  - Why not: pollutes production schema with test-only logic; constraint failures crash actual user operations rather than failing CI; no way to test RLS policies; can't assert on "this RPC returns X given Y" semantics.

- **Roll our own SQL test runner.** Write a thin Bun script that loads SQL files, runs them in a transaction, asserts on results, rolls back.
  - Why not: NIH for a problem pgTAP already solves well; we'd reinvent test isolation, output formatting, fixture cleanup, error reporting; pgTAP's TAP output integrates with CI runners that already exist (`pg_prove`).

- **Chosen — pgTAP suite running against a containerised Postgres in CI.** SQL test files under `supabase/tests/`, executed by `pg_prove` in a dedicated CI job against a `postgres:16` container with `pgtap` extension installed and the project's migrations applied.

## Reasoning

**Tests live where the code lives.** The functions are SQL, the tests are SQL, the runtime is Postgres. No language boundary, no mocking, no impedance mismatch — `SELECT is(admin_delete_user_data('uuid'), NULL); SELECT ok(NOT EXISTS (SELECT 1 FROM creatures WHERE user_id = 'uuid'));` reads naturally to anyone who can read the migration.

**RLS is testable.** pgTAP can `SET ROLE authenticated; SET request.jwt.claims = '{"sub":"..."}'` and assert that a non-owner user can't see another user's rows. This is the killer feature — RLS is the project's primary access-control mechanism, and there is currently no way to verify it doesn't regress.

**Marginal cost per test is low.** Once the harness exists (extension installed, CI job wired, fixture pattern established), adding a test for a new RPC is ~10–20 lines of SQL. Encouraging tests-with-each-migration becomes practical.

**Industry standard for Postgres.** pgTAP has been the de-facto standard for SQL unit testing for over a decade. Documentation is mature, idioms are well-established, examples are plentiful. Not a niche bet.

**Scoped to load-bearing surface, not exhaustive.** The plan is a *smoke* suite, not full coverage. Target invariants:

1. Every admin RPC raises `Unauthorized` for non-admins (single fixture, five assertions).
2. `admin_delete_user_data` removes all rows it should remove and nulls all credits it should null, leaving no orphans.
3. The TD-018 backfill is idempotent (running it twice is a no-op the second time).
4. `get_catalogue` and `get_species_by_hash` survive nulled `first_discoverer_id` (return rows with null discoverer credit, not zero rows or errors).
5. Phase 8 RLS: a non-admin user cannot read another user's `profiles` / `creatures` / `activity_feed` rows.
6. Phase 6 RLS: a private explorer's `activity_feed` rows are not surfaced via `get_community_feed`.

That's roughly 50–80 test lines. Enough to catch the regressions that scare us; not so much that maintenance dominates value.

**Defers comfortably without blocking immediate work.** The harness is genuinely a half-day of setup work plus an hour or two of test-writing. Bundling it into PR #78 — itself a 7-line RPC tweak — would be sledgehammer-on-walnut. Bundling it into Phase 9's user-facing work would dilute reviewer attention. Doing it as its own coherent PR after the launch-critical pages land is the cleanest sequencing.

## Trade-offs accepted

**SQL test files alongside TypeScript tests.** Two test runners, two test directories (`src/**/*.test.ts` for Vitest, `supabase/tests/**/*.sql` for pgTAP). Slight cognitive overhead — a contributor wanting to add tests has to decide which kind. Mitigated by clear convention: anything that asserts on RPC behaviour or RLS belongs in pgTAP; anything that asserts on hook/component behaviour belongs in Vitest. The Supabase CLI uses exactly this layout, so the pattern is familiar to anyone who's worked with Supabase before.

**CI complexity grows.** A new GitHub Actions job (or step) is required to spin up the Postgres container, install pgTAP, apply migrations, run `pg_prove`. Adds ~30–60 seconds to CI runs and one more thing that can break. Acceptable cost for the regression coverage it provides.

**Local development friction.** Contributors who want to run pgTAP tests locally need either Docker (`docker run postgres:16` + extension setup) or `supabase start` (~700MB stack download). Mitigated by making local pgTAP runs optional — CI is the enforcement point, local development can lean on Vitest tests as a fast inner loop.

**Won't catch every class of bug.** pgTAP tests catch behavioural regressions in well-defined RPC contracts. They do *not* catch:
- Performance regressions (a query plan flip from index to seq-scan).
- Concurrency bugs (race conditions between transactions).
- Migration ordering bugs (a function being defined before a table it references).

Out of scope for the smoke suite. Performance and concurrency get separate attention if and when they become problems.

**Setup is one-off, then forgotten.** The harness investment doesn't compound automatically — every new RPC has to deliberately get a test added. Reliance on convention plus PR review to maintain coverage.

## Implications

**Enables:**
- CI-enforced confidence that admin RPCs behave correctly across migrations.
- Confidence to refactor `admin_delete_user_data` and the catalogue RPCs without manual post-deploy verification.
- Future ability to add RLS assertion tests as the access-control surface grows (especially relevant if the project ever opens to multi-admin or community-moderation roles).
- A natural home for the TD-020 search_path sweep verification (`SELECT proconfig FROM pg_proc WHERE proname = ...` assertions that the setting is present on every admin RPC).

**Prevents:**
- "It works on my machine" regressions in RPC behaviour.
- Silent breakage of GDPR Article 15/17 paths between releases.

**Does not enable:**
- Replacement of the existing Vitest hook tests — those still verify the frontend wiring, which pgTAP cannot.
- Confidence in non-RPC SQL paths (raw queries from `useCommunity`, `useCatalogue`, etc., that go through PostgREST rather than RPC). Those remain covered by Vitest hook tests with mocked Supabase responses.

## Sequencing

1. Phase 9 user-facing work lands first (Privacy/About/Contact, error handling) — those are launch-blocking.
2. Dedicated PR introduces the harness:
   - `supabase/tests/setup.sql` (pgTAP extension load, fixture helpers).
   - `supabase/tests/admin_rpcs.sql` (the six smoke assertions above).
   - GitHub Actions workflow step running `pg_prove` against `postgres:16` + applied migrations.
   - `REFERENCE/testing-strategy.md` updated to reference the SQL test path.
3. From that PR onwards, every migration that adds or changes an RPC adds (or extends) a pgTAP test in the same PR.

## References

- [pgTAP project site](https://pgtap.org/)
- [`pg_prove` — TAP-compatible test runner](https://pgtap.org/pg_prove.html)
- [Supabase testing guide (uses pgTAP)](https://supabase.com/docs/guides/database/testing)
- TD-018 (resolved): `supabase/migrations/20260504000000_admin_delete_anonymises_first_discoverer.sql`
- TD-020 (resolved): `supabase/migrations/20260504000001_phase8_admin_search_path_hardening.sql`
- TD-021 (open — tracking implementation of this ADR): GitHub issue #117
- Threat model context: [2026-04-25-pr-review-threat-model.md](./2026-04-25-pr-review-threat-model.md)
- Phase 9 spec: `SPECIFICATIONS/09-polish-launch.md`
