-- Recreate get_community_feed to expose field_notes and pull_quote on every entry.
-- The Field Dispatches Gazette renders an italic pull-quote line per dispatch and
-- falls back to a render-time excerpt of field_notes when pull_quote IS NULL
-- (covers backfill window + any soft-fail of the pull-quote Claude call).
--
-- CREATE OR REPLACE cannot change a function's return signature, so we DROP first.
-- The function shape changes: same row order, same existing columns, two new columns
-- appended at the end (field_notes, pull_quote). Existing callers that select by
-- name remain compatible; the worker types regen via `supabase gen types`.

DROP FUNCTION IF EXISTS public.get_community_feed(integer);

CREATE FUNCTION public.get_community_feed(p_limit integer DEFAULT 20)
RETURNS TABLE (
  id                uuid,
  event_type        text,
  species_name      text,
  badge_slug        text,
  badge_name        text,
  badge_icon        text,
  rarity            text,
  display_name      text,
  created_at        timestamptz,
  qr_hash           text,
  species_image_url text,
  field_notes       text,
  pull_quote        text
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    af.id,
    af.event_type,
    af.species_name,
    af.badge_slug,
    bd.name           AS badge_name,
    bd.icon           AS badge_icon,
    af.rarity,
    ep.display_name,
    af.created_at,
    af.qr_hash,
    si.image_url_256  AS species_image_url,
    si.field_notes,
    si.pull_quote
  FROM public.activity_feed af
  JOIN  public.explorer_profiles ep ON ep.user_id = af.user_id AND ep.is_public = true
  LEFT JOIN public.badge_definitions bd ON bd.slug = af.badge_slug
  LEFT JOIN public.species_images    si ON si.qr_hash = af.qr_hash
  ORDER BY af.created_at DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_community_feed(integer) TO anon, authenticated;
