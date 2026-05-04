-- Anonymise first-discoverer references when a user is deleted.
--
-- TD-018 (REFERENCE/technical-debt.md): the privacy policy commits to
-- "your name is removed from the public record, but the species and its
-- discovery date are kept" on account deletion. The previous version of
-- admin_delete_user_data() removed the user's profile but left
-- species_discoveries.first_discoverer_id and species_images.first_discoverer_id
-- pointing at the now-deleted user, leaving a dangling foreign-key reference
-- and contradicting the policy.
--
-- The catalogue RPCs (get_catalogue, get_species_by_hash) coalesce
-- sd.first_discoverer_id with si.first_discoverer_id, so both columns must
-- be nulled. UI surfaces (SpeciesDetail, useFirstDiscoverer) already handle
-- a null discoverer gracefully — they fall back to no "first by" credit.
--
-- The UPDATEs run before the DELETE FROM profiles so that any FK constraint
-- is satisfied regardless of its ON DELETE rule.
--
-- This migration also backfills any orphaned references from earlier
-- deletions performed under the previous RPC: the standalone UPDATE pair
-- below the function nulls first_discoverer_id wherever no matching profile
-- row exists. profiles is the semantic anchor for "removed from the public
-- record" — auth.users may retain a row until a separate Admin API call
-- erases it (see TD-019).
--
-- See 20260419000000_phase8_settings_admin.sql for the contact_messages
-- retention rationale (ADR 2026-04-19-retain-contact-messages-on-gdpr-delete).

CREATE OR REPLACE FUNCTION public.admin_delete_user_data(p_user_id uuid)
RETURNS void AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE species_discoveries SET first_discoverer_id = NULL WHERE first_discoverer_id = p_user_id;
  UPDATE species_images      SET first_discoverer_id = NULL WHERE first_discoverer_id = p_user_id;

  DELETE FROM creatures         WHERE user_id = p_user_id;
  DELETE FROM explorer_badges   WHERE user_id = p_user_id;
  DELETE FROM activity_feed     WHERE user_id = p_user_id;
  DELETE FROM explorer_profiles WHERE user_id = p_user_id;
  DELETE FROM profiles          WHERE id      = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Backfill: clear orphaned first_discoverer_id references left behind by
-- account deletions performed under the previous RPC. Idempotent and bounded.
UPDATE species_discoveries SET first_discoverer_id = NULL
  WHERE first_discoverer_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = first_discoverer_id);

UPDATE species_images SET first_discoverer_id = NULL
  WHERE first_discoverer_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = first_discoverer_id);
