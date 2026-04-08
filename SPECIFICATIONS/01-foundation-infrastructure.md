# Phase 1: Foundation & infrastructure

## Phase overview

**Phase number:** 1
**Phase name:** Foundation & infrastructure
**Dependencies:** None — starting phase

**Brief description:**
Establishes every piece of infrastructure the project needs before a single line of application code is written. This phase is complete when we have a working Supabase project with schema and seed data, a deployed (though empty) Cloudflare Workers SPA scaffold, an R2 bucket containing all existing creature images, and a documented, version-controlled project that any future phase can build on.

---

## Scope and deliverables

### In scope
- [ ] Git repository initialised, `.gitignore` configured, initial commit pushed to GitHub
- [ ] Supabase project created (manually via dashboard)
- [ ] All schema migrations run against the new Supabase project (32+ migrations from `downloads-claude-ship/qrious-project-code-2e8ffbe/supabase/migrations/`)
- [ ] Database seed data imported from `downloads-claude-ship/qrious-database-2026-04-06.json` (16 creatures, 18 species, badges, profiles, activity feed, etc.)
- [ ] Cloudflare R2 bucket created (`qrious-specimens-images`)
- [ ] All 54 existing creature images uploaded to R2 (original, 512, 256 variants)
- [ ] Cloudflare Workers project scaffolded with Wrangler (`wrangler.toml`, static asset hosting configured)
- [ ] Vite + React + TypeScript project scaffolded (`src/` structure)
- [ ] Tailwind CSS and shadcn/ui installed and configured
- [ ] TanStack React Query and Sonner installed
- [ ] Environment variables documented and `.dev.vars.template` created
- [ ] Project deployed to Cloudflare Workers at `qrious.hultberg.org` (even if just a placeholder page)
- [ ] `REFERENCE/environment-setup.md` updated with all actual variables
- [ ] Root `CLAUDE.md` and `SPECIFICATIONS/CLAUDE.md` updated and template warnings removed

### Out of scope
- Any authentication logic
- Any UI beyond a bare scaffold
- AI generation Workers (Phase 4)
- Application features of any kind

### Acceptance criteria
- [ ] `git log` shows project history; repo pushed to GitHub
- [ ] Supabase dashboard shows all tables with correct row counts matching the imported data
- [ ] R2 bucket contains 54 image files organised as `species/original/`, `species/512/`, `species/256/`
- [ ] `wrangler deploy` succeeds and `https://qrious.hultberg.org` returns a page
- [ ] `bun run dev` starts a local Vite dev server without errors
- [ ] `bun run typecheck` passes with no TypeScript errors
- [ ] `.dev.vars.template` lists all required variables with descriptions

---

## Technical approach

### Architecture decisions

**Monorepo structure: SPA + Workers in one repository**
- Choice: Single repo with `src/` for the Vite SPA and `workers/` for Cloudflare Worker API functions
- Rationale: Keeps deployment simple; Wrangler can handle both static asset serving and Worker routes from one `wrangler.toml`
- Alternatives considered: Separate repos for frontend and Workers — rejected as unnecessary overhead for this project size

**Cloudflare Workers static asset hosting (not Pages)**
- Choice: Deploy the Vite SPA via Cloudflare Workers with `assets` directory config in `wrangler.toml`
- Rationale: Cloudflare is unifying Pages into Workers; this is the forward-looking approach. SPA routing (all unmatched paths → `index.html`) is trivially configurable.
- Alternatives considered: Cloudflare Pages — being phased out, same underlying infrastructure anyway

**R2 for image storage**
- Choice: Cloudflare R2 bucket for all creature images
- Rationale: Avoids Supabase Storage costs/limits; R2 pricing is near-zero at this scale (first 10GB free); images served from same Cloudflare network as the SPA
- Alternatives considered: Supabase Storage — fine technically but adds cost unpredictability

**Supabase for database and auth only**
- Choice: Supabase handles PostgreSQL + Row Level Security + magic link email auth
- Rationale: Clean separation of concerns; Supabase's managed Postgres with RLS is excellent; magic link auth works perfectly once we control the redirect URL
- Alternatives considered: Moving DB to Cloudflare D1 — rejected, D1 is SQLite and we have a non-trivial PL/pgSQL schema with RPCs

### Project structure

