-- Extend register_discovery to detect Extraordinary/Notable/Common tier crossings
-- and emit a 'tier_change' activity_feed row when one occurs.
--
-- Behaviour:
--   * Capture discovery_count before the upsert (NULL for never-seen species).
--   * Run the existing upsert that increments discovery_count when this caller
--     is a brand-new discoverer and is a no-op for re-scans by the same user.
--   * Compare old tier vs new tier. If they differ AND there was an old row
--     (so first_discovery is not mis-emitted as tier_change), insert a
--     tier_change activity_feed row and return its id.
--   * tier_change_body is intentionally left NULL by this RPC. The worker
--     issues a follow-up Anthropic call and UPDATEs the row.
--
-- The thresholds (EXTRAORDINARY_MAX = 3, NOTABLE_MAX = 15) live both here and
-- in src/lib/rarity.ts. The cross-file invariant is documented in both places;
-- changes must be made in lockstep.
--
-- Return shape changes — the worker (workers/generate-creature/index.ts) is
-- updated in the same PR. Old shape: (is_first, total_count, scan_count).
-- New shape: (is_first_discoverer, tier_changed, old_tier, new_tier,
-- new_discovery_count, tier_change_event_id).
--
-- Caller identity: the function takes p_user_id as a parameter and trusts it.
-- The forge-as-another-user risk is contained at the grant layer: EXECUTE is
-- revoked from authenticated and anon, so only service_role (the worker) can
-- invoke this RPC. The worker JWT-verifies the caller and passes the verified
-- userId as p_user_id. Matches the lockdown from migration
-- 20260425000003_register_discovery_revoke_public_execute.sql — CREATE OR
-- REPLACE wipes prior GRANTs so we re-apply the full lockdown at the bottom.
--
-- See SPECIFICATIONS/rarity-and-census.md for the full design.

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
DECLARE
  -- Threshold constants (mirror src/lib/rarity.ts EXTRAORDINARY_MAX / NOTABLE_MAX).
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
    SELECT 1 FROM public.creatures
    WHERE user_id = p_user_id AND dna->>'hash' = p_qr_hash
  ) INTO v_already_discovered;

  -- Snapshot the current count BEFORE the upsert so we can compare tiers.
  -- NULL means the species_discoveries row does not yet exist (first ever
  -- discovery) — in that case there is no old tier to compare against.
  SELECT discovery_count
  INTO v_old_count
  FROM public.species_discoveries
  WHERE qr_hash = p_qr_hash;

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

  -- Persist first-discoverer flag (unchanged from prior version).
  IF v_first THEN
    UPDATE public.creatures
    SET is_first_discoverer = true
    WHERE user_id = p_user_id
      AND dna->>'hash' = p_qr_hash
      AND is_first_discoverer IS DISTINCT FROM true;
  END IF;

  -- Compute tiers. Old tier is NULL for first-ever discoveries.
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

  -- Tier change fires only when we have a prior tier and it differs from the
  -- new one. First discoveries (v_old_tier IS NULL) and re-scans by the same
  -- user (v_count unchanged → v_old_tier = v_new_tier) both fall through.
  IF v_old_tier IS NOT NULL AND v_old_tier IS DISTINCT FROM v_new_tier THEN
    -- Resolve binomial from the calling user's creature row (DNA-derived,
    -- so identical for every explorer of this species).
    SELECT trim(coalesce(c.dna->>'genus', '') || ' ' || coalesce(c.dna->>'species', ''))
    INTO v_species_name
    FROM public.creatures c
    WHERE c.user_id = p_user_id AND c.dna->>'hash' = p_qr_hash
    LIMIT 1;

    -- Persist the new tier in activity_feed.rarity so the Gazette can colour and
    -- label the dispatch without re-deriving from discovery_count at render time.
    INSERT INTO public.activity_feed (user_id, event_type, species_name, qr_hash, rarity)
    VALUES (p_user_id, 'tier_change', v_species_name, p_qr_hash, v_new_tier)
    RETURNING id INTO v_event_id;

    v_tier_changed := true;
  END IF;

  RETURN QUERY SELECT v_first, v_tier_changed, v_old_tier, v_new_tier, v_count, v_event_id;
END;
$function$;

-- Lock down EXECUTE to service_role only — mirrors the posture from
-- 20260425000003_register_discovery_revoke_public_execute.sql. CREATE OR REPLACE
-- wipes prior GRANTs, so we re-apply the full lockdown here.
REVOKE EXECUTE ON FUNCTION public.register_discovery(text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.register_discovery(text, uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.register_discovery(text, uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.register_discovery(text, uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
