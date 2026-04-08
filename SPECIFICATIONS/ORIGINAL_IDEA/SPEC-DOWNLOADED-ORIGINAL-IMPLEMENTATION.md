# QRious Specimens — Complete Specification

## Overview

**QRious Specimens** is a digital cabinet of curiosities — a web application where users scan real-world QR codes to discover procedurally generated fantasy creatures. Each QR code deterministically produces a unique species with its own taxonomy, anatomy, and illustration. Discoveries are collected in a personal cabinet, tracked in a public gazette, and rewarded with achievement badges and explorer ranks.

The app is themed around Victorian natural history: field journals, expedition logs, and specimen catalogues. The tone is playful, mysterious, and slightly eccentric.

---

## Core Concepts

### Specimens & Species
- Every QR code in the world maps deterministically to a unique **species**, identified by a 16-character hex hash derived from the QR content.
- A species has procedurally generated DNA: taxonomy (order, family, genus, species), body plan, appendages, colouring, habitat, temperament, and estimated size.
- The first time a species is discovered, an AI-generated Victorian naturalist illustration is commissioned (via an image generation Edge Function) and stored permanently.
- AI-generated **field notes** are written by a Claude-powered Edge Function, describing the specimen in the voice of a Victorian naturalist.
- Subsequent discoverers of the same species see the cached illustration and notes.

### Rarity
Rarity is computed dynamically from the number of unique discoverers:
- **Rare**: 1–3 discoverers
- **Uncommon**: 4–15 discoverers
- **Common**: 16+ discoverers

### Creature Rendering Styles
Four visual styles are available (persisted in localStorage):
- **Generative Sketch** (default): AI-generated Victorian engraving illustrations via the `generate-creature` Edge Function.
- **Explorer Sketch**: Client-side SVG rendering in an ink-on-parchment style.
- **Volumetric Sketch**: Client-side SVG with shaded volumetric rendering.
- **Dark Sci-Fi**: Client-side SVG with neon-on-dark sci-fi aesthetic.

---

## User Flows

### 1. Unauthenticated Visitor
- Can browse the **Catalogue** of all discovered species (public, paginated).
- Can view the **Gazette** (community activity feed) as a read-only observer.
- Can visit About, Privacy, and Contact pages.
- Sees sign-up CTA banners on the Catalogue and Gazette pages.
- Cannot scan QR codes, collect specimens, or earn badges.

### 2. Sign Up / Sign In
- Email + password authentication via Supabase Auth.
- Sign-up form collects: display name (placeholder: "M. Anning"), email, password.
- Password is labelled "Expedition Key" throughout the app.
- Email confirmation: after sign-up, an amber banner appears on all pages prompting the user to confirm their email. The banner offers "Resend Confirmation" and "Change Address" (links to Settings). Dismissable per session but returns until confirmed.
- Password reset flow via email link, with a custom in-app password update form.

### 3. Scanning & Hatching
1. User opens the **QR Scanner** (camera overlay).
2. Scans any QR code in the real world.
3. The **Hatching Animation** plays — a multi-phase cinematic sequence:
   - "FIELD SPECIMEN DETECTED" → "SCANNING THE STRATA" → "DECODING FOSSIL MATRIX" → "COMMISSIONING ILLUSTRATION" → "THE ARTIST IS DRAWING" (waits for image generation) → "COMPOSING FIELD NOTES" (waits for AI notes) → "SPECIMEN CATALOGUED"
   - A large Victorian Gothic compass rose spinner (ornate SVG with fleur-de-lis cardinal points, decorative rings, rosette pattern, tick marks) rotates during async wait phases.
   - The creature illustration fades in as it emerges from a shattering QR fossil matrix.
4. Discovery is registered via the `register_discovery` RPC (tracks unique discoverers and total scans).
5. If the user is a first discoverer, a special "first discovery" notification appears.
6. Badge eligibility is checked immediately after each discovery.
7. Explorer rank is recalculated.
8. If the user has a public Gazette profile, the discovery is posted to the activity feed.
9. Duplicate scans (same QR code, same user) are detected and rejected with a toast message.

