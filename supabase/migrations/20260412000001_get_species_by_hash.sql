-- Phase 7 prerequisite: fetch a single catalogue entry by qr_hash
-- Used by the /species/:qrHash route for direct URL access and bookmarked links.
-- Returns the same shape as get_catalogue minus total_count (single-row fetch).
-- Idempotent — CREATE OR REPLACE.

CREATE OR REPLACE FUNCTION public.get_species_by_hash(p_qr_hash text)
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
  first_discoverer_id   uuid
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    si.qr_hash,
    (c.dna->>'genus')::text          AS genus,
    (c.dna->>'species')::text        AS species,
    (c.dna->>'order')::text          AS "order",
    (c.dna->>'family')::text         AS family,
    (c.dna->>'habitat')::text        AS habitat,
    (c.dna->>'temperament')::text    AS temperament,
    (c.dna->>'estimatedSize')::text  AS estimated_size,
    (c.dna->>'symmetry')::text       AS symmetry,
    (c.dna->>'bodyShape')::text      AS body_shape,
    (c.dna->>'limbStyle')::text      AS limb_style,
    (c.dna->>'patternType')::text    AS pattern_type,
    si.image_url_512,
    si.image_url_256,
    si.field_notes,
    COALESCE(sd.discovery_count, si.discovery_count, 0)::integer        AS discovery_count,
    COALESCE(sd.first_discovered_at, si.created_at)                     AS first_discovered_at,
    COALESCE(sd.first_discoverer_id, si.first_discoverer_id)::uuid      AS first_discoverer_id
  FROM public.species_images si
  LEFT JOIN LATERAL (
    SELECT cr.dna
    FROM public.creatures cr
    WHERE cr.dna->>'hash' = si.qr_hash
    LIMIT 1
  ) c ON true
  LEFT JOIN public.species_discoveries sd ON sd.qr_hash = si.qr_hash
  WHERE si.qr_hash = p_qr_hash
    AND si.image_url IS NOT NULL
    AND c.dna IS NOT NULL
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_species_by_hash(text) TO anon, authenticated;
