# Security headers

How QRious Specimens hardens HTTP responses, and why the wiring is the way it is.

## What is set, and where

| Header | Value | Set by |
|--------|-------|--------|
| `Content-Security-Policy` | enforcing policy (see below) | Worker (`workers/shared/securityHeaders.ts`) |
| `X-Content-Type-Options` | `nosniff` | Worker |
| `X-Frame-Options` | `DENY` | Worker |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Worker |
| `Permissions-Policy` | `camera=(self), microphone=(), geolocation=()` | Worker |
| `Strict-Transport-Security` | `max-age=…; includeSubDomains` | **Cloudflare edge** (dashboard) |

The Worker headers live in one place — `withSecurityHeaders()` in `workers/shared/securityHeaders.ts` — and are applied to **every** response by `src/worker.ts`.

## HSTS is owned by the edge, not the code

`Strict-Transport-Security` is injected by Cloudflare at the edge (dashboard → SSL/TLS → Edge Certificates → HSTS), *after* the Worker runs. The Worker deliberately does **not** set it: doing so would send the browser two conflicting `Strict-Transport-Security` headers. To change `max-age`, `includeSubDomains`, or `preload`, use the dashboard — there is nothing to change in this repo.

`preload` is a one-way door (slow to remove from the browser preload list) and applies to all `*.hultberg.org` subdomains. Do not enable it casually.

## `run_worker_first` is load-bearing

By default, Cloudflare Workers static assets are served **directly by the edge, bypassing the Worker**, whenever a request matches a real file (`/`, `/assets/*.js`, `/assets/*.css`, `/favicon.svg`). The Worker only runs for paths with no matching asset (the SPA fallback) and the `/api/*` routes.

That means worker-level header wrapping alone leaves the actual documents a browser fetches — including the `index.html` that `securityheaders.com` scans — without a CSP. The fix is `run_worker_first = true` under `[assets]` in `wrangler.toml`: it forces every request through the Worker, which then serves assets via `env.ASSETS.fetch()` and wraps the response. The trade-off is that each asset request becomes a Worker invocation rather than free edge serving — negligible at this app's traffic. If that ever matters, scope `run_worker_first` to an array of HTML globs instead of `true`.

This was chosen over a `public/_headers` file to keep a single, unit-tested source of truth that also covers the `/api/*` JSON responses (where `nosniff` matters).

## The Content-Security-Policy

The policy is grounded in the resources the app actually loads in the browser:

- `script-src` — own Vite bundle (`'self'`) plus the Cloudflare Insights beacon. No `'unsafe-inline'`: the production build emits no inline scripts.
- `style-src` — `'self' 'unsafe-inline'` (Radix/Tailwind inject inline `style` attributes) plus `https://fonts.googleapis.com` for the Google Fonts stylesheet `@import` in `src/index.css`.
- `font-src` — `https://fonts.gstatic.com` (EB Garamond, JetBrains Mono).
- `img-src` — `'self' data: blob:` plus `https://imagedelivery.net` (Cloudflare Images). `blob:`/`data:` cover the favicon and the html5-qrcode canvas frames.
- `connect-src` — `'self'`, the Supabase project over `https://*.supabase.co` **and** `wss://*.supabase.co` (supabase-js opens a realtime websocket), and the Cloudflare Insights beacon endpoint.
- `frame-ancestors 'none'`, `base-uri 'self'`, `object-src 'none'`, `form-action 'self'` — lock down the dangerous directives.

Server-side hosts the Worker talks to (Gemini, Anthropic, Resend, the Cloudflare API) are intentionally **absent**: CSP is browser-enforced and those calls never originate from the page.

`Permissions-Policy` grants `camera=(self)` on purpose — the QR scanner (html5-qrcode) needs camera access on the app's own origin. A blanket `camera=()` would silently break the core scan flow.

## Verifying after a change

CSP behaviour must be checked against a **production build served through the Worker**, not `vite dev` (the dev server and built output differ exactly where CSP breaks).

```bash
bun run build
npx wrangler dev --local            # serves dist through the Worker
curl -sI http://localhost:8787/ | grep -i content-security-policy   # header present on the document
```

Then load the page in a browser and confirm there are **no CSP violations** in the console. The flows worth walking, since each exercises a different directive:

- magic-link sign-in (the auth round-trip → `connect-src` Supabase)
- open a specimen with a real illustration (→ `img-src` `imagedelivery.net`)
- start a QR scan (→ `Permissions-Policy camera=(self)` actually opens the camera)
- a full discovery (scan → generate → cabinet)

The public grade can only be confirmed after deploy via `securityheaders.com` (it blocks automated fetches).
