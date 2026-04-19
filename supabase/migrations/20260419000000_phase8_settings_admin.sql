-- Phase 8: Settings & Admin
-- contact_messages table, admin helper function, and admin RPCs.
-- All statements are idempotent (IF NOT EXISTS / CREATE OR REPLACE) so this
-- migration is safe to apply against an already-populated Supabase project
-- where these objects were created directly from the prototype.

-- ── contact_messages ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.contact_messages (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_email text        NOT NULL,
  sender_name  text,
  message      text        NOT NULL,
  created_at   timestamptz DEFAULT now(),
  read         boolean     DEFAULT false
);

ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anonymous insert" ON public.contact_messages;
CREATE POLICY "Allow anonymous insert" ON public.contact_messages
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admin can read messages" ON public.contact_messages;
CREATE POLICY "Admin can read messages" ON public.contact_messages
  FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admin can update messages" ON public.contact_messages;
CREATE POLICY "Admin can update messages" ON public.contact_messages
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── is_admin() helper ─────────────────────────────────────────────────────────
-- Returns true when the currently authenticated user has is_admin = true
-- in the profiles table. Used by RLS policies and admin RPCs.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.profiles WHERE id = (SELECT auth.uid())),
    false
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ── admin_list_users() ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE(
  user_id      uuid,
  email        text,
  display_name text,
  created_at   timestamptz,
  creature_count bigint,
  is_admin     boolean
) AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT
    p.id AS user_id,
    u.email::text,
    p.display_name,
    p.created_at,
    (SELECT COUNT(*) FROM creatures c WHERE c.user_id = p.id) AS creature_count,
    p.is_admin
  FROM profiles p
  JOIN auth.users u ON u.id = p.id
  ORDER BY p.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── admin_export_user_data() ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_export_user_data(p_user_id uuid)
RETURNS jsonb AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT jsonb_build_object(
    'profile',   (SELECT to_jsonb(p) FROM profiles p WHERE p.id = p_user_id),
    'email',     (SELECT u.email FROM auth.users u WHERE u.id = p_user_id),
    'creatures', COALESCE(
      (SELECT jsonb_agg(to_jsonb(c)) FROM creatures c WHERE c.user_id = p_user_id),
      '[]'::jsonb
    ),
    'exported_at', now()
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── admin_delete_user_data() ──────────────────────────────────────────────────
-- Deletes all user data in the public schema. Does NOT delete the auth.users
-- record — that requires Supabase auth admin API.

CREATE OR REPLACE FUNCTION public.admin_delete_user_data(p_user_id uuid)
RETURNS void AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  DELETE FROM creatures       WHERE user_id = p_user_id;
  DELETE FROM explorer_badges WHERE user_id = p_user_id;
  DELETE FROM activity_feed   WHERE user_id = p_user_id;
  DELETE FROM explorer_profiles WHERE user_id = p_user_id;
  DELETE FROM profiles        WHERE id      = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── admin_get_stats() ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_get_stats()
RETURNS json AS $$
  SELECT json_build_object(
    'total_users',           (SELECT COUNT(*) FROM auth.users),
    'users_with_specimens',  (SELECT COUNT(DISTINCT user_id) FROM public.creatures),
    'unique_specimens',      (SELECT COUNT(DISTINCT qr_hash) FROM public.creatures),
    'total_discoveries',     (SELECT COUNT(*) FROM public.creatures),
    'total_field_notes',     (SELECT COUNT(*) FROM public.species_images WHERE field_notes IS NOT NULL),
    'contact_submissions',   (SELECT COUNT(*) FROM public.contact_messages)
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Grant execute to authenticated users (RPC enforces is_admin() internally)
GRANT EXECUTE ON FUNCTION public.admin_list_users()               TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_export_user_data(uuid)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_user_data(uuid)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_stats()                TO authenticated;
