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
