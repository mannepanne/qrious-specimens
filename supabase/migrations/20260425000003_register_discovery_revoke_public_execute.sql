-- Lock down register_discovery to service-role callers only.
--
-- The function is SECURITY DEFINER and accepts `p_user_id uuid` from the caller.
-- With the recent change in 20260425000002, that parameter now controls both
-- the species_discoveries write AND the creatures.is_first_discoverer write.
-- A direct PostgREST caller with a JWT could spoof p_user_id to set the badge
-- on another user's creature row.
--
-- The only legitimate caller is the Cloudflare Worker (workers/generate-creature),
-- which uses SUPABASE_SERVICE_ROLE_KEY. Postgres' default grants `EXECUTE` to
-- PUBLIC for every new function, so an authenticated or anon caller could in
-- principle invoke this RPC directly via PostgREST. Revoke that default and
-- explicitly grant EXECUTE only to the service role.
--
-- Related: TD-006 (register_discovery accepts arbitrary p_user_id without auth check)

REVOKE EXECUTE ON FUNCTION public.register_discovery(text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.register_discovery(text, uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.register_discovery(text, uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.register_discovery(text, uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
