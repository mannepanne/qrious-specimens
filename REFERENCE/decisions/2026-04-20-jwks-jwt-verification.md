# ADR: JWT verification via Supabase JWKS (with HS256 legacy fallback)

**Date:** 2026-04-20
**Status:** Active

---

## Decision

`verifyJWT()` in `workers/generate-creature/index.ts` dispatches on the JWT header's `alg` claim:

- **ES256 / RS256:** public key fetched from `{SUPABASE_URL}/auth/v1/.well-known/jwks.json`, cached in an isolate-local `Map` keyed by `SUPABASE_URL`. On `kid` miss the cache is refetched once (bypassing TTL) to cover Supabase signing-key rotation.
- **HS256 (legacy):** verified against the `SUPABASE_JWT_SECRET` worker secret if configured. Optional — modern Supabase projects do not issue HS256 tokens.
- **Any other `alg`** (including `none`): rejected with `Unsupported JWT alg`.

The worker classifies verification failures into two HTTP responses: `JwksUnavailableError` → **503** (Auth provider unavailable); any other throw → **401** (Invalid token). Both responses carry a `correlationId` UUID that is also logged server-side, so support can trace a user-facing failure back to a Worker log line without leaking verification detail to the client.

## Context

The worker shipped with HS256-only verification. In April 2026 Supabase migrated this project's signing keys to asymmetric ECC P-256 (ES256). From 2026-04-08 onwards every live `POST /api/generate-creature` returned 401 because `crypto.subtle.verify('HMAC', …)` cannot validate an ES256 signature. The frontend's silent fallback to a client-side SVG sketch (issue #43) hid the failure from observability for 12 days until a user noticed the "line art" specimens.

Two concerns had to be addressed simultaneously:

1. **Correctness under the new signing regime.** ES256 verification via JWKS is mandatory.
2. **Resilience.** The previous design had a second latent failure mode: had Supabase rotated keys on a live HS256-signed project, the fix would have silently regressed again. A robust implementation must handle rotation gracefully, time-bound the upstream call, and distinguish auth failures from upstream failures.

## Alternatives considered

- **HS256 only, re-enable legacy secret** — retain the original design and ask Magnus to toggle the project back onto HS256 signing in the Supabase dashboard.
  - Why not: moves responsibility off the app and pins us to a deprecated signing mode. Supabase is pushing projects toward asymmetric keys; sooner or later we'd have to do this work anyway.

- **Third-party JWT library (e.g. `jose`)** — delegate verification to a maintained library.
  - Why not: Cloudflare Workers size budget is tight; `jose` pulls a non-trivial surface area we don't need. WebCrypto inside Workers covers HS256, ES256, and RS256 natively in ~120 lines of well-reviewed code. Adding a dependency to solve a small, bounded problem would be over-engineering.

- **ES256 only (delete HS256 path)** — clean break, simpler code.
  - Why not: a short window where the production worker is mid-deploy or mid-rollback would hit tokens signed with either key. The HS256 branch is a handful of lines, cleanly fenced behind a header check, and backward-compatible. Deleting it saves nothing and removes an escape hatch. The plan is to delete the HS256 path in a separate PR once ES256 is confirmed stable and the legacy Wrangler secret has been removed.

- **Chosen: dual-path verification, JWKS-backed, with per-isolate cache and typed error surface.**

## Reasoning

**Per-isolate in-memory cache is the right Workers idiom.**
- JWKS bodies are small (≤2 KB) and the keys change on human timescales (months). Caching them per isolate for 10 minutes trades a negligible amount of memory for a dramatic reduction in latency (one round-trip to Supabase saved on every request).
- No cross-isolate coordination is needed. Each isolate re-fetches independently; cache drift across isolates during rotation is self-healing within the TTL.
- The cache is a module-level `Map<SUPABASE_URL, …>` — multi-tenant-safe even though we only run one environment today.

**Kid-miss refetch + short negative TTL are the guardrails.**
- Supabase rotates signing keys without coordination with this worker. A stale cache means fresh tokens signed with a new `kid` would 401 for up to 10 minutes after every rotation. The fix is to bypass-cache refetch on unknown-kid, once. If the refetched JWKS still doesn't contain the kid, it's a genuine auth failure.
- If the JWKS response parses but yields zero importable keys (e.g. Supabase briefly ships a format we don't support), caching an empty `Map` for the full TTL would silently fail every request for 10 minutes. A negative TTL of 30 seconds caps that failure window so the next request attempts a refresh.

**Fail-closed, but not fail-confused.**
- All verification failures default to `throw` → `401 Invalid token` — the fail-closed direction is security-correct.
- Upstream failures (`JwksUnavailableError` — network error, timeout, 5xx, unparseable body) are explicitly classified as 503. An unavailable auth provider is not an invalid token. Retry logic at the client and log analysis in ops both depend on this distinction.
- `AbortSignal.timeout(5000)` on the JWKS fetch prevents a slow upstream from blocking the worker until its CPU limit.

**Generic error body + correlation ID.**
- `{ error: 'Invalid token', correlationId }` is what the client sees. Verification detail ("JWT iss mismatch", "No JWKS key matching kid=…") goes to `console.error` alongside the same correlation ID. Support can trace a user report back to the log line without the client surface exposing internal reasoning.
- Addresses part of TD-009 (the pre-existing pattern of leaking internal `detail` strings in error responses) for this endpoint.

**Claim validation: `exp` + `iss`.**
- `exp` is now required, not optional. Supabase always sets it; rejecting tokens without `exp` is cheap defence-in-depth against a future change.
- `iss` must equal `{SUPABASE_URL}/auth/v1`. This is belt-and-braces — the `kid` namespace already bounds cross-project acceptance — but cheap and standard.

## Trade-offs accepted

**Module-level cache is stateful.**
- Tests need a `__resetJwksCache()` export to avoid bleed between runs. The alternative (dependency-injected cache / Verifier class) is cleaner in principle but adds wiring for negligible benefit at the current n=1 verifier. Revisit if a second worker adopts the same verification code.

**10-minute primary TTL may delay legitimate rotation awareness.**
- If Supabase pre-announces rotation, we'd want to pre-fetch. Today we rely on the kid-miss refetch — which costs one extra round-trip on the first post-rotation request per isolate. Acceptable given rotations are infrequent.

**HS256 path kept alive.**
- Small amount of dead code on projects that have moved to asymmetric. Deliberate — see alternatives. Plan is to delete after production has run on asymmetric for a bounded period with no incidents.

**No public-key pinning.**
- If the Supabase JWKS endpoint were compromised or spoofed, we'd trust the served public keys. This is standard behaviour for JWKS-based verification and the threat model (DNS / TLS compromise of Supabase) is out of scope — an attacker with that level of access has already defeated the entire app.

## Implications

**This enables:**
- Modern Supabase projects "just work" without Wrangler secret management for the JWT secret.
- Supabase signing-key rotation no longer causes an outage.
- Clean 401 / 503 separation for observability and client retry logic.
- Future workers that need to verify Supabase JWTs can reuse this pattern (or, if a second consumer appears, extract to a shared module).

**This prevents:**
- The "silent 401 + SVG fallback" class of regressions from being invisible — once the follow-up UX work in issue #49 lands, correlation IDs in error bodies mean support can correlate a user complaint to a specific log line.

## References

- Code: `workers/generate-creature/index.ts` — `verifyJWT`, `fetchJwks`, `JwksUnavailableError`
- Tests: `workers/generate-creature/index.test.ts` — 25 tests covering HS256 and ES256 paths, kid-rotation refetch, empty-map negative TTL, 503-vs-401 taxonomy, `exp`/`iss` enforcement, correlation ID surface
- Resolves: TD-007 (JWT `alg` header not validated — now whitelisted and dispatched)
- Partially addresses: #43 (ES256 verification was the root cause of line-art specimens)
- Follow-ups:
  - #48 — `creatures.qr_hash` 8-vs-16-char mismatch (catalogue visibility symptom from #43)
  - #49 — Silent 401/error swallowing in the scan flow (observability gap that hid the original bug)
