-- Remove the unused 'rare_discovery' event_type from activity_feed.
--
-- The Field Dispatches Gazette redesign no longer distinguishes rare discoveries
-- on the activity feed — rarity treatment is the catalogue's responsibility, and
-- the dispatch components render the same shape regardless of rarity. The
-- rare_discovery branch was never written by the live client (usePostActivity
-- only emits 'discovery', 'first_discovery', and 'badge_earned'); a small number
-- of historical rows from the original Lovable import may still carry the value
-- and need to be normalised before the CHECK constraint can be tightened.
--
-- Strategy: rewrite any rare_discovery rows to plain 'discovery' (rarity column
-- is preserved untouched, so no information is lost), then recreate the CHECK
-- constraint without the obsolete value.

UPDATE public.activity_feed
SET event_type = 'discovery'
WHERE event_type = 'rare_discovery';

ALTER TABLE public.activity_feed
  DROP CONSTRAINT IF EXISTS activity_feed_event_type_check;

ALTER TABLE public.activity_feed
  ADD CONSTRAINT activity_feed_event_type_check
  CHECK (event_type IN ('discovery', 'first_discovery', 'badge_earned'));
