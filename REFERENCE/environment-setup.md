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

### `SUPABASE_JWT_SECRET`
Used by Workers to verify Supabase JWTs (authenticate incoming requests).

**How to obtain:** Supabase dashboard → Project Settings → API → JWT Settings → JWT Secret

**Production setup:**
```bash
wrangler secret put SUPABASE_JWT_SECRET
```

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

### `PUBLIC_R2_URL`
The public base URL for the R2 bucket — prepended to all creature image paths.

**How to obtain:** Cloudflare dashboard → R2 → `qrious-specimens-images` bucket → Settings → Public access → Custom domain or `r2.dev` subdomain.

**Format:** `https://pub-xxxxxxxx.r2.dev` (or a custom domain like `https://images.qrious.hultberg.org`)

**Note:** This is a `[vars]` entry in `wrangler.toml`, not a secret — it is not sensitive. Update the placeholder value (`pub-PLACEHOLDER`) in `wrangler.toml` before deploying.

**Production setup:**
```toml
# wrangler.toml
[vars]
PUBLIC_R2_URL = "https://pub-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.r2.dev"
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
SUPABASE_JWT_SECRET=your-jwt-secret-here

# AI APIs (secret — Workers only)
GEMINI_API_KEY=AIza...
ANTHROPIC_API_KEY=sk-ant-...

# R2 public URL (not a secret — set in wrangler.toml [vars], not here)
# PUBLIC_R2_URL=https://pub-xxxxxxxx.r2.dev
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

### R2 bucket
- Bucket name: `qrious-specimens-images`
- Public access: enabled (creature images are public)
- Directory structure:
  - `species/original/{hash}.png`
  - `species/512/{hash}.jpg`
  - `species/256/{hash}.jpg`

---

## Production deployment checklist

Before deploying, verify all secrets are set:

```bash
# List current Worker secrets
wrangler secret list

# Expected secrets:
# SUPABASE_URL
# SUPABASE_SERVICE_ROLE_KEY
# SUPABASE_JWT_SECRET
# GEMINI_API_KEY
# ANTHROPIC_API_KEY

# Also verify wrangler.toml [vars]:
# PUBLIC_R2_URL  — must be updated from placeholder before deploying
```

Full deployment:
```bash
bun run build           # Vite production build → dist/
wrangler deploy         # Deploy SPA + Workers to Cloudflare
```

---

## Third-party service summary

| Service | Purpose | Dashboard |
|---|---|---|
| Supabase | PostgreSQL + RLS + magic link auth | supabase.com |
| Cloudflare Workers | SPA hosting + AI Worker API routes | dash.cloudflare.com |
| Cloudflare R2 | Creature image storage | dash.cloudflare.com → R2 |
| Google Gemini | Victorian naturalist illustration generation | aistudio.google.com |
| Anthropic | Field notes (Claude Haiku) | console.anthropic.com |
| Resend (optional) | Custom email domain if needed | resend.com (hultberg.org configured) |

---

**Remember to update this document** whenever you add, change, or remove environment variables.
