# Environment & secrets setup

**When to read this:** Setting up local development, configuring secrets, or deploying to production.

---

## Overview

QRious Specimens uses two separate runtime environments:

| Environment | File | Used for |
|---|---|---|
| Local dev (frontend) | `.dev.vars` | Vite dev server — Supabase URL + anon key only |
| Local dev (Workers) | `.dev.vars` | Wrangler dev — all secrets including API keys |
| Production (Cloudflare) | Wrangler secrets | Set via `wrangler secret put` |
| Production (Supabase) | Supabase dashboard | Auth redirect URLs, email config |

**Security reminder:** Never commit `.dev.vars` or any file containing real secrets. It is in `.gitignore`.

---

## Frontend environment variables (Vite)

These are prefixed `VITE_` and are safe to embed in the browser bundle. They are *not* secrets.

### `VITE_SUPABASE_URL`
The URL of the Supabase project.

**How to obtain:** Supabase dashboard → Project Settings → API → Project URL

**Format:** `https://[project-ref].supabase.co`

**Local setup:**
```bash
# .dev.vars
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
```

---

### `VITE_SUPABASE_ANON_KEY`
The public anonymous key for the Supabase project. Safe to expose in the browser — Row Level Security enforces access control.

**How to obtain:** Supabase dashboard → Project Settings → API → `anon` `public` key

**Local setup:**
```bash
# .dev.vars
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Cloudflare Worker secrets

These are server-side only and must never appear in the frontend bundle or be committed to git.

### `SUPABASE_URL`
Same as `VITE_SUPABASE_URL` — needed by Workers to call Supabase APIs.

**Production setup:**
```bash
wrangler secret put SUPABASE_URL
```

---

### `SUPABASE_SERVICE_ROLE_KEY`
The Supabase service role key — bypasses RLS. Used by Workers only for privileged operations (writing to `species_images`, calling admin RPCs).

**How to obtain:** Supabase dashboard → Project Settings → API → `service_role` `secret` key

**⚠️ Never expose this in the frontend or commit to git.**

**Production setup:**
```bash
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

---

### `SUPABASE_JWT_SECRET` *(legacy-only, optional)*
Worker JWT verification now auto-selects between asymmetric and legacy HS256 based on the token's `alg` header:
- **Asymmetric (ES256 / RS256)** — default for modern Supabase projects. Public keys are fetched from `{SUPABASE_URL}/auth/v1/.well-known/jwks.json` and cached for 10 minutes per isolate. No secret to store.
- **HS256 (legacy)** — only used when the Supabase project still signs with a symmetric secret. In that case, set `SUPABASE_JWT_SECRET` via `wrangler secret put SUPABASE_JWT_SECRET` using the value from Project Settings → JWT Keys → Legacy JWT secret.

Check which signing mode is active: Supabase dashboard → Project Settings → JWT Keys. If a "Current signing key" of type EC (P-256) or RSA is listed, you are on asymmetric and do not need this secret.

---

### `GEMINI_API_KEY`
Google Gemini API key for AI creature illustration generation.

