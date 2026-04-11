// ABOUT: Cabinet grid card for a discovered specimen
// ABOUT: Shows AI-generated 256px thumbnail if available; falls back to Victorian sketch renderer

import type { CreatureRow } from '@/types/creature'
import CreatureRenderer from '@/components/CreatureRenderer/CreatureRenderer'
import { useSpeciesImage } from '@/hooks/useSpeciesImage'
import { getRarityFromCount, getRarityLabel, getRarityColor } from '@/lib/rarity'

interface Props {
  creature: CreatureRow
  /** Total unique discoverers of this species — used to derive rarity */
  discoveryCount?: number
  onClick?: () => void
}

export default function SpecimenTeaser({ creature, discoveryCount, onClick }: Props) {
  const { dna, nickname } = creature
  const rarity = getRarityFromCount(discoveryCount)
  const rarityColor = getRarityColor(rarity)

  // Check for cached AI thumbnail; do not trigger generation (generation happens via SpecimenPage)
  const { imageUrl256 } = useSpeciesImage(creature.qr_hash, null)

  return (
    <button
      onClick={onClick}
      className="group w-full text-left border border-border rounded-lg p-3 hover:border-foreground/30 transition-colors bg-card hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {/* Creature illustration — AI thumbnail or sketch fallback */}
      <div className="flex justify-center mb-3">
        {imageUrl256 ? (
          <img
            src={imageUrl256}
            alt={`${dna.genus} ${dna.species}`}
            className="w-[120px] h-[120px] object-contain"
          />
        ) : (
          <CreatureRenderer dna={dna} size={120} />
        )}
      </div>

      {/* Name */}
      <p className="font-serif text-sm font-medium italic leading-tight text-center">
        {nickname ?? `${dna.genus} ${dna.species}`}
      </p>
      {nickname && (
        <p className="font-serif text-[10px] italic text-muted-foreground text-center mt-0.5">
          {dna.genus} {dna.species}
        </p>
      )}

      {/* Family + rarity */}
      <div className="flex items-center justify-between mt-2">
        <span className="font-mono text-[9px] text-muted-foreground tracking-wider truncate">
          {dna.family}
        </span>
        <span
          className="font-mono text-[8px] tracking-widest px-1.5 py-0.5 rounded-sm shrink-0 ml-1"
          style={{ color: rarityColor, borderColor: rarityColor, border: `1px solid` }}
        >
          {getRarityLabel(rarity)}
        </span>
      </div>
    </button>
  )
}
