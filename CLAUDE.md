# CLAUDE.md

Navigation index and quick reference for working with this project.

---

## Rules of engagement

Collaboration principles and ways of working: @.claude/CLAUDE.md
When asked to remember anything, add project memory in this CLAUDE.md (project root), not @.claude/CLAUDE.md.

## Project overview

**QRious Specimens** — A digital cabinet of curiosities where users scan real-world QR codes to discover procedurally generated fantasy creatures, illustrated in Victorian naturalist style and catalogued in a shared community gazette.

**Named in the spirit of Mary Anning** (1799–1847), the fossil hunter of Lyme Regis who spent decades uncovering species the learned world hadn't thought to look for. Subtle references to her life and work are woven throughout the app.

**Core workflow:**
1. User scans any QR code in the real world
2. The code is deterministically transformed into a unique creature species with full taxonomy and anatomy
3. A cinematic hatching animation plays while a Victorian naturalist illustration is generated via Gemini AI
4. Claude writes field notes in the voice of a Victorian naturalist
5. The specimen is added to the user's personal cabinet and logged in the public Gazette

**Full specification:** [SPECIFICATIONS/ORIGINAL_IDEA/SPEC-DOWNLOADED-ORIGINAL-IMPLEMENTATION.md](./SPECIFICATIONS/ORIGINAL_IDEA/SPEC-DOWNLOADED-ORIGINAL-IMPLEMENTATION.md)

## Architecture overview

**Stack:**
- **Framework:** Vite + React 18 + TypeScript (strict mode)
- **Styling:** Tailwind CSS + shadcn/ui (Radix UI)
- **Database:** Supabase (PostgreSQL + RLS + magic link auth)
- **Hosting:** Cloudflare Workers (static SPA + API Worker routes)
- **Image storage:** Cloudflare Images
- **AI — illustrations:** Google Gemini API (via Cloudflare Worker)
- **AI — field notes:** Anthropic Claude API (via Cloudflare Worker)
- **Email:** Supabase Auth (magic link emails); Resend available via hultberg.org domain if needed
- **Domain:** `qrious.hultberg.org`

**Key integrations:**
- Supabase Auth (magic link sign-in, no passwords)
- Supabase PostgreSQL with Row Level Security
- Google Gemini (Victorian naturalist creature illustrations)
- Anthropic Claude Haiku (field notes generation)
- Cloudflare Images (creature illustrations — qriousoriginal, qrious512, qrious256 variants served from `imagedelivery.net`)

**Current status:** Phases 1–8 complete and merged to main; Phase 9 in progress

## Implementation phases

Development is organised into 9 sequential phases.

1. ~~[01-foundation-infrastructure.md](./SPECIFICATIONS/ARCHIVE/01-foundation-infrastructure.md)~~ ✓ — Git, Supabase schema + data import, Cloudflare + R2 scaffold
2. ~~[02-auth-design-system.md](./SPECIFICATIONS/ARCHIVE/02-auth-design-system.md)~~ ✓ — Magic link auth, Victorian design system, navigation shell
3. ~~[03-creature-engine-cabinet.md](./SPECIFICATIONS/ARCHIVE/03-creature-engine-cabinet.md)~~ ✓ — DNA engine, QR scanner, creature rendering, hatching animation, cabinet
4. ~~[04-ai-generation-workers.md](./SPECIFICATIONS/ARCHIVE/04-ai-generation-workers.md)~~ ✓ — Cloudflare Workers for Gemini + Claude, R2 image uploads, full discovery flow
5. ~~[05-catalogue.md](./SPECIFICATIONS/ARCHIVE/05-catalogue.md)~~ ✓ — Public species catalogue, taxonomic index, search and filters
6. ~~[06-gazette.md](./SPECIFICATIONS/ARCHIVE/06-gazette.md)~~ ✓ — Community activity feed, explorer showcase, Gazette profiles
7. ~~[07-gamification.md](./SPECIFICATIONS/ARCHIVE/07-gamification.md)~~ ✓ — Badges, explorer rank, achievement notifications
8. ~~[08-settings-admin.md](./SPECIFICATIONS/ARCHIVE/08-settings-admin.md)~~ ✓ — Account settings, admin dashboard, GDPR tools
9. [09-polish-launch.md](./SPECIFICATIONS/09-polish-launch.md) — Mary Anning references, About/Privacy/Contact, error handling, production launch

**Current phase:** Phase 9 — Polish & launch