### 4. Cabinet (Personal Collection)
- Grid display of all the user's collected specimens.
- Each card shows the creature illustration (or client-side SVG), species name, family, and rarity badge.
- Tap a specimen to open the full **Specimen Page** (overlay):
  - Large illustration with Victorian frame.
  - Full taxonomy: Order, Family, Genus, Species.
  - AI-generated field notes (typewriter text animation on first view).
  - Discovery metadata: date, rarity, discoverer count, total scans.
  - First discoverer badge.
  - Custom nickname field (editable).
  - Navigation arrows to page through specimens.
  - Footer with About/Privacy links.
- Explorer rank badge displayed in the cabinet header.

### 5. Catalogue (Public Species Index)
- Paginated, searchable, filterable index of all discovered species.
- **Taxonomic Index** sidebar: hierarchical tree of Orders with species counts; click to filter.
- **Search**: by name, order, habitat.
- **Trait filters**: symmetry, body shape, limb style, pattern type, habitat, temperament.
- Grid of species cards with illustrations, names, families, and rarity labels.
- Click a species to view its detail page (with page-flip animation between species).
- Sign-up CTA banner for unauthenticated visitors.

### 6. Gazette (Community Feed)
- **Activity Timeline**: chronological feed of public discoveries and badge awards.
  - Discovery entries show the explorer's display name, species name, thumbnail, and time ago. Clicking links to the specimen in the Catalogue.
  - Badge entries show the badge icon and name.
  - Colour-coded timeline dots: emerald (discovery), purple (first discovery), amber (rare), blue (badge).
- **Explorer Showcase**: grid of public explorer profiles with avatars (initials), display names, specimen counts, and earned badge icons.
- **Community Stats**: total explorers, specimens, species.
- **Join Prompt**: first-time users see a form to create their Gazette profile (display name + public/private toggle). A sparkle button generates random Victorian-style explorer names.

### 7. Settings (Subpage, tab bar visible)
Two-column desktop layout (`max-w-3xl`, `grid-cols-1 lg:grid-cols-2`):

**Left Column — Achievements:**
- **Rank Card**: current explorer rank (Bronze/Silver/Gold/Platinum) with tier-specific styling (colours, glows), progress bar to next rank, score, and stat breakdown grid (badges, specimens, species, rare finds, first discoveries, days active).
- **Badge Collection**: all badge definitions displayed as cards. Earned badges show tier labels (Bronze/Silver/Gold); unearned badges show "LOCKED".

**Right Column — Settings:**
- **Gazette Profile**: display name (with sparkle regeneration button + confirmation dialog), public/private toggle.
- **Account**: correspondence address (email, read-only display).
- **Expedition Key**: password change form (new + confirm).
- **Information**: about button, privacy link, sign-out button. Admin link (if admin).

Section headers have icons: Medal (Achievements), User (Account), KeyRound (Expedition Key), Info (Information), CircleHelp (About).

### 8. Admin Panel
Accessible to users with `is_admin = true` in profiles.
- **Dashboard stats**: total users, users with specimens, unique species, total discoveries, field notes, contact submissions, page views.
- **User list**: email, display name, creature count, admin status.
- **Contact messages**: inbox with read/unread status.
- GDPR tools: export user data, delete user data.

---

## Navigation Architecture

### Routing Model
The app uses React state-based routing (no URL routing beyond SPA fallback). Three navigation layers:

1. **Tabs** (`activeTab`): `catalogue` | `gazette` | `cabinet` — persistent bottom tab bar.
2. **Overlays** (`overlay`): `scanner` | `hatching` | `specimen` — full-screen immersive views that hide the tab bar.
3. **Subpages** (`subpage`): `about` | `privacy` | `contact` | `settings` | `admin` — render within the tab layout, tab bar stays visible.

### Scroll Behaviour
Navigation between tabs, overlays, and subpages triggers `window.scrollTo(0, 0)`.

### Footer
A shared `SiteFooter` component renders at the bottom of the tab layout with "BUILT WITH CURIOSITY AND INSUFFICIENT CAUTION" tagline and About/Privacy links. The Specimen overlay has its own footer instance.

---

## Achievement System

### Badges
Achievement badges with three tiers (Bronze, Silver, Gold). Evaluated server-side via the `check_and_award_badges` RPC after each discovery. Badge definitions are stored in `badge_definitions` with slug, name, description, icon emoji, tier, and sort order.

Badge criteria (evaluated in PL/pgSQL):
- Specimen count milestones (e.g., first specimen, 5 specimens, etc.)
- Rare specimen discoveries
- First discoverer status
- Number of distinct species
- Days active
- Other thresholds defined in badge evaluation logic

