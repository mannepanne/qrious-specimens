-- Admit the new 'tier_change' event_type onto activity_feed and add the column
-- that carries the Society's notice prose for those rows.
--
-- Tier-change posts fire from register_discovery when a discovery moves a
-- species across the Extraordinary/Notable/Common boundary. The event row is
-- inserted inside the same transaction as the discovery itself (so the row is
-- always visible to readers); the worker then issues a follow-up Anthropic
-- call and UPDATEs tier_change_body with the resulting one-to-two-sentence
-- notice. If the worker call fails, the row stays with NULL body and the
-- TierChangeDispatch component renders a hand-written fallback.
--
-- See SPECIFICATIONS/rarity-and-census.md for the full design.

ALTER TABLE public.activity_feed
  DROP CONSTRAINT IF EXISTS activity_feed_event_type_check;

ALTER TABLE public.activity_feed
  ADD CONSTRAINT activity_feed_event_type_check
  CHECK (event_type IN ('discovery', 'first_discovery', 'badge_earned', 'tier_change'));

ALTER TABLE public.activity_feed
  ADD COLUMN IF NOT EXISTS tier_change_body text;

COMMENT ON COLUMN public.activity_feed.tier_change_body IS
  'Society notice prose for tier_change events, written by the worker via Claude Haiku immediately after register_discovery. NULL for non-tier_change events, and NULL for tier_change events whose worker call failed (UI falls back to a hand-written template).';

NOTIFY pgrst, 'reload schema';
