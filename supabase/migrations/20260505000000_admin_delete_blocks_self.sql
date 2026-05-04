-- Block self-deletion in admin_delete_user_data().
--
-- TD-023 (REFERENCE/technical-debt.md): the previous version allowed an admin
-- to delete their own account, which under the single-admin model would lock
-- the project out of its own admin surface (recovery requires direct DB
-- access via Supabase Studio to flip is_admin = true on a freshly-seeded
-- account). Operational footgun, not a security vulnerability.
--
-- Defence-in-depth alongside the UI guard in AdminPage (different dialog
-- copy when targeting self) and the Worker-level guard in
-- workers/admin-delete-user/index.ts (returns 400 'self_delete_blocked').
-- This DB-level check ensures the protection holds even if a future Worker
-- route or some other admin path calls the RPC directly.
--
-- Re-issues admin_delete_user_data() via CREATE OR REPLACE preserving the
-- TD-018 first-discoverer anonymisation behaviour and the TD-020
-- search_path = public hardening. GRANTs survive CREATE OR REPLACE.

CREATE OR REPLACE FUNCTION public.admin_delete_user_data(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot delete the calling admin' USING ERRCODE = '42501';
  END IF;

  UPDATE species_discoveries SET first_discoverer_id = NULL WHERE first_discoverer_id = p_user_id;
  UPDATE species_images      SET first_discoverer_id = NULL WHERE first_discoverer_id = p_user_id;

  DELETE FROM creatures         WHERE user_id = p_user_id;
  DELETE FROM explorer_badges   WHERE user_id = p_user_id;
  DELETE FROM activity_feed     WHERE user_id = p_user_id;
  DELETE FROM explorer_profiles WHERE user_id = p_user_id;
  DELETE FROM profiles          WHERE id      = p_user_id;
END;
$$;
