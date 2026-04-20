# Phase 9: Polish & launch

## Phase overview

**Phase number:** 9
**Phase name:** Polish & launch
**Dependencies:** All previous phases complete

**Brief description:**
The finishing phase: Mary Anning references woven deliberately throughout the UI, the About/Privacy/Contact pages, the Victorian captcha on the contact form, page analytics tracking, and comprehensive error handling. The site is already live on `qrious.hultberg.org`; this phase closes with a post-merge smoke test rather than a first-time deployment. This phase is about the difference between a working app and a *finished* one — attention to detail, graceful failure, and the thread of meaning that runs from Mary Anning's fossil beach to every QR code in the world.

---

## Scope and deliverables

### In scope
- [ ] **About page** — project description, credits, Mary Anning homage, links to Gazette and Catalogue
- [ ] **Privacy page** — privacy policy (data collected, how it's used, GDPR rights)
- [ ] **Contact page** — contact form with `VictorianCaptcha`, submits to `contact_messages` table
- [ ] `VictorianCaptcha` component — themed CAPTCHA (simple maths or word puzzle in Victorian style, not Google reCAPTCHA)
- [ ] `useTrackPageView` hook — fires analytics events to `page_events` table on tab/subpage changes
- [ ] Mary Anning references — deliberate, non-forced, throughout:
  - AuthPage: a small epigraph about the Lyme Regis beach or the act of finding
  - About page: proper acknowledgement of her life and legacy
  - Hatching phase "SCANNING THE STRATA" — already a Lyme Regis reference
  - Explorer name generator: "A. Anning" as an Easter egg in the name list
  - Cabinet header: a rotating Victorian expedition quote
  - Taxonomy naming conventions: subtle nods to Jurassic Coast geology
- [ ] Comprehensive error handling:
  - Network errors → toast with retry option
  - Camera permission denied → clear explanation + fallback message
  - AI generation failure → graceful fallback to client-side SVG render
  - Supabase query errors → informative toast, not silent failure
  - Auth errors → redirect to sign-in
- [ ] Loading states: skeletons or spinners on all async content
- [ ] Empty states: cabinet empty state (invite to scan first QR), catalogue empty state (no matching filters)
- [ ] Image lazy loading in catalogue and cabinet grids
- [ ] Post-merge verification pass (site is already live — see below)
  - [ ] Confirm Wrangler secrets audit (any new secrets introduced in Phase 9 set in production)
  - [ ] Confirm Supabase auth redirect URL still valid for `qrious.hultberg.org`
  - [ ] `wrangler deploy` after merge, then smoke test

### Out of scope
- Native mobile app
- Push notifications
- Localisation / internationalisation
- Social sharing (future feature)

### Carried over from Phase 5
- **Swipe navigation in the catalogue detail view** — The species detail view in the catalogue supports arrow-key / button navigation between species on desktop. Touch swipe left/right for mobile navigation was deferred from Phase 5. Add it here as part of the mobile polish pass, consistent with the swipe patterns used elsewhere in the app.

### Acceptance criteria
- [ ] About, Privacy, and Contact pages render correctly
- [ ] Contact form submits successfully; entry appears in Admin contact inbox
- [ ] VictorianCaptcha blocks bot submissions (basic effectiveness)
- [ ] Page view events recorded in `page_events` table on each tab visit
- [ ] All error states display appropriate messages without crashing
- [ ] Cabinet empty state appears for a new user with no specimens
- [ ] Images in cabinet and catalogue lazy-load
- [ ] `https://qrious.hultberg.org` remains healthy after merge: auth works, scanning works end-to-end
- [ ] Mary Anning references present in at least 4 distinct places across the app
- [ ] `bun run test` passes; `bun run typecheck` passes

---

## Technical approach

### Mary Anning reference guidelines

The goal is *subtle resonance*, not a history lesson. She should feel woven into the fabric of the project, not bolted on. Some principles:

- **Use her initials and name sparingly.** The placeholder "M. Anning" is enough in most places — don't over-explain it.
- **Reference her *actions*, not just her identity.** She didn't wait for permission. She walked the beach after storms. She found things no one was looking for.
- **The geological language is already there.** "SCANNING THE STRATA", "FOSSIL MATRIX", "SPECIMEN CATALOGUED" — these are all her world.
- **Let the About page carry the weight.** This is where we tell her story properly. Everywhere else, a light touch.

**Specific placements:**
- AuthPage → below the sign-in form, a single italicised line: *"She persisted in finding things the learned men had not thought to look for."*
- About page → a dedicated section: her life, Lyme Regis, the connection to this project
- Cabinet header → rotating Victorian expedition quotes (sourced from public domain letters of the era)
- Explorer name generator → "A. Anning" as a valid generated name (she had a sister, Mary; use "A. Anning" for Anna, a plausible period name)
- Badge names → one badge called "Naturalist's Eye" or "Coastal Perseverance" with an Anning-resonant description

### VictorianCaptcha

A simple challenge/response in Victorian style — e.g.:
- "A naturalist collects 3 ammonites on Monday and 4 on Tuesday. How many specimens does she have?" → user types `7`
- Or: "Complete the Latin binomial: *Ichthyo_____us*" → user types `saurus`

Purely client-side validation (simple enough that the value of blocking bots outweighs the ease of defeating it). The contact form also rate-limits via Supabase RLS.

### Analytics tracking

```typescript
// useTrackPageView.ts
// On each tab/subpage change, insert a row into page_events:
// { user_id, page_name, session_id (localStorage UUID), created_at }
```

Anonymous for unauthenticated users (no user_id). Session ID is a UUID stored in sessionStorage (clears on browser close).

### Post-merge verification checklist

The site is already live at `https://qrious.hultberg.org` (DNS, Wrangler secrets, R2, Supabase auth URLs were all set during earlier phases). This checklist confirms nothing regressed when Phase 9 changes ship.

**Supabase:**
- [ ] Site URL still `https://qrious.hultberg.org`
- [ ] Redirect URL allowlist still includes `https://qrious.hultberg.org/**`
- [ ] Email templates customised (optional — Victorian style would be lovely)

**Cloudflare:**
- [ ] Any new Wrangler secrets introduced during Phase 9 are set in production
- [ ] `wrangler deploy` succeeds after merge
- [ ] R2 bucket (or Cloudflare Images, if the migration lands) still serving publicly

> **⚠️ Discuss before Phase 9:** Two Cloudflare services worth evaluating before launch:
>
> **Cloudflare Images** — may replace our current R2 + manual 512px/256px variant approach. Offers on-the-fly resizing/transformations via URL parameters, a global CDN, and avoids the current race-condition around orphaned R2 objects (TD-003). Evaluate against current R2 approach for cost and simplicity.
>
> **Cloudflare Email** — new transactional email service (https://blog.cloudflare.com/email-service/). Could replace Resend for the contact form and any future notification emails. Evaluate against Resend (already available via hultberg.org domain) for feature parity and pricing.

**Smoke test:**
- [ ] Sign in via magic link
- [ ] Scan a QR code → full hatching sequence → creature added to cabinet
- [ ] Specimen page opens with AI illustration and field notes
- [ ] Catalogue shows all species
- [ ] Gazette shows activity feed
- [ ] Settings shows rank and badges
- [ ] About page loads

---

## Testing strategy

### Manual testing checklist (comprehensive final check)
- [ ] Complete new user journey: sign up → email confirmation → scan first QR → cabinet → gazette → settings
- [ ] Complete admin journey: sign in as Magnus → admin panel → stats → contact messages
- [ ] All four creature render styles work on mobile and desktop
- [ ] Error state: turn off network → scan QR → error message appears, app doesn't crash
- [ ] Error state: deny camera permission → clear message shown
- [ ] Contact form: submit without solving captcha → blocked; solve captcha → submits
- [ ] Privacy page renders with complete policy text
- [ ] Sign-out works; signing back in via magic link works
- [ ] Mobile: all layouts correct, tab bar accessible, camera overlay full-screen

---

## Pre-commit checklist

- [ ] `bun run test` passes
- [ ] `bun run typecheck` passes
- [ ] No `console.log` or debug code in production build
- [ ] All placeholder text replaced
- [ ] Privacy policy reviewed and accurate
- [ ] Any new production environment variables introduced this phase are set (not dev keys)

---

## PR workflow

### Branch naming
```
feature/phase-9-polish-launch
```

### Review requirements
- Use `/review-pr-team` — final review before launch; catch anything missed across all phases

---

## Notes

This phase is as much editorial as technical. The Mary Anning thread is what makes QRious Specimens more than just a creature generator — it gives the whole project a *reason* rooted in real history. Mary Anning spent decades making discoveries that transformed how humans understand life on Earth, mostly unrecognised, in exchange for barely enough to live on. This app invites everyone to be a naturalist, on whatever street they happen to be standing. That's her legacy, applied to a world she couldn't have imagined.

Worth doing it justice.

---

## Related documentation

- [Phase 8](./08-settings-admin.md) — Prerequisite
- [Master specification](./ORIGINAL_IDEA/SPEC-DOWNLOADED-ORIGINAL-IMPLEMENTATION.md) — About/Privacy/Contact sections
- [environment-setup.md](../REFERENCE/environment-setup.md) — Production deployment variables