### Explorer Rank
A separate progression system computed by `calculate_explorer_rank` RPC:

**Ranks**: Unranked → Bronze → Silver → Gold → Platinum

**Scoring Formula** (intentionally opaque, D&D-inspired):
- Badge points: bronze=1, silver=2, gold=3 per badge
- Breadth multiplier: +0.05 per bronze/silver tier badge, +0.10 per gold tier badge
- Specimens: `floor(sqrt(count)) * 0.8`
- Species diversity: `0.5` per unique species
- Rare finds: `0.8` each
- Pioneer bonus: `power(first_discoveries, 1.1) * 0.5`
- Activity: `ln(days_active + 1) * 1.5`
- Curiosity (page views): `ln(views + 1) * 0.8`
- Streak bonus: capped at 4
- Hidden bonuses:
  - Collector's Resolve: +2 for 5+ badges
  - Naturalist's Instinct: +3 for 5+ rare specimens and 3+ first discoveries

**Thresholds**: Bronze = 8, Silver = 35, Gold = 100, Platinum = 250

Rank-up toast notifications appear when a user's rank increases.

---

## Edge Functions (Server-Side)

### `generate-creature`
- **Trigger**: First discovery of a species (generative style).
- **Process**: Takes creature DNA, builds a detailed art prompt, calls an image generation API, uploads the result to Supabase Storage, stores the URL in `species_images`.
- **Auth**: Verifies caller JWT.
- **CORS**: Enabled for browser streaming.

### `generate-field-notes`
- **Trigger**: After creature image is generated.
- **Process**: Takes creature DNA (and optionally the generated image), builds a prompt, calls Claude API (Haiku) to generate Victorian naturalist field notes, stores in `species_images.field_notes`.
- **Auth**: Verifies caller JWT.
- **Secret**: `ANTHROPIC_API_KEY` stored in Edge Function secrets.

---

## Database Schema

### Tables

| Table | Purpose |
|-------|---------|
| `profiles` | User profiles (auto-created on signup via trigger), display name, admin flag |
| `creatures` | User's collected specimens — links user to QR hash + DNA JSON |
| `species_images` | One per species — AI illustration URLs (original/512/256), field notes, first discoverer |
| `species_discoveries` | One per species — unique discoverer count, total scan count, first discoverer |
| `explorer_profiles` | Gazette profiles — display name, public/private toggle |
| `explorer_badges` | Earned badges per user |
| `badge_definitions` | Badge catalogue — slug, name, description, icon, tier, sort order |
| `activity_feed` | Public timeline entries — discoveries and badge awards |
| `page_events` | Analytics — page views with session tracking |
| `contact_messages` | Contact form submissions with read status |

### Row Level Security
All tables have RLS enabled. Key policies:
- Users can only read/write their own creatures, profiles, and badges.
- Species images and discoveries are publicly readable.
- Activity feed entries are only visible if the poster has a public explorer profile.
- Contact messages and page events are admin-only for reads.
- Badge definitions are publicly readable.

### Key RPCs
| Function | Purpose |
|----------|---------|
| `register_discovery` | Atomic discovery registration with first-discoverer tracking |
| `check_and_award_badges` | Evaluate and award badges, return results with `newly_awarded` flag |
| `calculate_explorer_rank` | Compute explorer rank score and tier |
| `get_catalogue` | Paginated public species catalogue |
| `get_community_feed` | Activity feed with joined profile/badge/image data |
| `get_explorer_showcase` | Public explorer profiles with stats and badges |
| `get_community_stats` | Aggregate community statistics |
| `admin_get_stats` | Comprehensive admin dashboard statistics |
| `admin_list_users` | User management list (admin-only) |
| `admin_export_user_data` | GDPR data export (admin-only) |
| `admin_delete_user_data` | GDPR data deletion (admin-only) |
| `is_admin` | RLS helper — checks admin status |
| `handle_new_user` | Trigger — creates profile on auth signup |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Bun |
| Framework | React 18 + TypeScript (strict mode) |
| Build | Vite |
| Styling | Tailwind CSS with semantic colour tokens (light/dark mode) |
| Components | shadcn/ui + lucide-react icons |
| Data Fetching | TanStack React Query |
| Forms | react-hook-form + zod |
| Toasts | sonner (positioned top-center) |
| Backend | Supabase (Postgres, Auth, Storage, Edge Functions, Realtime) |
| Edge Functions | Deno (server-side AI calls) |
| Deployment | Vercel (SPA routing via vercel.json) |

