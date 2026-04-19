-- Phase 9: Page events table for internal session analytics
-- Lightweight tab-visit tracking to complement Cloudflare Web Analytics.
-- user_id is nullable (anonymous visits not linked to an account).
-- session_id is a client-generated UUID stored in sessionStorage.

CREATE TABLE IF NOT EXISTS public.page_events (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  page_name  text        NOT NULL,
  session_id text        NOT NULL,
  user_id    uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Index for admin queries (recent events, events by session)
CREATE INDEX IF NOT EXISTS page_events_created_at_idx ON public.page_events (created_at DESC);
CREATE INDEX IF NOT EXISTS page_events_session_id_idx ON public.page_events (session_id);

ALTER TABLE public.page_events ENABLE ROW LEVEL SECURITY;

-- Anyone (anon or authenticated) can insert their own page events
DROP POLICY IF EXISTS "Allow page event insert" ON public.page_events;
CREATE POLICY "Allow page event insert" ON public.page_events
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Only admins can read page events (for analytics dashboard)
DROP POLICY IF EXISTS "Admin can read page events" ON public.page_events;
CREATE POLICY "Admin can read page events" ON public.page_events
  FOR SELECT TO authenticated
  USING (public.is_admin());
