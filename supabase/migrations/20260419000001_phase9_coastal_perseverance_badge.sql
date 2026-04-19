-- Phase 9: Add "Coastal Perseverance" badge
-- A badge in the spirit of Mary Anning — awarded for first discovery of 10 different species.
-- The name and description reference the Jurassic Coast and the act of persistence without
-- expectation of recognition. Awarded via check_and_award_badges() alongside other badges.

INSERT INTO public.badge_definitions (slug, name, description, icon, tier, sort_order)
VALUES (
  'coastal_perseverance',
  'Coastal Perseverance',
  'First to discover 10 different species — she walked the shore so others might see',
  '🪨',
  'gold',
  11
)
ON CONFLICT (slug) DO NOTHING;

-- Update check_and_award_badges to award the new badge.
-- Condition: first to discover 10 or more different species (v_first_discoveries >= 10).

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
    CASE WHEN v_total_specimens   >= 1  THEN 'first_steps'             END,
    CASE WHEN v_total_specimens   >= 5  THEN 'budding_naturalist'      END,
    CASE WHEN v_total_specimens   >= 10 THEN 'keen_observer'           END,
    CASE WHEN v_total_specimens   >= 25 THEN 'seasoned_collector'      END,
    CASE WHEN v_total_specimens   >= 50 THEN 'intrepid_explorer'       END,
    CASE WHEN v_rare_count        >= 1  THEN 'rare_find'               END,
    CASE WHEN v_rare_count        >= 5  THEN 'connoisseur'             END,
    CASE WHEN v_first_discoveries >= 1  THEN 'pioneer'                 END,
    CASE WHEN v_first_discoveries >= 5  THEN 'trailblazer'             END,
    CASE WHEN v_first_discoveries >= 10 THEN 'coastal_perseverance'    END,
    CASE WHEN v_distinct_days     >= 7  THEN 'dedicated'               END
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

GRANT EXECUTE ON FUNCTION public.check_and_award_badges(uuid) TO authenticated;
