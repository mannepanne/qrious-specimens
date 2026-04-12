// ABOUT: Catalogue grid card for a discovered species
// ABOUT: Shows AI-generated 256px thumbnail if available; falls back to Victorian sketch renderer

import CreatureRenderer from '@/components/CreatureRenderer/CreatureRenderer'
import { getRarityFromCount, getRarityLabel, getRarityColor } from '@/lib/rarity'
import { generateCreatureDNA } from '@/lib/creatureEngine'
import type { CatalogueEntry } from '@/hooks/useCatalogue'

interface Props {
  entry: CatalogueEntry
  onClick?: () => void
}

export default function SpeciesCard({ entry, onClick }: Props) {
  const rarity = getRarityFromCount(entry.discovery_count)
  const rarityColor = getRarityColor(rarity)

  // Use qr_hash as seed for deterministic sketch when no AI image is available.
  // The sketch won't match the original creature exactly (different qrContent),
  // but it's consistent per species and visually distinctive.
  const sketchDna = entry.image_url_256 ? null : generateCreatureDNA(entry.qr_hash)

  return (
    <button
      onClick={onClick}
      className="group w-full text-left border border-border rounded-lg p-3 hover:border-foreground/30 transition-colors bg-card hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {/* Illustration — AI thumbnail or sketch fallback */}
      <div className="flex justify-center mb-3">
        {entry.image_url_256 ? (
          <img
            src={entry.image_url_256}
            alt={`${entry.genus} ${entry.species}`}
            width={120}
            height={120}
            loading="lazy"
            className="w-[120px] h-[120px] object-contain"
          />
        ) : sketchDna ? (
          <CreatureRenderer dna={sketchDna} size={120} />
        ) : null}
      </div>

      {/* Binomial name */}
      <p className="font-serif text-sm font-medium italic leading-tight text-center">
        {entry.genus} {entry.species}
      </p>

      {/* Family + rarity */}
      <div className="flex items-center justify-between mt-2">
        <span className="font-mono text-[9px] text-muted-foreground tracking-wider truncate">
          {entry.family}
        </span>
        <span
          className="font-mono text-[8px] tracking-widest px-1.5 py-0.5 rounded-sm shrink-0 ml-1"
          style={{ color: rarityColor, borderColor: rarityColor, border: '1px solid' }}
        >
          {getRarityLabel(rarity)}
        </span>
      </div>
    </button>
  )
}
