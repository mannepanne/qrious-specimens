# Archived specifications

Auto-loaded when working with files in this directory. Completed implementation phases moved here for reference.

## Completed phases

### [01-foundation-infrastructure.md](./01-foundation-infrastructure.md)
Git repository, Supabase schema + RLS, Vite/React/TypeScript scaffold, Cloudflare Workers + R2 setup, domain configuration.

### [02-auth-design-system.md](./02-auth-design-system.md)
Magic link auth, Victorian design system (typography, colour tokens, shadcn/ui), navigation shell (TabBar, SiteFooter), AuthPage.

### [03-creature-engine-cabinet.md](./03-creature-engine-cabinet.md)
DNA engine (djb2 + FNV-1a + mulberry32), QR scanner, Victorian ink renderer (CreatureRendererSketch), hatching animation, cabinet grid with infinite scroll, SpecimenPage, rarity system.

### [04-ai-generation-workers.md](./04-ai-generation-workers.md)
Cloudflare Workers for Gemini illustrations and Claude Haiku field notes, image storage, full discovery pipeline.

### [05-catalogue.md](./05-catalogue.md)
Public species catalogue, taxonomic index, search and filters, sketch fallback, field-notes auth-gating.

### [06-gazette.md](./06-gazette.md)
Community activity feed, explorer showcase, Gazette profiles, badge awarding, cross-tab navigation.

### [07-gamification.md](./07-gamification.md)
Badges, explorer rank tiers, achievement notifications, rank-up toasts.

### [08-settings-admin.md](./08-settings-admin.md)
Account settings, admin dashboard, GDPR data-export and account-deletion tools.

### [design-polish/00-design-polish.md](./design-polish/00-design-polish.md)
Pre-phase polish pass aligning the implementation with the original design (completed before phases 7–9).

## Link convention for archived specs

Archived specs sit one directory deeper than their original `SPECIFICATIONS/` location. Outbound relative links must use `../../` (not `../`) to reach project-root-relative paths like `REFERENCE/`, `CLAUDE.md`, etc. When moving a spec into this directory, walk every `](../...)` link and add one extra `../` segment. A markdown link checker can catch missed updates.

---

**Note:** Archived specs are historical record. For current implementation details, see `REFERENCE/` documentation.
