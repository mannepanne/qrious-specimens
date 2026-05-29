# ADR: Security response headers via a Worker-wide wrapper, enforcing CSP shipped directly

**Date:** 2026-05-29
**Status:** Active
**Supersedes:** [2026-04-09-csp-before-phase-4.md](./2026-04-09-csp-before-phase-4.md)

---

## Decision

Apply a Content-Security-Policy plus four hardening headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`) to **every** Worker response via a single `withSecurityHeaders()` helper in `workers/shared/securityHeaders.ts`, with `run_worker_first = true` so static assets flow through it too. The CSP ships **enforcing immediately**, not report-only-first. HSTS stays owned by the Cloudflare edge.

## Context

`securityheaders.com` scored `qrious.hultberg.org` a **D** — five response headers missing. The predecessor ADR (2026-04-09) had already specified the *mechanism* (Worker wrap + `run_worker_first` + shared helper, chosen because `[assets]` serves static files directly and bypasses the Worker) and a *rollout*: land CSP report-only in Phase 3, switch to enforcement before Phase 4.

That rollout never happened. All nine phases shipped to main and the app launched with **no CSP at all**, so the predecessor ADR's phase gate is moot and its baseline is stale. This ADR records what was actually built and why the rollout shape changed.

## Alternatives considered

- **`public/_headers` file:** declarative and free (no Worker invocation), but untestable in Vitest, and covers only asset responses — not the `/api/*` JSON where `nosniff` matters. Rejected for the split source of truth.
- **Report-only CSP first, then enforce (the predecessor's plan):** the safe two-step, but report-only does not count toward the securityheaders.com grade, and — decisively — we have no `report-to`/`report-uri` collection endpoint, so report-only would log violations only to each user's browser console, giving the operator zero signal. It would add a deploy cycle for no observable benefit. Rejected.
- **Chosen — enforcing CSP through the Worker wrapper:** single tested source of truth, covers API + assets, scores the grade immediately. The residual risk (a mis-tuned directive breaks a real flow) was bought down by verifying against a production build in headless Chrome and by source-inspecting the QR scanner (html5-qrcode is main-thread, no worker/wasm), with a post-deploy smoke test as the final gate.

## Reasoning

The CSP is grounded in the resources the app actually loads: own bundle + Cloudflare Insights beacon (`script-src`, no `'unsafe-inline'`), Google Fonts (`style-src`/`font-src`, with `'unsafe-inline'` for Radix/Tailwind inline style attributes), Cloudflare Images + `data:`/`blob:` (`img-src`), and Supabase over `https`/`wss` plus the beacon endpoint (`connect-src`). Server-side hosts (Gemini, Anthropic, Resend) are absent — CSP is browser-enforced.

`Permissions-Policy` grants `camera=(self)` deliberately: the QR scanner needs the camera on the app's own origin; a blanket `camera=()` would break the core scan flow.

HSTS is left to the edge (SSL/TLS → HSTS) so the browser never receives two conflicting `Strict-Transport-Security` headers; raising `max-age` for an A+ is a dashboard action, not code.

## Trade-offs accepted

- **`run_worker_first = true` makes every asset request a billable Worker invocation** (vs free edge serving) and widens the availability blast radius — a throw in the Worker would otherwise blank the whole site. Mitigated with a try/catch in `src/worker.ts` that falls back to serving the asset directly. Negligible cost at this traffic; escape hatch is to scope `run_worker_first` to HTML globs.
- **Enforcing-first on a live app** means a wrong directive hits real users rather than a console-only report. Accepted given the verification above, the absence of a report collection endpoint, and Cloudflare's instant rollback.

## Implications

- `workers/shared/securityHeaders.ts` is the single source of truth for these headers; the CSP constant is guarded by tests so a careless edit can't silently regress the allowlist, the `camera=(self)` carve-out, or the edge-owned-HSTS invariant.
- Operations reference: [`REFERENCE/security-headers.md`](../security-headers.md).
- If Supabase Realtime channels are ever adopted, add `worker-src 'self' blob:` (its heartbeat worker is a `blob:` worker; not spawned today).

---

## References

- Supersedes: [2026-04-09 — CSP before Phase 4](./2026-04-09-csp-before-phase-4.md)
- Related: [2026-04-20 — Cloudflare Images over R2](./2026-04-20-cloudflare-images-over-r2.md) (corrects the predecessor's `r2.cloudflarestorage.com` image origin to `imagedelivery.net`)
- Operations reference: [`REFERENCE/security-headers.md`](../security-headers.md)
