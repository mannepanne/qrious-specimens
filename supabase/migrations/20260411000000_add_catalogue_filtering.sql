-- Migration: Replace get_catalogue with server-side filtering version
-- Adds search, trait filters, rarity filter, and configurable page size.
-- Drops the existing function (p_limit, p_offset only) and replaces it.

DROP FUNCTION IF EXISTS get_catalogue(integer, integer);

CREATE OR REPLACE FUNCTION get_catalogue(
  p_search        text    DEFAULT NULL,
  p_order_filter  text    DEFAULT NULL,
  p_habitat_filter       text    DEFAULT NULL,
  p_symmetry_filter      text    DEFAULT NULL,
  p_body_shape_filter    text    DEFAULT NULL,
  p_limb_style_filter    text    DEFAULT NULL,
  p_pattern_type_filter  text    DEFAULT NULL,
  p_rarity_filter        text    DEFAULT NULL,  -- 'rare' | 'uncommon' | 'common'
  p_limit         integer DEFAULT 24,
  p_offset        integer DEFAULT 0
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
AS $$
  SELECT
    si.qr_hash,
    si.genus,
    si.species,
    si."order",
    si.family,
    si.habitat,
    si.temperament,
    si.estimated_size,
    si.symmetry,
    si.body_shape,
    si.limb_style,
    si.pattern_type,
    si.image_url_512,
    si.image_url_256,
    si.field_notes,
    COALESCE(si.discovery_count, 0)::integer AS discovery_count,
    si.first_discovered_at,
    si.first_discoverer_id::uuid,
    COUNT(*) OVER () AS total_count
  FROM species_images si
  WHERE
    -- Search: matches genus, species, order, or family (case-insensitive)
    (
      p_search IS NULL
      OR si.genus        ILIKE '%' || p_search || '%'
      OR si.species      ILIKE '%' || p_search || '%'
      OR si."order"      ILIKE '%' || p_search || '%'
      OR si.family       ILIKE '%' || p_search || '%'
    )
    -- Taxonomic order filter
    AND (p_order_filter   IS NULL OR si."order"      = p_order_filter)
    -- Trait filters
    AND (p_habitat_filter     IS NULL OR si.habitat      = p_habitat_filter)
    AND (p_symmetry_filter    IS NULL OR si.symmetry     = p_symmetry_filter)
    AND (p_body_shape_filter  IS NULL OR si.body_shape   = p_body_shape_filter)
    AND (p_limb_style_filter  IS NULL OR si.limb_style   = p_limb_style_filter)
    AND (p_pattern_type_filter IS NULL OR si.pattern_type = p_pattern_type_filter)
    -- Rarity filter: rare ≤3, uncommon 4–15, common ≥16
    AND (
      p_rarity_filter IS NULL
      OR (p_rarity_filter = 'rare'     AND COALESCE(si.discovery_count, 0) <= 3)
      OR (p_rarity_filter = 'uncommon' AND COALESCE(si.discovery_count, 0) BETWEEN 4 AND 15)
      OR (p_rarity_filter = 'common'   AND COALESCE(si.discovery_count, 0) >= 16)
    )
  ORDER BY si.first_discovered_at ASC
  LIMIT  p_limit
  OFFSET p_offset;
$$;

-- Allow authenticated and anonymous users to call this function
GRANT EXECUTE ON FUNCTION get_catalogue(text, text, text, text, text, text, text, text, integer, integer) TO authenticated, anon;
