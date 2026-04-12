-- Phase 6: Gazette — Explorer profiles, badges, activity feed, community RPCs
--
-- Consolidates all reference community migrations into a single clean migration.
-- Key design decisions:
--   - activity_feed includes qr_hash from the start (no later ALTER needed)
--   - check_and_award_badges uses FOREACH loop + r_ prefixed return columns (v3 final)
--   - get_community_feed joins species_images for image thumbnails
--   - get_community_stats excludes test accounts (join auth.users)
--   - All SECURITY DEFINER functions SET search_path = public
--   - Badge awarding is silent in Phase 6; toast display added in Phase 7

-- ============================================================
-- Tables
-- ============================================================

-- Explorer profiles: opt-in public display with chosen display name
CREATE TABLE public.explorer_profiles (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  display_name text       NOT NULL CHECK (char_length(display_name) BETWEEN 2 AND 30),
  is_public   boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.explorer_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read public profiles" ON public.explorer_profiles
  FOR SELECT TO anon, authenticated USING (is_public = true);

CREATE POLICY "Read own profile" ON public.explorer_profiles
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Insert own profile" ON public.explorer_profiles
  FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Update own profile" ON public.explorer_profiles
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- Badge definitions: static reference table, seeded below
CREATE TABLE public.badge_definitions (
  slug        text    PRIMARY KEY,
  name        text    NOT NULL,
  description text    NOT NULL,
  icon        text    NOT NULL,  -- emoji
  tier        text    NOT NULL CHECK (tier IN ('bronze', 'silver', 'gold')),
  sort_order  integer NOT NULL DEFAULT 0
);

ALTER TABLE public.badge_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read badge definitions" ON public.badge_definitions
  FOR SELECT TO anon, authenticated USING (true);

INSERT INTO public.badge_definitions (slug, name, description, icon, tier, sort_order) VALUES
  ('first_steps',        'First Steps',                    'Discovered your first specimen',        '🌱', 'bronze', 1),
  ('budding_naturalist', 'Budding Naturalist',             'Discovered 5 specimens',                '🌿', 'bronze', 2),
  ('keen_observer',      'Keen Observer',                  'Discovered 10 specimens',               '🔬', 'silver', 3),
  ('seasoned_collector', 'Seasoned Collector',             'Discovered 25 specimens',               '🧪', 'silver', 4),
  ('intrepid_explorer',  'Intrepid Explorer',              'Discovered 50 specimens',               '🧭', 'gold',   5),
  ('rare_find',          'Rare Find',                      'Discovered your first rare specimen',   '💎', 'bronze', 6),
  ('connoisseur',        'Connoisseur of the Uncommon',    'Own 5 or more rare specimens',          '👑', 'gold',   7),
  ('pioneer',            'Pioneer',                        'First to discover a species',           '⭐', 'silver', 8),
  ('trailblazer',        'Trailblazer',                    'First to discover 5 different species', '🏔️', 'gold',  9),
  ('dedicated',          'Dedicated Naturalist',           'Visited on 7 different days',           '📅', 'silver', 10);

-- Explorer badges: earned badges per user with per-badge visibility toggle
CREATE TABLE public.explorer_badges (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_slug  text        NOT NULL REFERENCES public.badge_definitions(slug),
  is_public   boolean     NOT NULL DEFAULT true,
  earned_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, badge_slug)
);

ALTER TABLE public.explorer_badges ENABLE ROW LEVEL SECURITY;

-- Public badges of public profiles are readable by all
CREATE POLICY "Read public badges" ON public.explorer_badges
  FOR SELECT TO anon, authenticated
  USING (
    is_public = true
    AND EXISTS (
      SELECT 1 FROM public.explorer_profiles ep
      WHERE ep.user_id = explorer_badges.user_id AND ep.is_public = true
    )
  );

CREATE POLICY "Read own badges" ON public.explorer_badges
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