**How to obtain:** [Google AI Studio](https://aistudio.google.com) → API Keys → Create API key

**Cost:** Gemini has a free tier; monitor usage in Google AI Studio console.

**Production setup:**
```bash
wrangler secret put GEMINI_API_KEY
```

---

### `ANTHROPIC_API_KEY`
Anthropic API key for Claude field notes generation.

**How to obtain:** Anthropic Console → API Keys

**Model used:** `claude-haiku-4-5-20251001` (fast and cheap for constrained creative writing)

**Production setup:**
```bash
wrangler secret put ANTHROPIC_API_KEY
```

---

### Cloudflare Images (`CF_ACCOUNT_ID`, `CF_IMAGES_TOKEN`, `CF_IMAGES_DELIVERY_HASH`)
Specimen illustrations are stored in Cloudflare Images (see [ADR 2026-04-20](./decisions/2026-04-20-cloudflare-images-over-r2.md)).

**`CF_ACCOUNT_ID`** (secret) — Cloudflare dashboard → right sidebar → Account ID.
**`CF_IMAGES_TOKEN`** (secret) — My Profile → API Tokens → create with `Images:Edit` permission.
**`CF_IMAGES_DELIVERY_HASH`** (not secret, in `wrangler.toml [vars]`) — Cloudflare dashboard → Images → Overview → "Your images are served from `https://imagedelivery.net/<HASH>/...`".

**Named variants required in the CF Images dashboard:** `qriousoriginal`, `qrious512`, `qrious256`. Variant names must be alphanumeric (no dashes or underscores) because CF validates them against `/^[a-z0-9]+$/`.

**Production setup:**
```bash
wrangler secret put CF_ACCOUNT_ID
wrangler secret put CF_IMAGES_TOKEN
# CF_IMAGES_DELIVERY_HASH is in wrangler.toml [vars]
```

---

## Environment file templates

### `.dev.vars` template

Copy this to `.dev.vars` and fill in real values:

```bash
# QRious Specimens — local development environment
# Copy to .dev.vars and fill in real values
# NEVER commit this file

# Supabase (public — safe in browser)
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Supabase (secret — Workers only)
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
# SUPABASE_JWT_SECRET — only needed for legacy HS256-signing projects; omit otherwise

# AI APIs (secret — Workers only)
GEMINI_API_KEY=AIza...
ANTHROPIC_API_KEY=sk-ant-...

# Cloudflare Images (secret — Workers only)
CF_ACCOUNT_ID=your-cf-account-id
CF_IMAGES_TOKEN=cf-images-edit-token
# CF_IMAGES_DELIVERY_HASH is NOT a secret — set in wrangler.toml [vars]
```

---

## Supabase dashboard configuration

### Auth → URL Configuration
These must be set before magic link auth works:

| Setting | Value |
|---|---|
| Site URL | `https://qrious.hultberg.org` |
| Redirect URLs (allowlist) | `https://qrious.hultberg.org/**` |
| Redirect URLs (allowlist) | `http://localhost:5173/**` |

### Auth → Email Templates (optional)
The magic link emails can be customised with Victorian styling. The default Supabase template is functional but plain.

---

## Cloudflare configuration

### DNS (Cloudflare dashboard)
```
qrious.hultberg.org  CNAME  [workers-subdomain].workers.dev
```
Or via Workers Routes: assign `qrious.hultberg.org/*` to the `qrious-specimens` Worker.

### Cloudflare Images
- Custom image IDs: each species uses its `qr_hash` as the image ID (idempotent uploads)
- Named variants required (alphanumeric only — CF validates against `/^[a-z0-9]+$/`):
  - `qriousoriginal` — no resize
  - `qrious512` — width 512px
  - `qrious256` — width 256px
- Delivery URL shape: `https://imagedelivery.net/{CF_IMAGES_DELIVERY_HASH}/{qr_hash}/{variant}`
- Historical: R2 bucket `qrious-specimens-images` stored images before 2026-04-20. Migrated to CF Images via `scripts/backfill-cf-images.ts`; bucket retired.

---

## Production deployment

Deployment is automatic on push to `main` via `.github/workflows/deploy.yml` — GitHub Actions runs tests, build, and `wrangler deploy` using the `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repo secrets. **Do not run `wrangler deploy` locally as part of normal flow.** Monitor the Actions run after a merge; smoke-test once it's green.

### Verifying secrets are configured

If a new secret is introduced, it must be set in two places: the Worker (via `wrangler secret put`) and — if referenced in build — the GitHub repo secrets (for CI).

```bash
# List current Worker secrets
wrangler secret list

# Expected Worker secrets:
# SUPABASE_URL
# SUPABASE_SERVICE_ROLE_KEY
# SUPABASE_JWT_SECRET   (only required on legacy HS256 projects — see above)
# GEMINI_API_KEY
# ANTHROPIC_API_KEY
# CF_ACCOUNT_ID
# CF_IMAGES_TOKEN
# RESEND_API_KEY

# Also verify wrangler.toml [vars]:
# CF_IMAGES_DELIVERY_HASH  — not a secret, but required

# GitHub repo secrets used by the Actions deploy job:
# CLOUDFLARE_API_TOKEN
# CLOUDFLARE_ACCOUNT_ID
# VITE_SUPABASE_URL
# VITE_SUPABASE_ANON_KEY
```

### Emergency manual deploy

In the rare case CI is down and a deploy is urgent:
```bash
bun run deploy   # bun run build && wrangler deploy
```
Use only as a fallback. Normal flow is always push to main.

---

## Third-party service summary

| Service | Purpose | Dashboard |
|---|---|---|
| Supabase | PostgreSQL + RLS + magic link auth | supabase.com |
| Cloudflare Workers | SPA hosting + AI Worker API routes | dash.cloudflare.com |
| Cloudflare Images | Creature image storage (qriousoriginal, qrious512, qrious256 variants) | dash.cloudflare.com → Images |
| Google Gemini | Victorian naturalist illustration generation | aistudio.google.com |
| Anthropic | Field notes (Claude Haiku) | console.anthropic.com |
| Resend (optional) | Custom email domain if needed | resend.com (hultberg.org configured) |

---

**Remember to update this document** whenever you add, change, or remove environment variables.
