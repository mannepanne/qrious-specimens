# Technical Debt Tracker

**When to read this:** Planning refactors, reviewing known issues, or documenting accepted shortcuts.

**Related Documents:**
- [CLAUDE.md](./../CLAUDE.md) - Project navigation index
- [testing-strategy.md](./testing-strategy.md) - Testing strategy
- [troubleshooting.md](./troubleshooting.md) - Common issues and solutions

---

Tracks known limitations, shortcuts, and deferred improvements in the codebase.
Items here are accepted risks or pragmatic choices made during development, not bugs.

---

## Active technical debt

### TD-001: Phase 1 committed directly to main
- **Location:** Git history — all Phase 1 commits
- **Issue:** The bootstrapping work (infrastructure setup, Supabase schema, Vite scaffold, first deployment) was committed directly to `main` with no feature branches or PRs. This violated the project's core workflow rule.
- **Why accepted:** Pragmatic exception for initial project bootstrapping — there was no established `main` to branch from, no collaborators, and the work was foundational rather than incremental. Reviewed post-hoc via `/review-pr`.
- **Risk:** Low — the code has been reviewed. The risk is habit-setting: this must not become a pattern.
- **Future fix:** No code change needed. From Phase 2 onwards, all work uses feature branches + PRs without exception. Zero exceptions.
- **Phase introduced:** Phase 1

---

### TD-002: `cabinetCreaturesRef` stale across infinite-scroll page loads
- **Location:** `src/App.tsx` — `cabinetCreaturesRef`, `handleViewCreature`
- **Issue:** Opening a specimen from the cabinet snapshots the current `allCreatures` list into a ref. Subsequent infinite-scroll page fetches don't update the ref, so prev/next navigation on `SpecimenPage` operates on a stale list — creatures loaded after the snapshot are unreachable via the arrows.
- **Why accepted:** Requires a more involved refactor (lifting creature state or passing a live query reference). The failure mode is invisible to users with small cabinets (< 30 specimens). Will become noticeable only once pagination is common.
- **Risk:** Low — no data loss, no corruption. Worst case: prev/next navigation ends at the last creature in the first page.
- **Future fix:** Pass a stable reference to the live query data into `SpecimenPage`, or derive prev/next indices from the infinite query directly rather than a snapshot.
- **Phase introduced:** Phase 3

---

### Example Format: TD-001: Description
- **Location:** `src/path/to/file.ts` - `functionName()`
- **Issue:** Clear description of the limitation or shortcut
- **Why accepted:** Reason for accepting this debt (e.g., runtime constraints, time pressure, lack of alternative)
- **Risk:** Low/Medium/High - Impact assessment
- **Future fix:** Proposed solution when time/resources allow
- **Phase introduced:** Phase number when this was added

---

## Resolved items

*(Move items here when addressed, with resolution notes)*

---

## Notes

- Items are prefixed TD-NNN for easy reference in code comments and PR reviews
- When adding new debt, include: location, issue description, why accepted, risk level, and proposed future fix
- Review this list at the start of each development phase to see if any items should be addressed
- Low-risk items can remain indefinitely; High-risk items should be addressed within 2-3 phases