```
qrious-specimens/
├── src/                          # Vite SPA (React + TypeScript)
│   ├── main.tsx
│   ├── App.tsx
│   ├── components/
│   ├── hooks/
│   ├── lib/
│   │   ├── supabase.ts           # Supabase client
│   │   └── queryClient.ts        # TanStack React Query client
│   ├── pages/
│   └── types/
├── workers/                      # Cloudflare Worker API functions
│   ├── generate-creature/
│   └── generate-field-notes/
├── public/                       # Static assets
├── supabase/
│   └── migrations/               # Copied from downloads, run once
├── scripts/
│   └── import-data.ts            # One-time data import script
├── .dev.vars.template            # Environment variable template
├── .dev.vars                     # Local secrets (gitignored)
├── wrangler.toml                 # Cloudflare Workers + static assets config
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

### Wrangler configuration

```toml
name = "qrious-specimens"
compatibility_date = "2024-01-01"

[assets]
directory = "./dist"
html_handling = "single-page-application"

[[r2_buckets]]
binding = "IMAGES"
bucket_name = "qrious-specimens-images"
```

### Database migrations

Copy migrations from `downloads-claude-ship/qrious-project-code-2e8ffbe/supabase/migrations/` and run via Supabase dashboard SQL editor or `supabase db push` (Supabase CLI). Run in chronological order (files are named by timestamp).

### Data import strategy

The `downloads-claude-ship/qrious-database-2026-04-06.json` contains all table data. Write a one-time import script (`scripts/import-data.ts`) that:
1. Reads the JSON
2. Inserts records into each table using the Supabase service role client
3. Handles foreign key ordering (badge_definitions before explorer_badges, etc.)
4. Skips auth.users (Supabase Auth manages those — Magnus's user will be recreated via sign-in)

For images: upload the 54 files from `downloads-claude-ship/qrious-images-2026-04-06/` to R2, maintaining the directory structure (`species/original/`, `species/512/`, `species/256/`). Update `species_images` URLs after upload to point to R2 public URLs instead of the original Supabase Storage URLs.

---

## Testing strategy

### What to test in this phase
This phase is infrastructure — there's little application logic to unit test. Focus on:
- Verifying the Supabase connection works (query a table, get expected rows)
- Verifying R2 bucket is accessible and images are retrievable
- Verifying the Vite dev server starts cleanly
- Verifying TypeScript compiles without errors

### Manual testing checklist
- [ ] `bun run dev` — dev server starts, browser shows scaffold page
- [ ] Supabase table editor — all tables visible, row counts correct
- [ ] R2 bucket browser — 54 files visible in correct directory structure
- [ ] `https://qrious.hultberg.org` — deployed page loads
- [ ] `bun run typecheck` — zero errors

---

## Pre-commit checklist

- [ ] `bun run typecheck` passes
- [ ] No `.dev.vars` or secrets committed
- [ ] `.gitignore` includes `.dev.vars`, `dist/`, `node_modules/`, `.wrangler/`
- [ ] `.dev.vars.template` committed and complete
- [ ] `REFERENCE/environment-setup.md` updated with all variables

---

## PR workflow

### Branch naming
```
feature/phase-1-foundation
```

### Review requirements
- Use `/review-pr-team` — this phase sets the entire project's structural foundation and includes database schema decisions

### Deployment steps
1. Run Supabase migrations (SQL editor or CLI)
2. Run data import script
3. Upload images to R2 (script or manual via dashboard)
4. Update `species_images` URLs to R2 URLs
5. `wrangler deploy`
6. Verify `https://qrious.hultberg.org` loads

---

## Edge cases and considerations

### Known risks
- **Migration ordering:** The 32+ migration files must be run in timestamp order. If run out of order, foreign key constraints will fail. Solution: sort by filename before running.
- **Auth user recreation:** The imported `profiles` data references a `user_id` from the original Supabase project. When Magnus signs in to the new project, a new UUID will be generated. The import script must handle this by either skipping profile data and recreating it post-sign-in, or by inserting with a known placeholder UUID that gets updated.
- **Image URL migration:** `species_images.image_url` currently points to the original Supabase Storage URLs. These must be updated to R2 URLs as part of import. Existing images won't load until this is done.

### Security considerations
- R2 bucket should be configured for public read access (creature images are public)
- Supabase service role key used only in the import script, never in the SPA
- All Supabase RLS policies carry over unchanged from the original migrations

---

## Related documentation

- [Master specification](./ORIGINAL_IDEA/SPEC-DOWNLOADED-ORIGINAL-IMPLEMENTATION.md) — Original implementation spec
- [environment-setup.md](../REFERENCE/environment-setup.md) — All environment variables
- [Phase 2](./02-auth-design-system.md) — Next phase
