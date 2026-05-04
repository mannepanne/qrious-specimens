-- ============================================================
-- TD-014: Allow users to delete their own activity_feed entries
-- ============================================================
-- Closes the GDPR right-to-erasure gap at the row level. Account-level
-- erasure is already covered by admin_delete_user_data(); this policy
-- adds the matching self-service capability so a user (or PostgREST
-- client acting on their behalf) can remove individual entries instead
-- of being forced to flip is_public on the explorer profile.
--
-- Mirrors the shape of "Read own activity" / "Insert own activity":
-- gated to authenticated, USING auth.uid() match. The (SELECT auth.uid())
-- form lets Postgres hoist it to an InitPlan once per statement rather
-- than evaluating per row, matching the convention used elsewhere in
-- this migration set.
-- ============================================================

DROP POLICY IF EXISTS "Delete own activity" ON public.activity_feed;
CREATE POLICY "Delete own activity" ON public.activity_feed
  FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));
