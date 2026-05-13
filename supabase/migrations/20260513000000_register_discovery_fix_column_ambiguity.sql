-- Fix register_discovery column-vs-variable name collision (issue #111).
--
-- Migration 20260511000001_register_discovery_tier_change.sql renamed the
-- first OUT parameter from `is_first` to `is_first_discoverer` to match the
-- worker's response field. That name collides with `creatures.is_first_discoverer`
-- in the embedded UPDATE statement, and PL/pgSQL raises
--
--   ERROR: column reference "is_first_discoverer" is ambiguous
--
-- at runtime. The whole function rolls back, so since #106 merged every
-- register_discovery call has been:
--   * failing to INSERT into species_discoveries
--   * failing to set creatures.is_first_discoverer
--   * failing to emit tier_change activity_feed rows
-- while the worker silently catches the 4xx in callRegisterDiscovery's
-- fallback and returns is_first_discoverer: false to the client.
--
-- Fix is two-pronged:
--   1. Recreate the function with all column references qualified by table
--      name AND `#variable_conflict use_column` as belt-and-braces.
--   2. Backfill the orphaned data — species_discoveries rows that were never
--      committed, and creatures.is_first_discoverer flags that were never set.
--
-- Signature is unchanged so no worker change is needed.

DROP FUNCTION IF EXISTS public.register_discovery(text, uuid);

CREATE OR REPLACE FUNCTION public.register_discovery(p_qr_hash text, p_user_id uuid)
RETURNS TABLE (
  is_first_discoverer  boolean,
  tier_changed         boolean,
  old_tier             text,
  new_tier             text,
  new_discovery_count  integer,
  tier_change_event_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
#variable_conflict use_column
DECLARE
  c_extraordinary_max constant integer := 3;
  c_notable_max       constant integer := 15;

  v_already_discovered boolean;
  v_old_count          integer;
  v_count              integer;
  v_first              boolean;
  v_old_tier           text;
  v_new_tier           text;
  v_tier_changed       boolean := false;
  v_event_id           uuid;
  v_species_name       text;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM public.creatures c
    WHERE c.user_id = p_user_id AND c.dna->>'hash' = p_qr_hash
  ) INTO v_already_discovered;

  SELECT sd.discovery_count
  INTO v_old_count
  FROM public.species_discoveries sd
  WHERE sd.qr_hash = p_qr_hash;

  INSERT INTO public.species_discoveries (qr_hash, discovery_count, total_scans, first_discoverer_id)
  VALUES (p_qr_hash, 1, 1, p_user_id)
  ON CONFLICT (qr_hash) DO UPDATE
    SET discovery_count = CASE
      WHEN v_already_discovered THEN species_discoveries.discovery_count
      ELSE species_discoveries.discovery_count + 1
    END,
    total_scans = species_discoveries.total_scans + 1
  RETURNING
    species_discoveries.discovery_count,
    (species_discoveries.first_discoverer_id = p_user_id)
  INTO v_count, v_first;

  -- Qualify both the LHS of SET and the WHERE predicates with the table name
  -- so `is_first_discoverer` is never ambiguous against the OUT parameter.
  -- The #variable_conflict use_column pragma above is the safety net if any
  -- future edit slips in an unqualified reference.
  IF v_first THEN
    UPDATE public.creatures AS c
    SET is_first_discoverer = true
    WHERE c.user_id = p_user_id
      AND c.dna->>'hash' = p_qr_hash
      AND c.is_first_discoverer IS DISTINCT FROM true;
  END IF;

  IF v_old_count IS NOT NULL THEN
    v_old_tier := CASE
      WHEN v_old_count <= c_extraordinary_max THEN 'extraordinary'
      WHEN v_old_count <= c_notable_max       THEN 'notable'
      ELSE 'common'
    END;
  END IF;

  v_new_tier := CASE
    WHEN v_count <= c_extraordinary_max THEN 'extraordinary'
    WHEN v_count <= c_notable_max       THEN 'notable'
    ELSE 'common'
  END;

  IF v_old_tier IS NOT NULL AND v_old_tier IS DISTINCT FROM v_new_tier THEN
    SELECT trim(coalesce(c.dna->>'genus', '') || ' ' || coalesce(c.dna->>'species', ''))
    INTO v_species_name
    FROM public.creatures c
    WHERE c.user_id = p_user_id AND c.dna->>'hash' = p_qr_hash
    LIMIT 1;

    INSERT INTO public.activity_feed (user_id, event_type, species_name, qr_hash, rarity)
    VALUES (p_user_id, 'tier_change', v_species_name, p_qr_hash, v_new_tier)
    RETURNING id INTO v_event_id;

    v_tier_changed := true;
  END IF;

  RETURN QUERY SELECT v_first, v_tier_changed, v_old_tier, v_new_tier, v_count, v_event_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.register_discovery(text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.register_discovery(text, uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.register_discovery(text, uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.register_discovery(text, uuid) TO service_role;

-- ============================================================================
-- Backfill 1: species_discoveries rows that the broken RPC never committed.
--
-- species_images.first_discoverer_id is the authoritative source: the worker
-- writes it before calling the RPC, with ignore-duplicates on conflict, so it
-- reflects the genuine first scanner of each qr_hash.
--
-- discovery_count and total_scans are reconstructed from creatures (one row
-- per (user, species) — discovery_count and total_scans collapse to the same
-- distinct-user count because we have no record of repeat scans by the same
-- user prior to this fix).
-- ============================================================================

INSERT INTO public.species_discoveries (qr_hash, discovery_count, total_scans, first_discoverer_id)
SELECT
  si.qr_hash,
  COALESCE(uc.cnt, 1),
  COALESCE(uc.cnt, 1),
  si.first_discoverer_id
FROM public.species_images si
LEFT JOIN (
  SELECT c.dna->>'hash' AS qr_hash, COUNT(DISTINCT c.user_id)::int AS cnt
  FROM public.creatures c
  GROUP BY c.dna->>'hash'
) uc ON uc.qr_hash = si.qr_hash
WHERE si.first_discoverer_id IS NOT NULL
ON CONFLICT (qr_hash) DO NOTHING;

-- ============================================================================
-- Backfill 2: creatures.is_first_discoverer flags that the broken UPDATE
-- never wrote. Same source-of-truth join as migration 20260425000002 used.
-- ============================================================================

UPDATE public.creatures c
SET is_first_discoverer = true
FROM public.species_images si
WHERE si.qr_hash = c.dna->>'hash'
  AND si.first_discoverer_id = c.user_id
  AND c.is_first_discoverer IS DISTINCT FROM true;

NOTIFY pgrst, 'reload schema';
