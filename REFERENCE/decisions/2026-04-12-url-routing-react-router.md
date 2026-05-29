# ADR: URL-based routing with React Router

**Date:** 2026-04-12
**Status:** Active
**Supersedes:** [2026-04-09-layered-navigation-model.md](./2026-04-09-layered-navigation-model.md)

---

## Decision

The app uses React Router for navigation. Every distinct page has its own URL (bookmarkable, shareable, browser-history-aware). The two transient, camera-bound ceremonies — the QR scanner and the excavation animation — remain as `useState` overlays inside the `AppShell` layout route rather than as routes.

## Context

The [layered navigation model](./2026-04-09-layered-navigation-model.md) (three days earlier) deliberately chose a hand-rolled `{ tab, overlay, subpage }` state model and **rejected a URL router**. Its reasoning was that this is a mobile-first SPA where deep-linking to specific creatures would be handled via QR codes, and sharing would be done through the Gazette feed — so a router added bundle size and complexity for no benefit.

That premise did not survive contact with the public surfaces built in Phases 5–6. The Catalogue, the Gazette, and individual species pages are genuinely public, link-worthy content: a naturalist wants to send someone a link to a *specific species*, a visitor wants to bookmark the Catalogue, and the browser back button must behave. A QR code is how you *discover* a creature in the world; it is not how you *link* to one inside the app. The original ADR conflated the two.

A flat in-memory model also could not give us bookmarkable detail pages, history-aware back navigation, or per-page analytics without re-inventing a router by hand.

## Alternatives considered

- **Keep the hand-rolled `{ tab, overlay, subpage }` state (status quo):** No library dependency, already shipped. But it cannot produce real URLs — no bookmarking, no shareable species links, no browser history, no clean per-route page-view tracking. Rejected: the public content that arrived in Phases 5–6 made linkability a requirement, not a nice-to-have.
- **Put *everything* on routes, including the scanner and excavation overlays:** Maximally uniform. Rejected: those two are transient, camera-based ceremonies tied to a precise animation lifecycle, not destinations a user would bookmark or navigate back to. A `/scanner` URL that resurrects a dead camera session on refresh is a worse experience, not a better one.
- **Chosen: React Router for pages, overlay state for the two ceremonies:** Real URLs for everything link-worthy; overlays kept as local state where a URL would be meaningless. Auth guard lives once in the `AppShell` layout route.

## Reasoning

**Public, shareable content is the whole point of the Catalogue and Gazette.** Once those exist, every page below them wants a URL. `/species/:qrHash` lets a naturalist link a single species; `/catalogue` and `/gazette` are bookmarkable; `/specimen/:id` gives the personal cabinet real back-button behaviour.

**The auth guard belongs in the layout route.** `AppShell` mounts once and renders the active page into an `<Outlet>`. A single `useAuth()` instance there avoids the multiple-Supabase-subscription problems that a per-page guard would create, and an unauthenticated hit on a protected prefix is a synchronous `<Navigate to="/enter" />`. Because the shell never unmounts, the route a visitor was reaching for survives the sign-in round-trip.

**Detail pages take a fast path and a fallback.** In-app navigation passes the creature/species through `location.state` so the detail page renders instantly with no round-trip. Direct URL access (a bookmark or shared link, where there is no prior history) falls back to a DB fetch — `get_species_by_hash` RPC for `/species/:qrHash`, `useCreatureById` for `/specimen/:id` — and `navigate(-1)` degrades to a sensible default (`/` or `/cabinet`) when `location.key` is `'default'`.

**The two ceremonies stay as overlays** for the reasons the original ADR got right: they must be full-screen with no tab bar, and they are transient. Keeping them as `AppShell` state preserves that behaviour without a meaningless URL.

## Trade-offs accepted

**A routing-library dependency.** React Router is now a hard dependency and adds to the bundle. Accepted — the linkability it buys is now a product requirement, and the hand-rolled alternative was trending towards re-implementing a router anyway.

**Tests run on `MemoryRouter`, production on `BrowserRouter`.** App and page tests render `AppRoutes` inside a `MemoryRouter` to avoid a jsdom `AbortSignal` conflict in data-router mode. The route tree is exported so tests share the exact same routes as production.

**Detail-page data has two code paths** (location-state fast path + DB fallback). Slightly more surface to maintain than a single fetch, but it is what makes both in-app navigation feel instant *and* direct URLs work at all.

## Implications

- Adding a page means adding a route to the exported route tree in `src/App.tsx`; auth-gating it means adding its prefix to the protected-prefix check in `AppShell`.
- The tab bar is now a set of `NavLink`s deriving active state from the URL, and is hidden by path prefix (`/species/`, `/specimen/`) or while an overlay is open.
- Per-route page-view tracking falls out naturally from `location.pathname` changes (`useTrackPageView`).
- Direct URL access to any detail page must keep working — new detail routes need a DB fallback, not only a location-state path.

---

## References

- Supersedes: [2026-04-09-layered-navigation-model.md](./2026-04-09-layered-navigation-model.md)
- Implementation: PR #11 (`feat: URL-based routing with React Router v6`), commit `9d9cf16`
- `src/App.tsx` — `AppShell` layout route, exported `AppRoutes` tree, protected-prefix auth guard, overlay state
- `supabase/migrations/20260412000001_get_species_by_hash.sql` — single-entry-by-hash RPC for direct URL access
- Architecture overview: [ARCHITECTURE.md](../../ARCHITECTURE.md#the-frontend)
