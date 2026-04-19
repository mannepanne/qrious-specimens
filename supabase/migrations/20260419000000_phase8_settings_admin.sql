-- Phase 8: Settings & Admin
-- contact_messages table, admin helper function, and admin RPCs.
-- All statements are idempotent (IF NOT EXISTS / CREATE OR REPLACE) so this
-- migration is safe to apply against an already-populated Supabase project
-- where these objects were created directly from the prototype.

-- ── is_admin() helper ─────────────────────────────────────────────────────────
-- Defined first so RLS policies on contact_messages can reference it.
-- Returns true when the currently authenticated user has is_admin = true
-- in the profiles table. Used by RLS policies and admin RPCs.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.profiles WHERE id = (SELECT auth.uid())),
    false
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ── contact_messages ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.contact_messages (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_email text        NOT NULL,
  sender_name  text,
  message      text        NOT NULL,
  CHECK (length(message) <= 5000 AND length(sender_email) <= 320 AND (sender_name IS NULL OR length(sender_name) <= 200)),
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
-- Exports all personal data for a user (GDPR Article 15 right of access).
-- Covers the same tables as admin_delete_user_data, plus contact_messages by email.

CREATE OR REPLACE FUNCTION public.admin_export_user_data(p_user_id uuid)
RETURNS jsonb AS $$
DECLARE
  result jsonb;
  user_email text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT u.email INTO user_email FROM auth.users u WHERE u.id = p_user_id;

  SELECT jsonb_build_object(
    'profile',          (SELECT to_jsonb(p) FROM profiles p WHERE p.id = p_user_id),
    'email',            user_email,
    'creatures',        COALESCE(
      (SELECT jsonb_agg(to_jsonb(c)) FROM creatures c WHERE c.user_id = p_user_id),
      '[]'::jsonb
    ),
    'explorer_profile', (SELECT to_jsonb(ep) FROM explorer_profiles ep WHERE ep.user_id = p_user_id),
    'explorer_badges',  COALESCE(
      (SELECT jsonb_agg(to_jsonb(eb)) FROM explorer_badges eb WHERE eb.user_id = p_user_id),
      '[]'::jsonb
    ),
    'activity',         COALESCE(
      (SELECT jsonb_agg(to_jsonb(af)) FROM activity_feed af WHERE af.user_id = p_user_id),
      '[]'::jsonb
    ),
    'contact_messages', COALESCE(
      (SELECT jsonb_agg(to_jsonb(cm)) FROM contact_messages cm WHERE cm.sender_email = user_email),
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
-- Delete order respects any FK dependencies: creatures/badges/activity before profiles.
--
-- INTENTIONAL: contact_messages are NOT deleted, even when the user requests erasure.
-- Contact messages are organisational correspondence (messages sent TO us), not
-- user-generated content owned by the user. Retaining them allows us to demonstrate
-- that we received and acted on the user's requests, which is a legitimate interest
-- under GDPR Recital 47 and a legal record-keeping requirement. The sender_email field
-- in retained messages does not reference auth.users, so it persists independently.
-- See ADR: REFERENCE/decisions/2026-04-19-retain-contact-messages-on-gdpr-delete.md

CREATE OR REPLACE FUNCTION public.admin_delete_user_data(p_user_id uuid)
RETURNS void AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  DELETE FROM creatures         WHERE user_id = p_user_id;
  DELETE FROM explorer_badges   WHERE user_id = p_user_id;
  DELETE FROM activity_feed     WHERE user_id = p_user_id;
  DELETE FROM explorer_profiles WHERE user_id = p_user_id;
  DELETE FROM profiles          WHERE id      = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── admin_get_stats() ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_get_stats()
RETURNS json AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN (SELECT json_build_object(
    'total_users',           (SELECT COUNT(*) FROM auth.users),
    'users_with_specimens',  (SELECT COUNT(DISTINCT user_id) FROM public.creatures),
    'unique_specimens',      (SELECT COUNT(DISTINCT qr_hash) FROM public.creatures),
    'total_discoveries',     (SELECT COUNT(*) FROM public.creatures),
    'total_field_notes',     (SELECT COUNT(*) FROM public.species_images WHERE field_notes IS NOT NULL),
    'contact_submissions',   (SELECT COUNT(*) FROM public.contact_messages)
  ));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Grant execute to authenticated users (each RPC enforces is_admin() internally)
GRANT EXECUTE ON FUNCTION public.is_admin()                        TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_users()               TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_export_user_data(uuid)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_user_data(uuid)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_stats()                TO authenticated;
