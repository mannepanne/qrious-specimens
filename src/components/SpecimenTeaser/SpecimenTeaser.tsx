// ABOUT: Cabinet grid card for a discovered specimen
// ABOUT: Circular illustration container — AI thumbnail or Victorian sketch renderer; marks first-discoverer specimens with a pineapple

import type { CreatureRow } from '@/types/creature'
import CreatureRenderer from '@/components/CreatureRenderer/CreatureRenderer'
import { useSpeciesImage } from '@/hooks/useSpeciesImage'
import { getRarityFromCount, getRarityLabel, getRarityColor } from '@/lib/rarity'
import Pineapple from '@/components/Pineapple/Pineapple'

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
  // Use dna.hash (16-char) — species_images.qr_hash stores the 16-char DNA hash, not creatures.qr_hash (8-char)
  const { imageUrl256 } = useSpeciesImage(creature.dna.hash, null)

  return (
    <button
      onClick={onClick}
      className="group bg-card border rounded-sm p-4 text-center hover:shadow-md transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring w-full"
    >
      {/* Circular illustration */}
      <div
        className="mx-auto mb-3 w-[108px] h-[108px] rounded-full overflow-hidden flex items-center justify-center group-hover:scale-105 transition-transform border border-border"
        style={{ background: 'hsl(36,20%,91%)' }}
      >
        {imageUrl256 ? (
          <img
            src={imageUrl256}
            alt={`${dna.genus} ${dna.species}`}
            loading="lazy"
            className="w-full h-full object-contain"
          />
        ) : (
          <CreatureRenderer dna={dna} size={100} />
        )}
      </div>

      {/* Discoverer-given nickname (if any), then formal taxonomy. Matches the
          catalogue card layout for the binomial + family lines so the cabinet
          and catalogue read the same way. */}
      {nickname && (
        <p className="font-serif text-sm font-medium leading-tight truncate" title={nickname}>
          {nickname}
        </p>
      )}
      <p className="font-serif text-sm font-medium italic leading-tight text-center truncate">
        {dna.genus} {dna.species}
      </p>
      <p className="font-mono text-[10px] text-muted-foreground tracking-wider text-center mt-1 truncate">
        {dna.family}
      </p>

      {/* Rarity + first-discoverer pineapple */}
      <div className="flex items-center justify-center gap-1 mt-1.5">
        <span className="font-mono text-[9px] tracking-widest" style={{ color: rarityColor }}>
          {getRarityLabel(rarity)}
        </span>
        {creature.is_first_discoverer && (
          <Pineapple className="h-4 w-4 text-amber-600" />
        )}
      </div>
    </button>
  )
}
