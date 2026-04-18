// ABOUT: Full species detail view for the catalogue
// ABOUT: Shows illustration, taxonomy, field notes (auth-gated teaser), and discovery metadata

import { generateCreatureDNA } from '@/lib/creatureEngine'
import { getRarityFromCount, getRarityLabel, getRarityColor } from '@/lib/rarity'
import CreatureRenderer from '@/components/CreatureRenderer/CreatureRenderer'
import type { CatalogueEntry } from '@/hooks/useCatalogue'

interface Props {
  entry: CatalogueEntry
  isAuthenticated: boolean
  /** Navigate to previous species in the current result set */
  onPrev: (() => void) | null
  /** Navigate to next species in the current result set */
  onNext: (() => void) | null
  onClose: () => void
  /** Public display name of the first discoverer (only shown to authenticated users with public profiles) */
  firstDiscovererName?: string | null
}

const FIELD_NOTES_TEASER_LENGTH = 120

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function GridCell({ label, value, style }: { label: string; value: string; style?: React.CSSProperties }) {
  return (
    <div>
      <p className="font-mono text-[9px] text-muted-foreground">{label}</p>
      <p className="font-serif text-sm" style={style}>{value}</p>
    </div>
  )
}

export default function SpeciesDetail({ entry, isAuthenticated, onPrev, onNext, onClose, firstDiscovererName }: Props) {
  const rarity = getRarityFromCount(entry.discovery_count)
  const rarityColor = getRarityColor(rarity)

  // Derive sketch DNA from qr_hash when no AI image is available
  const sketchDna = entry.image_url_512 ? null : generateCreatureDNA(entry.qr_hash)

  // Field notes: full text for authenticated users; teaser for visitors
  const fieldNotesFull = entry.field_notes ?? ''
  const fieldNotesTeaserText = fieldNotesFull.slice(0, FIELD_NOTES_TEASER_LENGTH).replace(/\s\S+$/, '')
  const showTeaser = !isAuthenticated && fieldNotesFull.length > FIELD_NOTES_TEASER_LENGTH

  const showNav = onPrev !== null || onNext !== null

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header: prev/next navigation + close button */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0">
        {showNav ? (
          <div className="flex gap-2">
            <button
              onClick={onPrev ?? undefined}
              disabled={!onPrev}
              aria-label="Previous species"
              className="w-8 h-8 flex items-center justify-center rounded border border-border font-mono text-sm disabled:opacity-30 hover:bg-accent transition-colors"
            >
              ‹
            </button>
            <button
              onClick={onNext ?? undefined}
              disabled={!onNext}
              aria-label="Next species"
              className="w-8 h-8 flex items-center justify-center rounded border border-border font-mono text-sm disabled:opacity-30 hover:bg-accent transition-colors"
            >
              ›
            </button>
          </div>
        ) : <div />}
        <button
          onClick={onClose}
          aria-label="Close species detail"
          className="w-8 h-8 flex items-center justify-center rounded border border-border font-mono text-sm hover:bg-accent transition-colors"
        >
          ✕
        </button>
      </div>

      <div className="max-w-lg mx-auto w-full px-4 pb-6 space-y-6">
        {/* Binomial name */}
        <div className="text-center">
          <h2 className="font-serif text-2xl italic">{entry.genus} {entry.species}</h2>
          <p className="font-mono text-xs text-muted-foreground mt-1">{entry.family}</p>
        </div>

        {/* Illustration — full width */}
        <div className="rounded-sm overflow-hidden border bg-muted/20">
          {entry.image_url_512 ? (
            <img
              src={entry.image_url_512}
              alt={`${entry.genus} ${entry.species}`}
              className="w-full"
            />
          ) : sketchDna ? (
            <div className="flex justify-center p-6">
              <CreatureRenderer dna={sketchDna} size={240} showAnnotations />
            </div>
          ) : null}
        </div>

        {/* Classification */}
        <div className="space-y-3">
          <h3 className="font-mono text-[10px] tracking-[2px] text-muted-foreground">CLASSIFICATION</h3>
          <div className="bg-card border rounded-sm p-4">
            <div className="grid grid-cols-2 gap-y-3 gap-x-4">
              <GridCell label="ORDER"       value={entry.order} />
              <GridCell label="FAMILY"      value={entry.family} />
              <GridCell label="HABITAT"     value={entry.habitat} />
              <GridCell label="TEMPERAMENT" value={entry.temperament} />
              <GridCell label="EST. SIZE"   value={entry.estimated_size} />
            </div>
          </div>
        </div>

        {/* Observed traits */}
        <div className="space-y-3">
          <h3 className="font-mono text-[10px] tracking-[2px] text-muted-foreground">OBSERVED TRAITS</h3>
          <div className="bg-card border rounded-sm p-4">
            <div className="grid grid-cols-2 gap-y-3 gap-x-4">
              <GridCell label="SYMMETRY"   value={entry.symmetry} />
              <GridCell label="BODY FORM"  value={entry.body_shape} />
              <GridCell label="APPENDAGES" value={entry.limb_style} />
              <GridCell label="PATTERN"    value={entry.pattern_type} />
            </div>
          </div>
        </div>

        {/* Discovery record */}
        <div className="space-y-3">
          <h3 className="font-mono text-[10px] tracking-[2px] text-muted-foreground">DISCOVERY RECORD</h3>
          <div className="bg-card border rounded-sm p-4">
            <div className="grid grid-cols-2 gap-y-3 gap-x-4">
              <GridCell
                label="RARITY"
                value={getRarityLabel(rarity)}
                style={{ color: rarityColor }}
              />
              <GridCell
                label="DISCOVERERS"
                value={`${entry.discovery_count} explorer${entry.discovery_count !== 1 ? 's' : ''}`}
              />
              <GridCell label="FIRST CATALOGUED" value={formatDate(entry.first_discovered_at)} />
              {isAuthenticated && firstDiscovererName && (
                <GridCell label="FIRST BY" value={firstDiscovererName} />
              )}
            </div>
          </div>
        </div>

        {/* Field notes — auth-gated teaser for visitors */}
        {fieldNotesFull && (
          <div className="space-y-3">
            <h3 className="font-mono text-[10px] tracking-[2px] text-muted-foreground">FIELD NOTES</h3>
            <div className="bg-card border rounded-sm p-4 space-y-3">
              {showTeaser ? (
                <>
                  <p className="font-serif text-sm leading-relaxed text-foreground/80 italic">
                    {fieldNotesTeaserText}<span className="text-muted-foreground/60">…</span>
                  </p>
                  <p className="font-mono text-[11px] text-muted-foreground border border-border rounded px-3 py-2">
                    Sign in to read the complete field notes.
                  </p>
                </>
              ) : (
                fieldNotesFull.split('\n\n').map((para, i) => (
                  <p key={i} className="font-serif text-sm leading-relaxed text-foreground/80 italic">
                    {para}
                  </p>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
