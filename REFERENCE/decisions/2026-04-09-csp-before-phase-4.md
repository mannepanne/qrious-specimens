# ADR: Content Security Policy must be enforced before Phase 4 merges

**Date:** 2026-04-09
**Status:** Active
**Supersedes:** N/A

---

## Decision

A Content Security Policy (CSP) header must be added to the Cloudflare Worker and enforced before Phase 4 (`04-ai-generation-workers.md`) merges to main. The CSP will be landed in report-only mode during Phase 3 and switched to enforcement before Phase 4 opens.

## Context

Supabase Auth stores session tokens in `localStorage` (the standard Supabase SPA pattern). This means any XSS vulnerability — anywhere in the app — allows a script to read `localStorage`, exfiltrate the access and refresh tokens, and gain a persistent authenticated session as the victim user.

Phase 4 introduces Gemini-generated creature illustrations and Claude-generated field notes, both of which are AI outputs rendered to the DOM. AI outputs are a credible XSS vector if rendering is not carefully controlled (e.g. markdown rendering, `dangerouslySetInnerHTML`, or future prompt-injection attacks that sneak markup into creature descriptions).

A CSP is the cheapest available mitigation and substantially raises the bar for any XSS to become a session takeover. Three independent reviewers (Security Specialist, Product Manager, Senior Architect) flagged this in a Phase 2 review and reached consensus on the timing.

## Why not Phase 2?

Phase 2 renders no user-supplied content and no AI-generated content. The XSS attack surface is minimal. Adding CSP in Phase 2 is defence-in-depth but not a defect fix, and Phase 4 needs a full deploy cycle in report-only mode first (see below). Adding CSP in Phase 2 would start that clock too early.

## Why not alongside Phase 4?

Phase 4 is the largest PR in the project — Gemini integration, Claude integration, R2 image uploads, Worker API routes, and the creature discovery flow. CSP violations surface at runtime, not at build time. Debugging CSP violations and new feature bugs simultaneously creates pressure to loosen the CSP (`unsafe-inline`, wildcard `connect-src`) to unblock the feature. That is how SPAs end up with useless CSPs.

The correct sequencing: **Phase 3 PR (report-only) → Phase 4 blocked until enforcement confirmed.**

## Delivery mechanism

CSP belongs in the **Cloudflare Worker fetch handler**, not a `_headers` file or `<meta http-equiv>` tag.

Reason: wrangler's `[assets]` block serves static files directly from the asset store, bypassing the Worker. But Phase 4 adds Worker API routes (`/api/generate`, `/api/field-notes`, etc.) that also need security headers. A `_headers` file only covers asset responses; the Worker covers everything. A shared `applySecurityHeaders(response: Response)` helper in `src/worker/securityHeaders.ts` applied to all Worker responses gives us a single source of truth.

> **Note:** This requires enabling `run_worker_first = true` in `wrangler.toml` for HTML requests so the Worker can add headers to `index.html`. This config change should land in the Phase 3 CSP PR.

## Proposed baseline CSP

```
Content-Security-Policy: default-src 'self'; script-src 'self'; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.r2.cloudflarestorage.com; img-src 'self' data: https://*.r2.cloudflarestorage.com; object-src 'none'; frame-ancestors 'none'; base-uri 'self'
```

Notes:
- `connect-src` includes Supabase REST + Auth + Realtime (WebSocket), and R2 for image fetching
- Phase 4 Worker API routes are same-origin so covered by `'self'`
- Gemini and Claude API calls are made from the Worker (server-side), not from the browser — no `connect-src` changes needed for Phase 4
- `frame-ancestors 'none'` prevents clickjacking
- `object-src 'none'` blocks Flash, PDF embeds, and similar legacy vectors

## Sequencing

| Phase | CSP action |
|---|---|
| Phase 2 (this PR) | CSP ADR written; no header yet |
| Phase 3 | CSP PR: report-only (`Content-Security-Policy-Report-Only`), `run_worker_first`, `applySecurityHeaders` helper |
| Phase 3 → 4 | Monitor report-only violations for at least one deploy cycle |
| Phase 4 | **Hard block: CSP must be switched to enforcement before Phase 4 branch merges** |

## Trade-offs accepted

**Report-only window:** There is a window between Phase 3 CSP PR and Phase 4 enforcement where XSS could succeed without being blocked (though violations will be reported). Accepted — this window is bounded and shorter than the current state (no CSP at all).

**`run_worker_first` overhead:** Routing all HTML requests through the Worker adds a small latency for the initial page load. Acceptable for an SPA where the Worker is already running.

## Implications

**Phase 3 PR must include:** `run_worker_first = true`, `applySecurityHeaders` helper, report-only CSP header. Phase 3 merges blocked if this PR is not included.

**Phase 4 checklist must include:** "Switch CSP from report-only to enforcement". This item must be checked before Phase 4 opens a PR.

**Future phases:** Any new `connect-src` target (new external API, CDN) requires a CSP update PR. The `applySecurityHeaders` helper is the single place to update.

---

## References

- `src/worker.ts` — current Worker (Phase 4 will expand this significantly)
- `wrangler.toml` — `[assets]` config; needs `run_worker_first` in Phase 3
- Phase 4 spec: `SPECIFICATIONS/04-ai-generation-workers.md`
- Security review findings: PR #1 comment, security-reviewer W2
