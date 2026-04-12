-- Migration: Replace get_catalogue with server-side filtering version
-- Adds search, trait filters, rarity filter, and configurable page size.
--
-- Schema note: species_images stores only image URLs, field_notes, and discovery
-- counters. Taxonomy fields (genus, species, order, family, habitat, etc.) live
-- in creatures.dna as JSONB, joined laterally on dna->>'hash' = qr_hash.
-- Discovery counts come from species_discoveries (authoritative) with fallback
-- to species_images.discovery_count (written by our Cloudflare Worker).

DROP FUNCTION IF EXISTS get_catalogue(integer, integer);

CREATE OR REPLACE FUNCTION get_catalogue(
  p_search               text    DEFAULT NULL,
  p_order_filter         text    DEFAULT NULL,
  p_habitat_filter       text    DEFAULT NULL,
  p_symmetry_filter      text    DEFAULT NULL,
  p_body_shape_filter    text    DEFAULT NULL,
  p_limb_style_filter    text    DEFAULT NULL,
  p_pattern_type_filter  text    DEFAULT NULL,
  p_rarity_filter        text    DEFAULT NULL,  -- 'rare' | 'uncommon' | 'common'
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
      -- Taxonomy extracted from JSONB dna column on creatures
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
      -- species_discoveries is authoritative for count; fall back to species_images column
      COALESCE(sd.discovery_count, si.discovery_count, 0)::integer        AS discovery_count,
      COALESCE(sd.first_discovered_at, si.created_at)                    AS first_discovered_at,
      COALESCE(sd.first_discoverer_id, si.first_discoverer_id)::uuid     AS first_discoverer_id
    FROM public.species_images si
    -- Lateral join: pick one creature row whose dna->>'hash' matches this qr_hash
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
    -- Full-text search across genus, species, order, family (case-insensitive).
    -- Wildcards in p_search are escaped so a search for '%' doesn't match everything.
    (
      p_search IS NULL
      OR genus        ILIKE '%' || REPLACE(REPLACE(p_search, '\', '\\'), '%', '\%') || '%' ESCAPE '\'
      OR species      ILIKE '%' || REPLACE(REPLACE(p_search, '\', '\\'), '%', '\%') || '%' ESCAPE '\'
      OR "order"      ILIKE '%' || REPLACE(REPLACE(p_search, '\', '\\'), '%', '\%') || '%' ESCAPE '\'
      OR family       ILIKE '%' || REPLACE(REPLACE(p_search, '\', '\\'), '%', '\%') || '%' ESCAPE '\'
    )
    -- Taxonomic order filter
    AND (p_order_filter        IS NULL OR "order"      = p_order_filter)
    -- Trait filters
    AND (p_habitat_filter      IS NULL OR habitat      = p_habitat_filter)
    AND (p_symmetry_filter     IS NULL OR symmetry     = p_symmetry_filter)
    AND (p_body_shape_filter   IS NULL OR body_shape   = p_body_shape_filter)
    AND (p_limb_style_filter   IS NULL OR limb_style   = p_limb_style_filter)
    AND (p_pattern_type_filter IS NULL OR pattern_type = p_pattern_type_filter)
    -- Rarity filter: rare ≤3, uncommon 4–15, common ≥16
    AND (
      p_rarity_filter IS NULL
      OR (p_rarity_filter = 'rare'     AND discovery_count <= 3)
      OR (p_rarity_filter = 'uncommon' AND discovery_count BETWEEN 4 AND 15)
      OR (p_rarity_filter = 'common'   AND discovery_count >= 16)
    )
  ORDER BY first_discovered_at ASC
  LIMIT  p_limit
  OFFSET p_offset;
$$;

-- Allow authenticated and anonymous users to call this function
GRANT EXECUTE ON FUNCTION get_catalogue(text, text, text, text, text, text, text, text, integer, integer) TO authenticated, anon;
