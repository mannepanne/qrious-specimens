# Implementation specifications library

Auto-loaded when working with files in this directory. Forward-looking plans for features being built.

## Purpose of this folder

The SPECIFICATIONS folder contains **forward-looking plans** for features actively being built. These are living documents that guide development and evolve as we learn more.

Move completed specs to **ARCHIVE/** when a phase is merged to main.

---

## Active implementation phases

Development is organised into 9 sequential phases. Work through them in order — each builds on the previous.

**Current phase:** Phase 1 — Foundation & infrastructure

### Phase files

1. **[01-foundation-infrastructure.md](./01-foundation-infrastructure.md)**
   Git, Supabase schema + data import, Cloudflare Workers scaffold, R2 bucket setup, environment variables

2. **[02-auth-design-system.md](./02-auth-design-system.md)**
   Magic link auth, Victorian design system (Tailwind tokens, typography), shadcn/ui, navigation shell (tab bar, overlays, subpages)

3. **[03-creature-engine-cabinet.md](./03-creature-engine-cabinet.md)**
   Deterministic DNA engine, QR scanner, all four creature render styles, hatching animation, cabinet view, specimen page

4. **[04-ai-generation-workers.md](./04-ai-generation-workers.md)**
   Cloudflare Workers for Gemini image generation + Claude field notes, R2 image uploads, full discovery registration flow

5. **[05-catalogue.md](./05-catalogue.md)**
   Public species catalogue, taxonomic index sidebar, search and trait filters, paginated species grid, page-flip detail view

6. **[06-gazette.md](./06-gazette.md)**
   Community activity timeline, explorer showcase, community stats, Gazette profile creation and privacy toggle

7. **[07-gamification.md](./07-gamification.md)**
   10 badges × 3 tiers, badge-checking RPC integration, explorer rank system, achievement toasts and rank-up notifications

8. **[08-settings-admin.md](./08-settings-admin.md)**
   Settings subpage (rank card, badge collection, Gazette profile, account), admin dashboard, GDPR export/delete

9. **[09-polish-launch.md](./09-polish-launch.md)**
   Mary Anning references, About/Privacy/Contact pages, Victorian captcha, analytics, error handling, production deployment

### Supporting documentation

**[ORIGINAL_IDEA/](./ORIGINAL_IDEA/)**
- `SPEC-DOWNLOADED-ORIGINAL-IMPLEMENTATION.md` — Complete spec of what was built in the Anthropic app builder; primary reference for feature parity

**[ARCHIVE/](./ARCHIVE/)**
- Completed specifications (moved here when phase is done and PR merged)

**[REFERENCE/decisions/](../REFERENCE/decisions/)** — Architecture Decision Records
- Search here BEFORE making architectural decisions
- Document new significant decisions here

## When specs move to archive

After completing a phase and merging the PR:
1. Move the phase file to `ARCHIVE/`
2. Update implementation docs in `REFERENCE/` for the implemented features
3. Update "Current phase" in both this file and the root `CLAUDE.md`
