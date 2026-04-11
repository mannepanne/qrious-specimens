// ABOUT: Rarity computation from unique discoverer count
// ABOUT: Rarity is a species-level property derived from how many explorers have found it

export type Rarity = 'rare' | 'uncommon' | 'common'

/** Compute rarity from total unique discoverers of a species */
export function getRarityFromCount(discoveryCount: number | undefined): Rarity {
  if (discoveryCount == null || discoveryCount <= 3) return 'rare'
  if (discoveryCount <= 15) return 'uncommon'
  return 'common'
}

export function getRarityLabel(rarity: Rarity): string {
  return rarity.toUpperCase()
}

export function getRarityColor(rarity: Rarity): string {
  switch (rarity) {
    case 'rare':     return 'hsl(270, 50%, 55%)'
    case 'uncommon': return 'hsl(210, 50%, 55%)'
    case 'common':   return 'hsl(30, 15%, 50%)'
  }
}
