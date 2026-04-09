# ADR: Layered navigation model — tab, overlay, and subpage

**Date:** 2026-04-09
**Status:** Active
**Supersedes:** N/A

---

## Decision

The app uses a three-layer navigation state (`tab`, `overlay`, `subpage`) rather than a URL router. Overlays suppress the tab bar and render full-screen; subpages render within tab context with the tab bar visible.

## Context

Phase 2 introduced the navigation shell. A PR review by three independent agents flagged that the original implementation only had a single `activeTab` state, with four tabs (`scan | cabinet | community | profile`) that diverged from the spec. This caused two problems:

1. The scanner, hatching animation, and specimen view must be full-screen (no tab bar), but a flat tab model has no mechanism to hide the tab bar — Phase 3 would have needed to invent ad-hoc modal state or refactor App.tsx on day one.
2. The tab labels did not match the spec (`catalogue | gazette | cabinet`) and a Profile tab was added where the spec has Profile as a subpage accessed via JournalNav.

This ADR captures the resolved nav model so Phase 3+ engineers have a canonical reference.

## Alternatives considered

- **Single `activeTab` only (what was shipped initially):** Simple, but Phase 3's scanner and hatching animation both need to suppress the tab bar — there is no slot for them without a refactor. Rejected.
- **URL router (React Router / TanStack Router):** Adds complexity and bundle size for a mobile-first SPA where deep-linking to specific creatures will be handled via QR codes, not URLs. Sharing is done via the gazette feed. Rejected — no meaningful benefit in scope.
- **Chosen: three-state `{ tab, overlay, subpage }` model:** Matches the spec, gives Phase 3 a ready slot for overlays, keeps the implementation simple (no library dependency).

## Reasoning

**The three layers map to distinct visual behaviours:**

| Layer | Tab bar | Content width | Back navigation |
|---|---|---|---|
| Tab | Visible | Full | N/A (peer tabs) |
| Overlay | Hidden | Full-screen | Close button |
| Subpage | Visible | Page width | Back arrow |

**Overlays hide the tab bar** — this is enforced by passing `hidden={overlay !== null}` to `TabBar`. The scanner, hatching animation, and specimen view are Phase 3 overlays; the tab bar must not be visible during them.

**Subpages do not hide the tab bar** — settings, about, privacy, contact, admin. Users can still orient themselves via the tab bar.

**Tab navigation resets overlay and subpage** — navigating to a different tab clears both, preventing navigation state becoming inconsistent.

## The three primary tabs (canonical)

```typescript
type Tab = 'catalogue' | 'gazette' | 'cabinet'
```

- `catalogue` — public species index (Phase 5). **Publicly browsable — no auth required.**
- `gazette` — community activity feed (Phase 6). **Publicly browsable — no auth required.**
- `cabinet` — the naturalist's personal specimen collection (Phase 3). **Requires auth.**

## Overlay types (canonical)

```typescript
type Overlay = 'scanner' | 'hatching' | 'specimen' | null
```

- `scanner` — QR camera view (Phase 3). Requires auth.
- `hatching` — cinematic animation during creature generation (Phase 3). Requires auth.
- `specimen` — full-screen creature view (Phase 3). Requires auth.

## Subpage types (canonical)

```typescript
type Subpage = 'about' | 'privacy' | 'contact' | 'settings' | 'admin' | null
```

- `about` / `privacy` / `contact` — public (Phase 9)
- `settings` — authenticated only (Phase 8)
- `admin` — admin only (Phase 8)

## Auth gate model

The auth gate lives at the destination level, not the shell level. Catalogue and Gazette are public; Cabinet and all overlays require auth. This is implemented in `AppShell` via:

```typescript
const AUTH_REQUIRED_TABS: Tab[] = ['cabinet']
const AUTH_REQUIRED_OVERLAYS: Overlay[] = ['scanner', 'hatching', 'specimen']
```

When an unauthenticated user navigates to a protected destination, they see the AuthPage inline — the shell remains mounted. This avoids re-mounting the shell when auth completes and keeps the navigation state (which tab they were trying to reach) available after sign-in.

> **Phase 5 note:** When public Catalogue content exists, remove `'catalogue'` from `AUTH_REQUIRED_TABS` (it should never be there — this ADR already omits it). When sign-up CTA banners are needed on Catalogue and Gazette for unauthenticated visitors, the shell already renders these tabs for everyone.

## Trade-offs accepted

**No deep-linking:** The app has no URL router, so you cannot link directly to a specific tab or overlay via URL. Creature sharing uses the gazette feed and QR codes rather than deep-linked URLs. Accepted.

**Profile as subpage (not a tab):** Profile/settings is a subpage accessed via JournalNav (Phase 2.5). For Phase 2, sign-out lives temporarily in the Cabinet page header. This is explicitly a placeholder — see the comment in `CabinetPage.tsx`.

**State resets on tab change:** Navigating between tabs clears overlay and subpage. If a user is mid-flow in a subpage and taps a different tab, the subpage closes. Accepted as the expected behaviour for a tab-based app.

## Implications

**Phase 3:** Scanner, hatching, and specimen overlays land without requiring any App.tsx restructure. Call `setNav({ ...nav, overlay: 'scanner' })` to open the scanner; `setNav({ tab: nav.tab, overlay: null, subpage: null })` to close it.

**Phase 5:** Remove auth requirement for `catalogue`. Enable public browse with sign-up CTA banner.

**Phase 8:** Add `settings` and `admin` subpages via JournalNav gear icon. Profile UX moves from Cabinet header to settings subpage.

**Phase 9:** Add `about`, `privacy`, `contact` subpages. Add scroll-to-top on tab navigation (5-line addition to `navigateTab` function in `App.tsx`).

---

## References

- `src/components/TabBar/TabBar.tsx` — canonical type definitions for `Tab`, `Overlay`, `Subpage`
- `src/App.tsx` — `NavState`, `AUTH_REQUIRED_TABS`, `AUTH_REQUIRED_OVERLAYS`
- Spec: `SPECIFICATIONS/02-auth-design-system.md` lines 94–97 (original nav model)
- Phase 3 spec: `SPECIFICATIONS/03-creature-engine-cabinet.md`
