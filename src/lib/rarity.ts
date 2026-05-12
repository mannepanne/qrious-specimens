// ABOUT: Rarity computation from unique discoverer count
// ABOUT: Tier is a live, species-level property derived from species_discoveries.discovery_count

/**
 * Maximum discovery_count that still classes as Extraordinary.
 * Mirrors the c_extraordinary_max constant in register_discovery (see
 * supabase/migrations/20260511000001_register_discovery_tier_change.sql) and
 * the CASE clause in get_catalogue. Change all three in lockstep.
 */
export const EXTRAORDINARY_MAX = 3

/**
 * Maximum discovery_count that still classes as Notable. Counts above this
 * threshold are Common. Same cross-file invariant as EXTRAORDINARY_MAX.
 */
export const NOTABLE_MAX = 15

export type Rarity = 'extraordinary' | 'notable' | 'common'

/** Compute the live tier from the unique-discoverer count for a species. */
export function getRarityFromCount(discoveryCount: number | undefined): Rarity {
  if (discoveryCount == null || discoveryCount <= EXTRAORDINARY_MAX) return 'extraordinary'
  if (discoveryCount <= NOTABLE_MAX) return 'notable'
  return 'common'
}

/** Display label, e.g. 'EXTRAORDINARY'. */
export function getRarityLabel(rarity: Rarity): string {
  return rarity.toUpperCase()
}

/** Display colour for tier badges. */
export function getRarityColor(rarity: Rarity): string {
  switch (rarity) {
    case 'extraordinary': return 'hsl(270, 50%, 55%)'
    case 'notable':       return 'hsl(210, 50%, 55%)'
    case 'common':        return 'hsl(30, 15%, 50%)'
  }
}
