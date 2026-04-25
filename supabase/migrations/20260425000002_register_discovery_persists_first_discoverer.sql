-- register_discovery now also persists is_first_discoverer on the creatures row.
--
-- Previously the RPC only updated species_discoveries and returned (is_first,
-- total_count, scan_count). The frontend received `is_first` from the worker
-- and used it to set client-side state for the post-scan navigation, but the
-- value was never written back to creatures.is_first_discoverer in the DB.
-- Any subsequent SpecimenPage / refresh / re-render would read the default
-- `false` and the badge would disappear.
--
-- Fix: when the caller IS the first discoverer for the species, the RPC also
-- updates creatures.is_first_discoverer = true for that user's row.
--
-- This is server-authoritative and atomic with the discovery registration.
-- Idempotent: re-running on an already-correct row is a no-op.

CREATE OR REPLACE FUNCTION public.register_discovery(p_qr_hash text, p_user_id uuid)
RETURNS TABLE(is_first boolean, total_count integer, scan_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_count integer;
  v_scans integer;
  v_first boolean;
  v_already_discovered boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM public.creatures
    WHERE user_id = p_user_id AND dna->>'hash' = p_qr_hash
  ) INTO v_already_discovered;

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
    species_discoveries.total_scans,
    (species_discoveries.first_discoverer_id = p_user_id)
  INTO v_count, v_scans, v_first;

  -- Persist the first-discoverer flag onto the creatures row when this caller
  -- is in fact the first. This keeps the DB in sync with the value the worker
  -- returns to the client; without it, the badge would only ever appear via
  -- the post-scan client-side navigate state and would disappear on refresh.
  IF v_first THEN
    UPDATE public.creatures
    SET is_first_discoverer = true
    WHERE user_id = p_user_id
      AND dna->>'hash' = p_qr_hash
      AND is_first_discoverer IS DISTINCT FROM true;
  END IF;

  RETURN QUERY SELECT v_first, v_count, v_scans;
END;
$function$;

-- Backfill: any creature whose user_id matches the species' first_discoverer_id
-- but whose flag isn't set yet. Captures the imported rows that may have drifted
-- as well as any specimen regenerated post-launch.
UPDATE public.creatures c
SET is_first_discoverer = true
FROM public.species_images si
WHERE si.qr_hash = c.dna->>'hash'
  AND si.first_discoverer_id = c.user_id
  AND c.is_first_discoverer IS DISTINCT FROM true;

NOTIFY pgrst, 'reload schema';
