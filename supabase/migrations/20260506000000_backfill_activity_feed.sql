-- Backfill activity_feed entries that the client failed to write.
--
-- Phase 6's usePostActivity insert never sent user_id. The activity_feed.user_id
-- column is NOT NULL with no default, so every insert from the rewritten client
-- failed (the error-toast surfacing landed only in Phase 9, so the failures were
-- silent for most of the launch). The 28-day-old entries currently in the table
-- come from the original Lovable database import, not the live app.
--
-- Strategy: for each currently-public explorer, replay any creature discoveries
-- and badge awards that occurred AFTER the user's most recent activity_feed
-- entry of the same kind. Idempotent: re-running picks up only what is newer
-- than what is there.
--
-- Privacy scope: ep.is_public is evaluated at migration run-time, not at
-- discovery time. Historical visibility state is not recorded anywhere, so a
-- user who discovered while private and has since toggled public will see
-- those discoveries appear retroactively in the Gazette; a user who was
-- public at discovery time but is now private will not be backfilled. This
-- is the only pragmatic option given the missing audit trail.

-- Discovery / first_discovery backfill from creatures
INSERT INTO public.activity_feed (user_id, event_type, species_name, qr_hash, created_at)
SELECT
  c.user_id,
  CASE WHEN c.is_first_discoverer THEN 'first_discovery' ELSE 'discovery' END,
  trim(coalesce(c.dna->>'genus', '') || ' ' || coalesce(c.dna->>'species', '')),
  c.dna->>'hash',
  c.discovered_at
FROM public.creatures c
JOIN public.explorer_profiles ep ON ep.user_id = c.user_id AND ep.is_public = true
WHERE c.discovered_at > COALESCE(
  (
    SELECT MAX(af.created_at)
    FROM public.activity_feed af
    WHERE af.user_id = c.user_id
      AND af.event_type IN ('discovery', 'first_discovery', 'rare_discovery')
  ),
  '-infinity'::timestamptz
);

-- Badge_earned backfill from explorer_badges
INSERT INTO public.activity_feed (user_id, event_type, badge_slug, created_at)
SELECT
  eb.user_id,
  'badge_earned',
  eb.badge_slug,
  eb.earned_at
FROM public.explorer_badges eb
JOIN public.explorer_profiles ep ON ep.user_id = eb.user_id AND ep.is_public = true
WHERE eb.earned_at > COALESCE(
  (
    SELECT MAX(af.created_at)
    FROM public.activity_feed af
    WHERE af.user_id = eb.user_id
      AND af.event_type = 'badge_earned'
  ),
  '-infinity'::timestamptz
);
