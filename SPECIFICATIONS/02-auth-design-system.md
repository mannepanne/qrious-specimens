# Phase 2: Authentication & design system

## Phase overview

**Phase number:** 2
**Phase name:** Authentication & design system
**Dependencies:** Phase 1 (foundation) complete — Supabase project running, Vite scaffold in place

**Brief description:**
Builds the authentication layer (magic link via Supabase) and establishes the entire Victorian visual language: typography, colour tokens, Tailwind configuration, shadcn/ui components, and the navigation shell (tab bar, overlay system, subpage system). By the end of this phase, a user can sign in and see a correctly-themed navigation skeleton — no content yet, but the chrome and structure are solid.

---

## Scope and deliverables

### In scope
- [ ] Magic link sign-in flow (email → link → authenticated session)
- [ ] Sign-out
- [ ] `AuthPage` component (sign-in form, magic link sent confirmation screen)
- [ ] `ResetPasswordPage` (handles the magic link token from the email URL)
- [ ] Email confirmation banner (`EmailConfirmBanner`) — amber, dismissable, shows until email confirmed
- [ ] `useAuth` hook — auth state, sign-in, sign-out, session management
- [ ] Victorian design system: Tailwind config with semantic colour tokens, typography (serif + monospace), warm parchment palette, light/dark mode
- [ ] shadcn/ui configured with project theme
- [ ] `TabBar` component — Catalogue / Gazette / Cabinet tabs, bottom-pinned
- [ ] Navigation state management — `activeTab`, `overlay`, `subpage` state in `App.tsx`
- [ ] Overlay system scaffold — `scanner`, `hatching`, `specimen` overlays (empty placeholder content for now)
- [ ] Subpage system scaffold — `about`, `privacy`, `contact`, `settings`, `admin` subpages (empty placeholders)
- [ ] `JournalNav` — journal-style header with Victorian ornamentation
- [ ] `SiteFooter` — "BUILT WITH CURIOSITY AND INSUFFICIENT CAUTION" tagline, About/Privacy links
- [ ] Scroll-to-top on tab/overlay/subpage navigation
- [ ] Sign-up CTA banner (for unauthenticated visitors) — visible on Catalogue and Gazette tabs
- [ ] Tests for `useAuth`, `TabBar`, navigation state, `AuthPage`

