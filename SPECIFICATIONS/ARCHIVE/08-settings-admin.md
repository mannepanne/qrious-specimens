# Phase 8: Settings & admin

## Phase overview

**Phase number:** 8
**Phase name:** Settings & admin
**Dependencies:** Phase 7 complete — badges and rank system in place

**Brief description:**
Builds the Settings subpage (account management, Gazette profile, achievements display) and the Admin dashboard (site-wide stats, user management, contact inbox, GDPR tools). Settings is accessible to all authenticated users; Admin is gated to Magnus's account via `is_admin = true` in profiles. This phase completes the full authenticated user experience.

---

## Scope and deliverables

### In scope

**Settings subpage (`AccountSettings`):**
- [ ] Two-column desktop layout (`max-w-3xl`, left: achievements, right: settings)
- [ ] Left column — **Achievements:**
  - `ExplorerRankCard` (from Phase 7) — rank, progress, stat grid
  - `BadgeCollection` (from Phase 7) — all badges, earned/locked state
- [ ] Right column — **Settings:**
  - **Gazette Profile section:** display name field (with sparkle regeneration + confirmation dialog), public/private toggle
  - **Account section:** email address display (read-only; labelled "Correspondence Address")
  - **Information section:** About link, Privacy link, sign-out button, Admin link (if admin)
- [ ] Sparkle name regeneration confirmation dialog (to avoid accidentally overwriting a display name the user likes)
- [ ] `useIsAdmin` hook — checks `is_admin` flag in profile

**Admin subpage (`AdminPage`):**
- [ ] Dashboard stats: total users, users with specimens, unique species, total discoveries, field notes generated, contact submissions, page views
- [ ] User list: email, display name, specimen count, admin status
- [ ] Contact messages inbox: read/unread status, mark as read
- [ ] GDPR tools:
  - Export user data (calls `admin_export_user_data` RPC → downloads JSON)
  - Delete user data (calls `admin_delete_user_data` RPC → confirmation dialog required)
- [ ] Admin is only accessible to users where `profiles.is_admin = true`
- [ ] `magnus.hultberg@gmail.com` is the admin account

**Shared:**
- [ ] Keyboard navigation and accessibility on all forms
- [ ] Tests for settings mutations, admin gate, GDPR confirmation flows

### Out of scope
- Email change (magic link means email change requires a Supabase auth flow — out of scope for now; document as future work)
- Two-factor authentication

### Acceptance criteria
- [ ] Settings subpage renders with rank card, badge collection, and all settings sections
- [ ] Display name update saves and reflects immediately
- [ ] Sparkle button generates a new name; confirmation dialog appears before saving
- [ ] Public/private toggle updates `explorer_profiles.is_public`
- [ ] Admin link visible in Settings for Magnus's account only
- [ ] Admin page shows correct stats
- [ ] Admin user list shows all users
- [ ] Contact messages show read/unread state; marking as read persists
- [ ] GDPR export downloads a JSON file with user data
- [ ] GDPR delete requires explicit confirmation; deletes user data
- [ ] Non-admin users cannot navigate to Admin page
- [ ] `bun run test` passes; `bun run typecheck` passes

---

## Technical approach

### Admin gate

```typescript
// useIsAdmin.ts
const { data: isAdmin } = useQuery({
  queryKey: ['isAdmin', userId],
  queryFn: () => supabase.rpc('is_admin').single()
})
```

Admin page route guarded by `isAdmin` check. If `false` or loading, redirect to Cabinet tab. The `is_admin` RLS helper function is already in the database from migrations.

### GDPR export

`admin_export_user_data(target_user_id)` RPC returns a JSON blob of all user data. The frontend triggers a download using:
```typescript
const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
const url = URL.createObjectURL(blob)
// trigger download
```

### GDPR delete

Requires a two-step confirmation: first click → dialog appears with the words "DELETE USER DATA" to type; second click → confirms. This prevents accidental deletion.

### Key files

```
src/
├── pages/
│   ├── AccountSettings.tsx     # Settings subpage
│   └── AdminPage.tsx           # Admin dashboard
├── hooks/
│   ├── useIsAdmin.ts
│   └── useIsAdmin.test.ts
```

The `ExplorerRankCard` and `BadgeCollection` from Phase 7 are composed directly into `AccountSettings`.

---

## Testing strategy

### Unit tests

**`useIsAdmin.test.ts`**
- Returns `true` for admin user
- Returns `false` for non-admin user
- Returns `false` on error (fail-safe)

**Admin access gate test**
- Non-admin user navigating to admin subpage is redirected

**GDPR flow tests**
- Export triggers download with correct data shape
- Delete confirmation dialog prevents single-click deletion

### Manual testing checklist
- [ ] Settings opens from tab bar or Settings link
- [ ] Rank card shows correct rank and progress
- [ ] Badge collection shows all 10 badges with correct earned/locked state
- [ ] Display name update persists across page reload
- [ ] Sparkle button + confirmation dialog flow works
- [ ] Public/private toggle works; verify Gazette feed updates
- [ ] Admin link only visible when logged in as magnus.hultberg@gmail.com
- [ ] Admin stats page shows correct numbers
- [ ] Admin user list shows all registered users
- [ ] Contact message marked as read persists
- [ ] GDPR export downloads valid JSON
- [ ] GDPR delete — typing wrong phrase prevents deletion; correct phrase + confirm → data deleted

---

## Pre-commit checklist

- [ ] `bun run test` passes
- [ ] `bun run typecheck` passes
- [ ] Admin RPCs verified to reject non-admin callers (RLS test)
- [ ] GDPR delete tested with a test account (not Magnus's real data)
- [ ] No hardcoded admin user IDs in source code (admin check goes through RPC/DB, not client-side)

---

## PR workflow

### Branch naming
```
feature/phase-8-settings-admin
```

### Review requirements
- Use `/review-pr-team` — admin features and GDPR tools are security-sensitive; data deletion is irreversible

---

## Edge cases and considerations

### Known risks
- **GDPR delete irreversibility:** This permanently deletes a user's data. The confirmation dialog must be unambiguous. Consider logging the deletion event to a separate admin audit log.
- **Admin check client-side:** The admin gate is client-side (hide the UI), but the actual RPCs must also enforce admin-only access via RLS. Never rely solely on client-side admin checks. The existing RLS policies from migrations enforce this at the database level.

---

## Related documentation

- [Phase 7](./07-gamification.md) — Prerequisite (rank card and badge collection)
- [Phase 9](./09-polish-launch.md) — Final phase
- [Master specification](./ORIGINAL_IDEA/SPEC-DOWNLOADED-ORIGINAL-IMPLEMENTATION.md) — Settings and Admin sections
- Reference: `downloads-claude-ship/qrious-project-code-2e8ffbe/src/components/AccountSettings/`