-- Badges are inserted via check_and_award_badges RPC (SECURITY DEFINER), but policy
-- must still permit the insert since the function runs as the calling user's role
-- for the purposes of RLS evaluation on INSERT.
CREATE POLICY "Insert own badges" ON public.explorer_badges
  FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Update own badge visibility" ON public.explorer_badges
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- Activity feed: recent public events from public profiles
-- qr_hash included from the start so we can link back to species images
CREATE TABLE public.activity_feed (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type   text        NOT NULL CHECK (event_type IN ('discovery', 'rare_discovery', 'first_discovery', 'badge_earned')),
  species_name text,       -- genus + species for discovery events
  badge_slug   text        REFERENCES public.badge_definitions(slug),
  rarity       text,       -- for discovery events
  qr_hash      text,       -- links to species_images for thumbnail
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.activity_feed ENABLE ROW LEVEL SECURITY;

-- Only show activity from users with public profiles
CREATE POLICY "Read public activity" ON public.activity_feed
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.explorer_profiles ep
      WHERE ep.user_id = activity_feed.user_id AND ep.is_public = true
    )
  );

CREATE POLICY "Read own activity" ON public.activity_feed
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Insert own activity" ON public.activity_feed
  FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));

CREATE INDEX idx_activity_feed_created_at ON public.activity_feed (created_at DESC);
CREATE INDEX idx_activity_feed_user_id    ON public.activity_feed (user_id);
CREATE INDEX idx_explorer_badges_user_id  ON public.explorer_badges (user_id);

-- ============================================================
-- RPCs
-- ============================================================

-- Activity timeline: most recent p_limit events from public profiles,
-- enriched with display name, badge details, and species thumbnail.
CREATE OR REPLACE FUNCTION public.get_community_feed(p_limit integer DEFAULT 20)
RETURNS TABLE (
  id               uuid,
  event_type       text,
  species_name     text,
  badge_slug       text,
  badge_name       text,
  badge_icon       text,
  rarity           text,
  display_name     text,
  created_at       timestamptz,
  qr_hash          text,
  species_image_url text
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    af.id,
    af.event_type,
    af.species_name,
    af.badge_slug,
    bd.name          AS badge_name,
    bd.icon          AS badge_icon,
    af.rarity,
    ep.display_name,
    af.created_at,
    af.qr_hash,
    si.image_url_256 AS species_image_url
  FROM public.activity_feed af
  JOIN  public.explorer_profiles ep ON ep.user_id = af.user_id AND ep.is_public = true
  LEFT JOIN public.badge_definitions bd ON bd.slug = af.badge_slug
  LEFT JOIN public.species_images    si ON si.qr_hash = af.qr_hash
  ORDER BY af.created_at DESC
  LIMIT p_limit;
$$;

-- Explorer showcase: public profiles ranked by specimen count, with badge JSONB.
CREATE OR REPLACE FUNCTION public.get_explorer_showcase()
RETURNS TABLE (
  user_id              uuid,
  display_name         text,
  specimen_count       bigint,
  rare_count           bigint,
  first_discovery_count bigint,
  badges               jsonb,
  joined_at            timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ep.user_id,
    ep.display_name,
    COALESCE(stats.specimen_count,       0) AS specimen_count,
    COALESCE(stats.rare_count,           0) AS rare_count,
    COALESCE(stats.first_discovery_count, 0) AS first_discovery_count,
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'slug', bd.slug,
        'name', bd.name,
        'icon', bd.icon,
        'tier', bd.tier
      ) ORDER BY bd.sort_order)
      FROM public.explorer_badges eb
      JOIN public.badge_definitions bd ON bd.slug = eb.badge_slug
      WHERE eb.user_id = ep.user_id AND eb.is_public = true),
      '[]'::jsonb
    ) AS badges,
    ep.created_at AS joined_at
  FROM public.explorer_profiles ep
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*)                                              AS specimen_count,
      COUNT(*) FILTER (WHERE sd.discovery_count <= 3)      AS rare_count,
      COUNT(*) FILTER (WHERE c.is_first_discoverer = true) AS first_discovery_count
    FROM public.creatures c
    LEFT JOIN public.species_discoveries sd ON sd.qr_hash = c.dna->>'hash'
    WHERE c.user_id = ep.user_id
  ) stats ON true
  WHERE ep.is_public = true
  ORDER BY stats.specimen_count DESC;
$$;