---

## Component Inventory

### Pages (`src/pages/`)
| Component | Description |
|-----------|-------------|
| `AuthPage` | Sign-up / sign-in / password reset forms with Victorian theming |
| `ResetPasswordPage` | In-app password update form (for email recovery links) |
| `CataloguePage` | Public species index with taxonomy sidebar, search, filters, detail view |
| `CommunityPage` | The Explorer's Gazette — activity feed, explorer showcase, join prompt |
| `SpecimenPage` | Full specimen detail overlay — illustration, taxonomy, field notes, metadata |
| `AboutPage` | About QRious Specimens — project description and credits |
| `PrivacyPage` | Privacy policy |
| `ContactPage` | Contact form |
| `AdminPage` | Admin dashboard, user management, contact inbox |

### Components (`src/components/`)
| Component | Description |
|-----------|-------------|
| `AccountSettings` | Two-column settings page with rank, badges, profile, account |
| `CreatureRenderer` | Delegates to style-specific renderer based on creature style setting |
| `CreatureRendererGenerative` | Displays AI-generated illustration with fallback to sketch |
| `CreatureRendererSketch` | Client-side SVG ink-on-parchment style |
| `CreatureRendererVolumetric` | Client-side SVG with shaded volumetric forms |
| `CreatureRendererScifi` | Client-side SVG with neon sci-fi aesthetic |
| `EmailConfirmBanner` | Amber banner prompting email confirmation with resend/change actions |
| `HatchingAnimation` | Multi-phase cinematic hatching sequence with Gothic compass spinner |
| `JournalNav` | Journal-style navigation header |
| `PageFlip` | Page-turn animation wrapper for catalogue navigation |
| `QrScanner` | Camera-based QR code scanner overlay |
| `SiteFooter` | Shared footer with tagline and About/Privacy links |
| `SpecimenTeaser` | Compact specimen preview card |
| `TabBar` | Bottom tab bar (Catalogue / Gazette / Cabinet) |
| `TypewriterText` | Typewriter-effect text animation for field notes |
| `VictorianCaptcha` | Themed CAPTCHA component for contact form |

### Hooks (`src/hooks/`)
| Hook | Description |
|------|-------------|
| `useAuth` | Supabase auth state, sign up/in/out, password reset, email confirmation |
| `useCreatures` | CRUD for user's creature collection |
| `useCatalogue` | Paginated public species catalogue query |
| `useCommunity` | Explorer profiles, badges, activity feed, rank, showcase, stats |
| `useCreatureStyle` | Creature rendering style preference (localStorage-backed context) |
| `useSpeciesImage` | Species image and field notes queries + generation mutations |
| `useIsAdmin` | Admin status check |
| `useTrackPageView` | Analytics page view tracking |
| `useIntersectionObserver` | Infinite scroll trigger |
| `use-mobile` | Mobile viewport detection |

### Libraries (`src/lib/`)
| Module | Description |
|--------|-------------|
| `creatureEngine` | Deterministic creature DNA generation from QR content string |
| `rarity` | Rarity computation from discovery count |
| `explorerNames` | Random Victorian-style explorer name generator |
| `resizeImage` | Client-side image resizing for thumbnail variants |
| `supabase` | Supabase client instance |
| `queryClient` | TanStack React Query client |
| `utils` | `cn()` class merging utility |

---

## Design Language

- **Typography**: Serif fonts for body text and headings; monospace for labels, metadata, and UI chrome. Mono labels use extreme letter-spacing and very small sizes (9–10px).
- **Colour**: Warm neutrals, parchment tones. Amber/sepia accent. Semantic colour tokens for light/dark mode support.
- **Layout**: Journal-style with ruled-line background, decorative spine on desktop (left margin). Content areas use `max-w-2xl` or `max-w-4xl` with generous padding.
- **Interaction**: Page-flip animations, typewriter text reveals, smooth transitions. Hatching sequence is a deliberate cinematic moment.
- **Iconography**: lucide-react icons throughout. Badge icons are emoji.
- **Tone of voice**: Victorian expedition language — "correspondence address" (not email), "expedition key" (not password), "cabinet" (not collection), "gazette" (not feed), "specimen" (not creature).