### Out of scope
- Content within any tab or overlay (that's Phases 3–8)
- Badge/rank display (Phase 7)
- Settings page content (Phase 8)
- Admin page content (Phase 8)

### Acceptance criteria
- [ ] Unauthenticated user sees `AuthPage`; can enter email and receive magic link
- [ ] Clicking magic link in email redirects to app and signs user in
- [ ] Authenticated user sees tab bar with Catalogue / Gazette / Cabinet tabs
- [ ] Tab switching works; scroll resets to top on each switch
- [ ] Email confirmation banner appears when email is unconfirmed; dismissable per session
- [ ] Sign-out returns user to `AuthPage`
- [ ] Victorian design tokens applied — warm parchment background, serif headings, mono labels
- [ ] `bun run test` passes; `bun run typecheck` passes

---

## Technical approach

### Architecture decisions

**Magic link auth only — no passwords**
- Choice: Supabase magic links (`supabase.auth.signInWithOtp({ email })`) — no password field anywhere in the UI
- Rationale: Simpler UX, no password management, works reliably when we control the redirect URL (unlike in the original app builder environment). The "Expedition Key" password concept is dropped entirely.
- Implementation: Set `SUPABASE_SITE_URL` in Supabase dashboard → Auth → URL Configuration to `https://qrious.hultberg.org`. Set redirect URL allowlist to include `https://qrious.hultberg.org/**` and `http://localhost:5173/**`.

**State-based routing (no URL router)**
- Choice: Three-layer navigation in React state (`activeTab`, `overlay`, `subpage`) — same model as the original implementation
- Rationale: This is a camera/scanner app with cinematic overlays; URL-based routing would add complexity with no benefit (no SEO requirement, no shareable URLs needed for most views)
- Alternatives considered: React Router v6 — rejected, overkill and the original worked without it

**Semantic colour tokens**
- Choice: CSS custom properties mapped to Tailwind semantic tokens (`--color-parchment`, `--color-ink`, `--color-amber-accent`, etc.) with light/dark mode variants
- Rationale: Consistent theming, easy to maintain, compatible with next-themes for dark mode toggle
- See the original `tailwind.config.js` in `downloads-claude-ship/` for the established token set

### Victorian design language

**Typography:**
- Headings: `font-serif` (e.g., Playfair Display or similar from Google Fonts)
- Body: `font-serif` (readable, old-world feel)
- Labels, metadata, UI chrome: `font-mono` with extreme letter-spacing (`tracking-widest`), very small sizes (9–10px, uppercase)

**Colour palette (light mode):**
- Background: warm parchment (`#F5F0E8` or similar)
- Text: deep ink (`#1C1309`)
- Accent: amber/sepia
- Success: emerald
- Decorative spine: left border on desktop layout

**Layout:**
- `max-w-2xl` or `max-w-4xl` content areas with generous padding
- Journal-style ruled-line background texture (CSS)
- Decorative spine on desktop (left margin element)

### Navigation model

```typescript
type ActiveTab = 'catalogue' | 'gazette' | 'cabinet'
type Overlay = 'scanner' | 'hatching' | 'specimen' | null
type Subpage = 'about' | 'privacy' | 'contact' | 'settings' | 'admin' | null
```

Overlays are full-screen and hide the tab bar. Subpages render within the tab layout with tab bar visible.

### Key files

**New files to create:**
```
src/
├── App.tsx                           # Navigation state, auth guard, layout
├── pages/
│   ├── AuthPage.tsx                  # Magic link sign-in
│   └── ResetPasswordPage.tsx         # Token exchange for email links
├── components/
│   ├── TabBar/
│   │   ├── TabBar.tsx
│   │   └── TabBar.test.tsx
│   ├── JournalNav/
│   │   └── JournalNav.tsx
│   ├── SiteFooter/
│   │   └── SiteFooter.tsx
│   └── EmailConfirmBanner/
│       ├── EmailConfirmBanner.tsx
│       └── EmailConfirmBanner.test.tsx
├── hooks/
│   ├── useAuth.ts
│   └── useAuth.test.ts
└── lib/
    ├── supabase.ts                   # Supabase client (VITE_SUPABASE_URL + anon key)
    └── queryClient.ts                # TanStack React Query client
```

**Configuration:**
```
tailwind.config.js      # Victorian colour tokens, font families
index.css               # CSS custom properties, font imports
```

---

## Testing strategy

### Unit tests

**`useAuth.test.ts`**
- Signs in with email → calls `supabase.auth.signInWithOtp`
- Sign-out clears session state
- Auth state listener updates component state on session change
- Resend confirmation email triggers correct Supabase call

**`EmailConfirmBanner.test.tsx`**
- Renders when email unconfirmed
- Does not render when email confirmed
- Dismiss button hides banner for session
- Returns after page reload if still unconfirmed

**`TabBar.test.tsx`**
- Renders three tabs: Catalogue, Gazette, Cabinet
- Active tab is highlighted
- Tab click triggers `setActiveTab` callback
- Hidden when an overlay is active

### Manual testing checklist
- [ ] Enter email on AuthPage → confirmation screen appears
- [ ] Check email inbox → magic link received
- [ ] Click magic link → redirected to app, signed in, tab bar visible
- [ ] Click each tab → correct tab activates, page scrolls to top
- [ ] Sign-out button → returns to AuthPage
- [ ] Email confirm banner appears, resend button works, dismiss works
- [ ] Design tokens applied — warm background, serif type, mono labels
- [ ] Dark mode toggle works (if implemented)
- [ ] Mobile layout: tab bar pinned to bottom, content scrollable

---

## Pre-commit checklist

- [ ] `bun run test` — all tests pass
- [ ] `bun run typecheck` — no TypeScript errors
- [ ] No hardcoded Supabase URLs or keys in source
- [ ] `.dev.vars` not committed
- [ ] Magic link redirect URLs configured in Supabase dashboard (documented in environment-setup.md)
- [ ] Victorian colour tokens documented

---

## PR workflow

### Branch naming
```
feature/phase-2-auth-design-system
```

### Review requirements
- Use `/review-pr-team` — auth flows are security-sensitive; design system decisions affect every future phase

### Deployment steps
1. Set `Site URL` in Supabase → Auth → URL Configuration → `https://qrious.hultberg.org`
2. Add `https://qrious.hultberg.org/**` and `http://localhost:5173/**` to redirect URL allowlist
3. `wrangler deploy`
4. Test magic link flow end-to-end in production

---

## Edge cases and considerations

### Known risks
- **Magic link email delivery:** In development, Supabase sends real emails even from local. Make sure Supabase project's email settings are configured (or use the Supabase dashboard "Confirm user" button during development to bypass the email step).
- **Token expiry:** Magic links expire after 1 hour by default. The `ResetPasswordPage` component needs to handle expired tokens gracefully with a clear message and re-send option.
- **Session persistence:** Supabase JS client handles session persistence in localStorage automatically. Test that refreshing the page doesn't log the user out.

### Security considerations
- Supabase anon key is safe to expose in the browser (it's public by design; RLS enforces access control)
- Never expose the service role key in the frontend
- Auth state changes must be handled via `onAuthStateChange` listener, not just the initial `getSession()` call

### Mary Anning connection
- The AuthPage sign-in screen is a good place for the first subtle Anning reference — perhaps a small epigraph or the tagline. She spent years collecting fossils on the Lyme Regis beach before anyone took her seriously. There's something fitting about an expedition starting with a quiet, persistent act of curiosity.

---

## Related documentation

- [Phase 1](./01-foundation-infrastructure.md) — Prerequisite
- [Phase 3](./03-creature-engine-cabinet.md) — Next phase
- [environment-setup.md](../REFERENCE/environment-setup.md) — Supabase auth config
- [Master specification](./ORIGINAL_IDEA/SPEC-DOWNLOADED-ORIGINAL-IMPLEMENTATION.md) — Auth and navigation sections