### SPECIFICATIONS/
- **Implementation phases** (numbered files) — Active work-in-progress
- **ORIGINAL_IDEA/** — Original app builder implementation spec + downloaded source code reference
- **ARCHIVE/** — Completed specs (move here when phase complete)

### REFERENCE/
How-it-works documentation for implemented features:
- [environment-setup.md](./REFERENCE/environment-setup.md) — All API keys, secrets, and service configuration
- [testing-strategy.md](./REFERENCE/testing-strategy.md) — Testing philosophy (Vitest, TDD, coverage targets)
- [technical-debt.md](./REFERENCE/technical-debt.md) — Known issues and accepted shortcuts
- [troubleshooting.md](./REFERENCE/troubleshooting.md) — Common issues and solutions
- [creature-engine.md](./REFERENCE/creature-engine.md) — DNA pipeline, scan flow, cabinet patterns (Phase 3)
- [catalogue.md](./REFERENCE/catalogue.md) — Catalogue RPC, filters, hooks, auth-gating (Phase 5)
- [gazette.md](./REFERENCE/gazette.md) — Community feed, explorer profiles, badge RPC, cross-tab navigation (Phase 6)
- [decisions/](./REFERENCE/decisions/) — Architecture Decision Records

## Code conventions

### File headers
```typescript
// ABOUT: Brief description of file purpose
// ABOUT: Key functionality or responsibility
```

### Naming
- Victorian vocabulary throughout: "cabinet" (not collection), "gazette" (not feed), "specimen" (not creature), "correspondence address" (not email)
- TypeScript conventions: camelCase (variables), PascalCase (types/components)
- Avoid temporal references: no "new", "improved", "old"

### Comments
- Evergreen (describe what code does, not recent changes)
- Minimal (code should be self-documenting)
- Explain complex logic — particularly the DNA generation seeded PRNG and the RLS-dependent data patterns

## Development workflow

**⚠️ CRITICAL: ALL CODE CHANGES REQUIRE A FEATURE BRANCH + PR ⚠️**

**Step 0 (BEFORE making ANY changes):**
- [ ] On feature branch (not main)?
- [ ] If on main: create feature branch first

**CRITICAL: ALL changes require feature branch + PR. NEVER work on main. Zero exceptions.**

**Implementation steps:**
1. Create feature branch (`feature/`, `fix/`, `refactor/`)
2. Check SPECIFICATIONS/ for the current phase spec
3. Implement with tests (run `bun run test` + `bun run typecheck`)
4. Create PR for review:
   - **`/review-pr`** — Fast single-reviewer (1–2 min)
   - **`/review-pr-team`** — Multi-perspective team (5–10 min); use for security-sensitive or architectural PRs

## Deployment

**Deployment is automatic on push to main** via `.github/workflows/deploy.yml` — GitHub Actions runs tests, build, and `wrangler deploy`. Never instruct the user to run `wrangler deploy` manually; after a merge, monitor the GitHub Actions run and smoke-test once it's green.

The `bun run deploy` / `wrangler deploy` commands exist for emergency manual deploys only, not normal flow. The only local wrangler commands in normal use are secrets management (`wrangler secret put ...`).

## TypeScript configuration

- Target: ESNext
- Strict mode: enabled
- Path alias: `@/` maps to `./src/`
- Key types: React 18, Supabase auto-generated DB types (`src/lib/database.types.ts`)

## Testing

```bash
bun run test              # Run all tests
bun run test:watch        # Watch mode
bun run test:coverage     # Coverage report
bun run typecheck         # TypeScript check (no emit)
```

**Coverage target:** 95%+ lines/functions/statements, 90%+ branches

**See:** [testing-strategy.md](./REFERENCE/testing-strategy.md) for full details

## Project-specific notes

**Downloaded reference material** is in `downloads-claude-ship/`:
- `qrious-project-code-2e8ffbe/` — Original Vite/React/TypeScript source (use as reference, do not copy blindly)
- `qrious-database-2026-04-06.json` — Full database export (16 creatures, 18 species, badges, etc.)
- `qrious-images-2026-04-06/` — 54 creature images (original + 512 + 256 variants)

**Admin account:** `magnus.hultberg@gmail.com` — `profiles.is_admin = true`

**Supabase note:** Supabase is used for PostgreSQL + RLS + auth only. No Supabase Storage (images go to Cloudflare Images), no Supabase Edge Functions (AI calls go to Cloudflare Workers).

**Mary Anning:** References to her should be subtle, earned, and consistent with the Victorian naturalist tone. The About page carries the main weight; elsewhere, light touches only. See Phase 9 spec for specific placement guidance.
