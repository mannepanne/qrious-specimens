-- Phase 8 admin RPC search_path hardening (TD-020).
--
-- Phase 6 / Phase 9 SECURITY DEFINER RPCs explicitly SET search_path = public
-- to prevent search-path-injection attacks (where a hostile user creates
-- objects in their own schema that shadow public.* references). The Phase 8
-- admin cluster predates that convention. This migration re-issues the four
-- remaining admin RPCs (is_admin, admin_list_users, admin_export_user_data,
-- admin_get_stats) with the setting added. admin_delete_user_data was
-- redefined with search_path in 20260504000000_admin_delete_anonymises_first_discoverer.sql.
--
-- No behavioural change — function bodies are unchanged. GRANTs survive
-- CREATE OR REPLACE so no re-grant is required.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.profiles WHERE id = (SELECT auth.uid())),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE(
  user_id      uuid,
  email        text,
  display_name text,
  created_at   timestamptz,
  creature_count bigint,
  is_admin     boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.admin_export_user_data(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.admin_get_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
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
$$;
