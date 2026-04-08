# Phase 6: The Explorer's Gazette

## Phase overview

**Phase number:** 6
**Phase name:** The Explorer's Gazette
**Dependencies:** Phase 5 complete — catalogue working; Phase 4 complete — discoveries being registered and written to activity_feed

**Brief description:**
Builds the community layer of the app — the Gazette tab. This includes a chronological activity timeline of public discoveries and badge awards, an Explorer Showcase grid of public profiles, community-wide statistics, and the flow for users to create or update their public Gazette profile. A user's discoveries only appear in the Gazette if they have a public profile. By the end of this phase, the app feels like a living community, not just a personal collection.

---

## Scope and deliverables

### In scope
- [ ] `CommunityPage` (the Gazette tab) — full layout with timeline, showcase, and stats sections
- [ ] **Activity Timeline** — chronological feed of public discoveries and badge awards
  - Discovery entries: explorer display name, species name, thumbnail, time ago; click → species in Catalogue
  - Badge entries: badge icon, name, explorer name
  - Colour-coded dots: emerald (discovery), purple (first discovery), amber (rare species), blue (badge)
- [ ] **Explorer Showcase** — grid of public explorer profiles: avatar (initials), display name, specimen count, earned badge icons
- [ ] **Community Stats** bar — total explorers, total specimens, total species discovered
- [ ] **Join Prompt** — for users without a Gazette profile, show a form to create one: display name field, public/private toggle, sparkle button for random Victorian-style name generation
- [ ] `explorerNames.ts` — Victorian explorer name generator (list of plausible Victorian surnames + titles + initials)
- [ ] `useCommunity` hook — wraps `get_community_feed`, `get_explorer_showcase`, `get_community_stats` RPCs; also handles creating/updating explorer profiles and toggling visibility
- [ ] When a discovery is registered (Phase 4), write an entry to `activity_feed` if the user has a public profile
- [ ] Sign-up CTA banner for unauthenticated visitors (Gazette is read-only without account)
- [ ] Real-time feed updates (optional — Supabase Realtime subscription on `activity_feed`; deprioritise if complex)
- [ ] Tests for `useCommunity`, name generator, feed rendering

### Out of scope
- Badge display in showcase (badges are awarded in Phase 7; Gazette profile grid shows badge icons, but the awarding logic is Phase 7)
- Explorer rank display (Phase 7)

### Acceptance criteria
- [ ] Activity timeline shows public discoveries in reverse-chronological order
- [ ] Each timeline entry correctly colour-codes by event type
- [ ] Clicking a discovery entry navigates to that species in the Catalogue
- [ ] Explorer Showcase shows all public profiles with correct stats
- [ ] Community stats are accurate
- [ ] User without a Gazette profile sees the Join Prompt
- [ ] Sparkle button generates a Victorian-style explorer name
- [ ] Submitting Join Prompt creates an `explorer_profiles` record
- [ ] User can toggle their profile between public and private
- [ ] Private profile's discoveries do not appear in the timeline
- [ ] Unauthenticated visitor sees Gazette as read-only with CTA
- [ ] `bun run test` passes; `bun run typecheck` passes

---

## Technical approach

### Architecture decisions

**Activity feed write timing**
- Choice: Write to `activity_feed` from the frontend after successful `register_discovery` RPC call, only if the user has a public explorer profile
- Rationale: Simpler than adding activity feed writes to the Worker; the frontend already knows the user's profile status
- Alternative considered: Write from within the `register_discovery` RPC — rejected because the RPC doesn't know the user's profile visibility preference without an additional join

**Explorer name generator**
- Choice: Client-side list of ~100 Victorian surnames + ~20 honorifics/titles + initials pattern
- Style: "Captain R. Huxley", "Dr. E. Blackwood", "Prof. M. Sedgwick" — the kind of names that appear on expedition manifests
- Subtle Anning nod: "M. Anning" is the default placeholder throughout the app (already in the original); the name list includes "A. Anning" as an Easter egg

**Gazette profile privacy**
- `explorer_profiles.is_public = false` → that user's activity feed entries are hidden (enforced by RLS on `activity_feed` table — existing policy from migrations)

### Key files

```
src/
├── pages/
│   └── CommunityPage.tsx
├── hooks/
│   ├── useCommunity.ts
│   └── useCommunity.test.ts
├── lib/
│   ├── explorerNames.ts
│   └── explorerNames.test.ts
├── components/
│   ├── ActivityTimeline/
│   │   └── ActivityTimeline.tsx
│   ├── ExplorerShowcase/
│   │   └── ExplorerShowcase.tsx
│   ├── CommunityStats/
│   │   └── CommunityStats.tsx
│   └── GazetteJoinPrompt/
│       └── GazetteJoinPrompt.tsx
```

---

## Testing strategy

### Unit tests

**`explorerNames.test.ts`**
- `generateExplorerName()` returns a string
- Generated names match expected format (title + initial + surname)
- Calling multiple times produces variety (statistical test over N iterations)

**`useCommunity.test.ts`**
- Feed loads and returns typed entries
- `createExplorerProfile` mutation creates profile record
- `toggleProfileVisibility` updates `is_public` field

**`ActivityTimeline` rendering**
- Discovery entries render with correct colour dot
- First-discovery entries render with purple dot
- Badge entries render with blue dot
- Time-ago formatting is correct (1 minute ago, 3 hours ago, 2 days ago)

### Manual testing checklist
- [ ] Gazette tab loads with timeline, showcase, and stats
- [ ] My recent discoveries appear in timeline (if profile is public)
- [ ] Clicking a timeline entry navigates to the correct species in Catalogue
- [ ] Explorer Showcase shows my profile card
- [ ] My specimen count is correct in the showcase
- [ ] Join Prompt appears before I create a profile
- [ ] Sparkle button generates a different name each click
- [ ] Setting profile to private removes my entries from the timeline
- [ ] Setting back to public restores them

---

## Pre-commit checklist

- [ ] `bun run test` passes
- [ ] `bun run typecheck` passes
- [ ] Private profile RLS verified: unauthenticated user cannot see private profile's entries
- [ ] Timeline handles empty state (no public discoveries yet)

---

## PR workflow

### Branch naming
```
feature/phase-6-gazette
```

### Review requirements
- Use `/review-pr` — no security concerns beyond existing RLS; standard community feature

---

## Edge cases and considerations

### Known risks
- **Feed ordering on tie:** Multiple discoveries in the same second — tie-break by `id` or `created_at` microseconds
- **Display name uniqueness:** Gazette display names are not unique (two users could pick "Dr. R. Blackwood"). This is intentional and fine — they're flavour, not identifiers.

### Mary Anning connection
- The Gazette header and "Join the Expedition" prompt are excellent places for Anning references. She was effectively the curator of a living catalogue of species — the Gazette is the same idea: a shared, public record of discovery. Consider a small quote or paraphrase from one of the letters she sent to the Geological Society.

---

## Related documentation

- [Phase 5](./05-catalogue.md) — Prerequisite
- [Phase 7](./07-gamification.md) — Adds badge entries to the activity feed
- [Master specification](./ORIGINAL_IDEA/SPEC-DOWNLOADED-ORIGINAL-IMPLEMENTATION.md) — Gazette section
- Reference: `downloads-claude-ship/qrious-project-code-2e8ffbe/src/pages/CommunityPage.tsx`
