-- Corrective migration: ensure page_events has the correct schema.
-- The table may have been created in a partial state without all columns.
-- Drop and recreate cleanly.

DROP TABLE IF EXISTS public.page_events;

CREATE TABLE public.page_events (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  page_name  text        NOT NULL,
  session_id text        NOT NULL,
  user_id    uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS page_events_created_at_idx ON public.page_events (created_at DESC);
CREATE INDEX IF NOT EXISTS page_events_session_id_idx ON public.page_events (session_id);

ALTER TABLE public.page_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon page event insert" ON public.page_events
  FOR INSERT TO anon
  WITH CHECK (user_id IS NULL);

CREATE POLICY "Allow auth page event insert" ON public.page_events
  FOR INSERT TO authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY "Admin can read page events" ON public.page_events
  FOR SELECT TO authenticated
  USING (public.is_admin());

NOTIFY pgrst, 'reload schema';