-- Community headline stats — excludes test accounts and the QRFossils seed account.
-- Test accounts: email ending in @test.com or @qrfossils.com (exact list matches admin exclusions).
CREATE OR REPLACE FUNCTION public.get_community_stats()
RETURNS TABLE (total_explorers bigint, total_specimens bigint, total_species bigint)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (
      SELECT COUNT(*)
      FROM public.explorer_profiles ep
      JOIN auth.users au ON au.id = ep.user_id
      WHERE ep.is_public = true
        AND au.email NOT LIKE '%@test.com'
        AND au.email NOT LIKE '%@qrfossils.com'
    ) AS total_explorers,
    (
      SELECT COUNT(*)
      FROM public.creatures c
      JOIN auth.users au ON au.id = c.user_id
      WHERE au.email NOT LIKE '%@test.com'
        AND au.email NOT LIKE '%@qrfossils.com'
    ) AS total_specimens,
    (
      SELECT COUNT(*)
      FROM public.species_images
      WHERE image_url IS NOT NULL
    ) AS total_species;
$$;

-- Badge checker: award all earned badges and return the full list with is_new flag.
-- Uses FOREACH loop to avoid ambiguous column names (v3, r_ prefixed return columns).
-- Called after each successful excavation; badge toasts displayed in Phase 7.
DROP FUNCTION IF EXISTS public.check_and_award_badges(uuid);

CREATE OR REPLACE FUNCTION public.check_and_award_badges(p_user_id uuid)
RETURNS TABLE (r_badge_slug text, r_badge_name text, r_badge_icon text, r_is_new boolean)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_specimens   integer;
  v_rare_count        integer;
  v_first_discoveries integer;
  v_distinct_days     integer;
  v_slug              text;
  v_newly_awarded     text[] := '{}';
BEGIN
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE sd.discovery_count <= 3),
    COUNT(*) FILTER (WHERE c.is_first_discoverer = true)
  INTO v_total_specimens, v_rare_count, v_first_discoveries
  FROM public.creatures c
  LEFT JOIN public.species_discoveries sd ON sd.qr_hash = c.dna->>'hash'
  WHERE c.user_id = p_user_id;

  SELECT COUNT(DISTINCT DATE(discovered_at))
  INTO v_distinct_days
  FROM public.creatures
  WHERE user_id = p_user_id;

  FOREACH v_slug IN ARRAY ARRAY[
    CASE WHEN v_total_specimens   >= 1  THEN 'first_steps'        END,
    CASE WHEN v_total_specimens   >= 5  THEN 'budding_naturalist'  END,
    CASE WHEN v_total_specimens   >= 10 THEN 'keen_observer'       END,
    CASE WHEN v_total_specimens   >= 25 THEN 'seasoned_collector'  END,
    CASE WHEN v_total_specimens   >= 50 THEN 'intrepid_explorer'   END,
    CASE WHEN v_rare_count        >= 1  THEN 'rare_find'           END,
    CASE WHEN v_rare_count        >= 5  THEN 'connoisseur'         END,
    CASE WHEN v_first_discoveries >= 1  THEN 'pioneer'             END,
    CASE WHEN v_first_discoveries >= 5  THEN 'trailblazer'         END,
    CASE WHEN v_distinct_days     >= 7  THEN 'dedicated'           END
  ]
  LOOP
    IF v_slug IS NOT NULL THEN
      INSERT INTO public.explorer_badges (user_id, badge_slug)
      VALUES (p_user_id, v_slug)
      ON CONFLICT (user_id, badge_slug) DO NOTHING;
      IF FOUND THEN v_newly_awarded := v_newly_awarded || v_slug; END IF;
    END IF;
  END LOOP;

  RETURN QUERY
    SELECT
      eb.badge_slug::text,
      bd.name::text,
      bd.icon::text,
      (eb.badge_slug = ANY(v_newly_awarded))
    FROM public.explorer_badges eb
    JOIN public.badge_definitions bd ON bd.slug = eb.badge_slug
    WHERE eb.user_id = p_user_id
    ORDER BY bd.sort_order;
END;
$$;

-- ============================================================
-- Grants
-- ============================================================

GRANT EXECUTE ON FUNCTION public.get_community_feed(integer)       TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_explorer_showcase()           TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_community_stats()             TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_and_award_badges(uuid)      TO authenticated;
