-- Recreate calculate_explorer_rank to match the current page_events schema.
--
-- The original RPC was deployed straight to Supabase (no migration file in this
-- repo) and referenced page_events.page. The page_events table was recreated
-- in 20260419000005 with column page_name instead, so the RPC has been failing
-- with `column "page" does not exist` on every authenticated request — surfacing
-- as a 400 in the browser console.
--
-- This migration:
--   1. Brings the function into version control.
--   2. Renames the column reference to page_name.
--   3. Updates the curiosity-bonus filter to match our pathname-based values
--      (e.g. /specimen/abc, /catalogue) using LIKE patterns instead of equality
--      against short tokens.

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
  v_rare_count int := 0;
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

  SELECT count(*) INTO v_rare_count
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
  -- page_name stores full pathnames (e.g. /specimen/abc, /catalogue,
  -- /species/abc), so match by prefix rather than exact equality.
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
    + (v_rare_count * 0.8)
    + v_pioneer_bonus
    + v_activity_points
    + v_streak_bonus
    + v_curiosity_bonus
    + (CASE WHEN v_total_badges >= 5 THEN 2 ELSE 0 END)
    + (CASE WHEN v_rare_count >= 5 AND v_first_discoveries >= 3 THEN 3 ELSE 0 END);

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
      'rare', v_rare_count,
      'firsts', v_first_discoveries,
      'days_active', v_days_active
    )
  );
END;
$$;

NOTIFY pgrst, 'reload schema';
