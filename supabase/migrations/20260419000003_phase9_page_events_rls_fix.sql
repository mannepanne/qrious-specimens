-- Phase 9: Tighten page_events INSERT policies to prevent user_id spoofing
-- Replaces the open WITH CHECK (true) policy with two role-specific policies:
--   anon:          user_id must be NULL (anonymous visits cannot claim a user identity)
--   authenticated: user_id must match auth.uid() or be NULL

DROP POLICY IF EXISTS "Allow page event insert" ON public.page_events;

-- Anon visitors: must leave user_id null
CREATE POLICY "Allow anon page event insert" ON public.page_events
  FOR INSERT TO anon
  WITH CHECK (user_id IS NULL);

-- Authenticated users: user_id must match their own session or be null
CREATE POLICY "Allow auth page event insert" ON public.page_events
  FOR INSERT TO authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());
