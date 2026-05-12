-- Rename the rarity vocabulary across all RPCs from rare/uncommon/common
-- (and the v_rare_count variable name) to extraordinary/notable/common
-- (and v_extraordinary_count). Thresholds and weights are unchanged.
--
-- Functions touched:
--   get_catalogue            — p_rarity_filter accepted values renamed
--   get_explorer_showcase    — returned column rare_count → extraordinary_count
--   calculate_explorer_rank  — v_rare_count variable + breakdown.rare key renamed
--   check_and_award_badges   — v_rare_count variable renamed (badge slugs unchanged)
--
-- check_and_award_badges keeps the badge slugs rare_find and connoisseur because
-- changing slugs would orphan every earned badge row in explorer_badges. Only
-- the internal variable is renamed for consistency.

-- ============================================================
-- get_catalogue: accept extraordinary/notable/common
-- ============================================================

CREATE OR REPLACE FUNCTION get_catalogue(
  p_search               text    DEFAULT NULL,
  p_order_filter         text    DEFAULT NULL,
  p_habitat_filter       text    DEFAULT NULL,
  p_symmetry_filter      text    DEFAULT NULL,
  p_body_shape_filter    text    DEFAULT NULL,
  p_limb_style_filter    text    DEFAULT NULL,
  p_pattern_type_filter  text    DEFAULT NULL,
  p_rarity_filter        text    DEFAULT NULL,
  p_limit                integer DEFAULT 24,
  p_offset               integer DEFAULT 0
)
RETURNS TABLE (
  qr_hash               text,
  genus                 text,
  species               text,
  "order"               text,
  family                text,
  habitat               text,
  temperament           text,
  estimated_size        text,
  symmetry              text,
  body_shape            text,
  limb_style            text,
  pattern_type          text,
  image_url_512         text,
  image_url_256         text,
  field_notes           text,
  discovery_count       integer,
  first_discovered_at   timestamptz,
  first_discoverer_id   uuid,
  total_count           bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH catalogue_base AS (
    SELECT
      si.qr_hash,
      (c.dna->>'genus')::text                                             AS genus,
      (c.dna->>'species')::text                                           AS species,
      (c.dna->>'order')::text                                             AS "order",
      (c.dna->>'family')::text                                            AS family,
      (c.dna->>'habitat')::text                                           AS habitat,
      (c.dna->>'temperament')::text                                       AS temperament,
      (c.dna->>'estimatedSize')::text                                     AS estimated_size,
      (c.dna->>'symmetry')::text                                          AS symmetry,
      (c.dna->>'bodyShape')::text                                         AS body_shape,
      (c.dna->>'limbStyle')::text                                         AS limb_style,
      (c.dna->>'patternType')::text                                       AS pattern_type,
      si.image_url_512,
      si.image_url_256,
      si.field_notes,
      COALESCE(sd.discovery_count, si.discovery_count, 0)::integer        AS discovery_count,
      COALESCE(sd.first_discovered_at, si.created_at)                    AS first_discovered_at,
      COALESCE(sd.first_discoverer_id, si.first_discoverer_id)::uuid     AS first_discoverer_id
    FROM public.species_images si
    LEFT JOIN LATERAL (
      SELECT cr.dna
      FROM public.creatures cr
      WHERE cr.dna->>'hash' = si.qr_hash
      LIMIT 1
    ) c ON true
    LEFT JOIN public.species_discoveries sd ON sd.qr_hash = si.qr_hash
    WHERE si.image_url IS NOT NULL
      AND c.dna IS NOT NULL
  )
  SELECT
    qr_hash,
    genus,
    species,
    "order",
    family,
    habitat,
    temperament,
    estimated_size,
    symmetry,
    body_shape,
    limb_style,
    pattern_type,
    image_url_512,
    image_url_256,
    field_notes,
    discovery_count,
    first_discovered_at,
    first_discoverer_id,
    COUNT(*) OVER () AS total_count
  FROM catalogue_base
  WHERE
    (
      p_search IS NULL
      OR genus        ILIKE '%' || REPLACE(REPLACE(p_search, '\', '\\'), '%', '\%') || '%' ESCAPE '\'
      OR species      ILIKE '%' || REPLACE(REPLACE(p_search, '\', '\\'), '%', '\%') || '%' ESCAPE '\'
      OR "order"      ILIKE '%' || REPLACE(REPLACE(p_search, '\', '\\'), '%', '\%') || '%' ESCAPE '\'
      OR family       ILIKE '%' || REPLACE(REPLACE(p_search, '\', '\\'), '%', '\%') || '%' ESCAPE '\'
    )
    AND (p_order_filter        IS NULL OR "order"      = p_order_filter)
    AND (p_habitat_filter      IS NULL OR habitat      = p_habitat_filter)
    AND (p_symmetry_filter     IS NULL OR symmetry     = p_symmetry_filter)
    AND (p_body_shape_filter   IS NULL OR body_shape   = p_body_shape_filter)
    AND (p_limb_style_filter   IS NULL OR limb_style   = p_limb_style_filter)
    AND (p_pattern_type_filter IS NULL OR pattern_type = p_pattern_type_filter)
    AND (
      p_rarity_filter IS NULL
      OR (p_rarity_filter = 'extraordinary' AND discovery_count <= 3)
      OR (p_rarity_filter = 'notable'       AND discovery_count BETWEEN 4 AND 15)
      OR (p_rarity_filter = 'common'        AND discovery_count >= 16)
    )
  ORDER BY first_discovered_at DESC
  LIMIT  p_limit
  OFFSET p_offset;
$$;

GRANT EXECUTE ON FUNCTION get_catalogue(text, text, text, text, text, text, text, text, integer, integer) TO authenticated, anon;

-- ============================================================
-- get_explorer_showcase: rare_count → extraordinary_count
-- Return shape changes, so DROP first.
-- ============================================================

DROP FUNCTION IF EXISTS public.get_explorer_showcase();

CREATE FUNCTION public.get_explorer_showcase()
RETURNS TABLE (
  user_id               uuid,
  display_name          text,
  specimen_count        bigint,
  extraordinary_count   bigint,
  first_discovery_count bigint,
  badges                jsonb,
  joined_at             timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ep.user_id,
    ep.display_name,
    COALESCE(stats.specimen_count,         0) AS specimen_count,
    COALESCE(stats.extraordinary_count,    0) AS extraordinary_count,
    COALESCE(stats.first_discovery_count,  0) AS first_discovery_count,
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
      COUNT(*) FILTER (WHERE sd.discovery_count <= 3)      AS extraordinary_count,
      COUNT(*) FILTER (WHERE c.is_first_discoverer = true) AS first_discovery_count
    FROM public.creatures c
    LEFT JOIN public.species_discoveries sd ON sd.qr_hash = c.dna->>'hash'
    WHERE c.user_id = ep.user_id
  ) stats ON true
  WHERE ep.is_public = true
  ORDER BY stats.specimen_count DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_explorer_showcase() TO anon, authenticated;

-- ============================================================
-- calculate_explorer_rank: v_rare_count → v_extraordinary_count,
-- breakdown.rare → breakdown.extraordinary
-- Weights, thresholds, and bonus conditions unchanged.
-- ============================================================

CREATE OR REPLACE FUNCTION public.calculate_explorer_rank(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bronze_badges int := 0;
  v_silver_badges int := 0;
  v_gold_badges int := 0;
  v_total_badges int := 0;
  v_badge_points numeric := 0;
  v_specimen_count int := 0;
  v_unique_species int := 0;
  v_extraordinary_count int := 0;
  v_first_discoveries int := 0;
  v_days_active int := 0;
  v_activity_points numeric := 0;
  v_specimen_views int := 0;
  v_curiosity_bonus numeric := 0;
  v_breadth_multiplier numeric := 1.0;
  v_streak_bonus numeric := 0;
  v_pioneer_bonus numeric := 0;
  v_raw_score numeric := 0;
  v_final_score numeric := 0;
  v_rank text := 'unranked';
  v_rank_icon text := '';
  v_next_rank text := '';
  v_next_threshold numeric := 0;
  v_progress numeric := 0;
  v_account_age int;
BEGIN
  -- === BADGE SCORING ===
  SELECT
    count(*) FILTER (WHERE bd.tier = 'bronze'),
    count(*) FILTER (WHERE bd.tier = 'silver'),
    count(*) FILTER (WHERE bd.tier = 'gold'),
    count(*)
  INTO v_bronze_badges, v_silver_badges, v_gold_badges, v_total_badges
  FROM explorer_badges eb
  JOIN badge_definitions bd ON bd.slug = eb.badge_slug
  WHERE eb.user_id = p_user_id;

  v_badge_points := (v_bronze_badges * 1) + (v_silver_badges * 2) + (v_gold_badges * 3);

  -- === COLLECTION SCORING ===
  SELECT count(*) INTO v_specimen_count
  FROM creatures WHERE user_id = p_user_id;

  SELECT count(DISTINCT qr_hash) INTO v_unique_species
  FROM creatures WHERE user_id = p_user_id;

  SELECT count(*) INTO v_extraordinary_count
  FROM creatures c
  WHERE c.user_id = p_user_id
    AND (SELECT count(*) FROM creatures c2 WHERE c2.qr_hash = c.qr_hash) <= 3;

  SELECT count(*) INTO v_first_discoveries
  FROM creatures WHERE user_id = p_user_id AND is_first_discoverer = true;

  -- === ACTIVITY SCORING ===
  SELECT count(DISTINCT date_trunc('day', created_at)) INTO v_days_active
  FROM page_events WHERE user_id = p_user_id;

  v_activity_points := floor(ln(greatest(v_days_active, 1) + 1) * 1.5);

  -- === CURIOSITY SCORING ===
  SELECT count(*) INTO v_specimen_views
  FROM page_events
  WHERE user_id = p_user_id
    AND (
      page_name LIKE '/specimen%'
      OR page_name LIKE '/catalogue%'
      OR page_name LIKE '/species%'
    );

  v_curiosity_bonus := floor(ln(greatest(v_specimen_views, 1) + 1) * 0.8);

  -- === MULTIPLIERS ===
  IF v_bronze_badges > 0 THEN v_breadth_multiplier := v_breadth_multiplier + 0.05; END IF;
  IF v_silver_badges > 0 THEN v_breadth_multiplier := v_breadth_multiplier + 0.05; END IF;
  IF v_gold_badges > 0 THEN v_breadth_multiplier := v_breadth_multiplier + 0.10; END IF;

  v_pioneer_bonus := power(greatest(v_first_discoveries, 0), 1.1) * 0.5;

  SELECT greatest(extract(epoch FROM (now() - min(created_at))) / 86400, 1)::int
  INTO v_account_age
  FROM page_events WHERE user_id = p_user_id;

  IF v_account_age > 0 THEN
    v_streak_bonus := least((v_days_active::numeric / v_account_age) * 4, 4);
  END IF;

  -- === THE GRAND FORMULA ===
  v_raw_score :=
    (v_badge_points * v_breadth_multiplier)
    + (floor(sqrt(v_specimen_count)) * 0.8)
    + (v_unique_species * 0.5)
    + (v_extraordinary_count * 0.8)
    + v_pioneer_bonus
    + v_activity_points
    + v_streak_bonus
    + v_curiosity_bonus
    + (CASE WHEN v_total_badges >= 5 THEN 2 ELSE 0 END)
    + (CASE WHEN v_extraordinary_count >= 5 AND v_first_discoveries >= 3 THEN 3 ELSE 0 END);

  v_final_score := round(v_raw_score, 1);

  -- === RANK THRESHOLDS ===
  IF v_final_score >= 250 THEN
    v_rank := 'platinum'; v_rank_icon := '♛';
    v_next_rank := ''; v_next_threshold := 250; v_progress := 1.0;
  ELSIF v_final_score >= 100 THEN
    v_rank := 'gold'; v_rank_icon := '♚';
    v_next_rank := 'platinum'; v_next_threshold := 250;
    v_progress := (v_final_score - 100) / (250 - 100);
  ELSIF v_final_score >= 35 THEN
    v_rank := 'silver'; v_rank_icon := '♜';
    v_next_rank := 'gold'; v_next_threshold := 100;
    v_progress := (v_final_score - 35) / (100 - 35);
  ELSIF v_final_score >= 8 THEN
    v_rank := 'bronze'; v_rank_icon := '♞';
    v_next_rank := 'silver'; v_next_threshold := 35;
    v_progress := (v_final_score - 8) / (35 - 8);
  ELSE
    v_rank := 'unranked'; v_rank_icon := '◇';
    v_next_rank := 'bronze'; v_next_threshold := 8;
    v_progress := v_final_score / 8;
  END IF;

  RETURN jsonb_build_object(
    'rank', v_rank,
    'rank_icon', v_rank_icon,
    'score', v_final_score,
    'next_rank', v_next_rank,
    'next_threshold', v_next_threshold,
    'progress', round(least(greatest(v_progress, 0), 1), 3),
    'breakdown', jsonb_build_object(
      'badges', v_total_badges,
      'specimens', v_specimen_count,
      'species', v_unique_species,
      'extraordinary', v_extraordinary_count,
      'firsts', v_first_discoveries,
      'days_active', v_days_active
    )
  );
END;
$$;

-- ============================================================
-- check_and_award_badges: v_rare_count → v_extraordinary_count
-- Badge slugs unchanged (rare_find, connoisseur) so already-earned rows
-- in explorer_badges remain valid.
-- ============================================================

DROP FUNCTION IF EXISTS public.check_and_award_badges(uuid);

CREATE OR REPLACE FUNCTION public.check_and_award_badges(p_user_id uuid)
RETURNS TABLE (r_badge_slug text, r_badge_name text, r_badge_icon text, r_is_new boolean)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_specimens     integer;
  v_extraordinary_count integer;
  v_first_discoveries   integer;
  v_distinct_days       integer;
  v_slug                text;
  v_newly_awarded       text[] := '{}';
BEGIN
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE sd.discovery_count <= 3),
    COUNT(*) FILTER (WHERE c.is_first_discoverer = true)
  INTO v_total_specimens, v_extraordinary_count, v_first_discoveries
  FROM public.creatures c
  LEFT JOIN public.species_discoveries sd ON sd.qr_hash = c.dna->>'hash'
  WHERE c.user_id = p_user_id;

  SELECT COUNT(DISTINCT DATE(discovered_at))
  INTO v_distinct_days
  FROM public.creatures
  WHERE user_id = p_user_id;

  FOREACH v_slug IN ARRAY ARRAY[
    CASE WHEN v_total_specimens     >= 1  THEN 'first_steps'        END,
    CASE WHEN v_total_specimens     >= 5  THEN 'budding_naturalist' END,
    CASE WHEN v_total_specimens     >= 10 THEN 'keen_observer'      END,
    CASE WHEN v_total_specimens     >= 25 THEN 'seasoned_collector' END,
    CASE WHEN v_total_specimens     >= 50 THEN 'intrepid_explorer'  END,
    CASE WHEN v_extraordinary_count >= 1  THEN 'rare_find'          END,
    CASE WHEN v_extraordinary_count >= 5  THEN 'connoisseur'        END,
    CASE WHEN v_first_discoveries   >= 1  THEN 'pioneer'            END,
    CASE WHEN v_first_discoveries   >= 5  THEN 'trailblazer'        END,
    CASE WHEN v_distinct_days       >= 7  THEN 'dedicated'          END
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

GRANT EXECUTE ON FUNCTION public.check_and_award_badges(uuid) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
