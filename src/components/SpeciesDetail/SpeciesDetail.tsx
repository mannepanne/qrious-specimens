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
    month: 'long',
    year: 'numeric',
  })
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 border-b border-border/40 last:border-0">
      <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground shrink-0">
        {label}
      </span>
      <span className="font-mono text-xs text-right">{value}</span>
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
  // Slice at nearest word boundary so the teaser doesn't cut mid-word
  const fieldNotesTeaserText = fieldNotesFull.slice(0, FIELD_NOTES_TEASER_LENGTH).replace(/\s\S+$/, '')
  const showTeaser = !isAuthenticated && fieldNotesFull.length > FIELD_NOTES_TEASER_LENGTH

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header: close + prev/next navigation (prev/next hidden when both unavailable) */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0">
        {(onPrev || onNext) ? (
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

      <div className="px-4 pb-6 flex flex-col gap-6">
        {/* Illustration */}
        <div className="flex justify-center pt-2">
          {entry.image_url_512 ? (
            <img
              src={entry.image_url_512}
              alt={`${entry.genus} ${entry.species}`}
              width={280}
              height={280}
              loading="lazy"
              className="w-[240px] h-[240px] sm:w-[280px] sm:h-[280px] object-contain"
            />
          ) : sketchDna ? (
            <CreatureRenderer dna={sketchDna} size={240} showAnnotations />
          ) : null}
        </div>

        {/* Binomial name + rarity */}
        <div className="text-center">
          <h2 className="font-serif text-2xl italic">
            {entry.genus} {entry.species}
          </h2>
          <div className="flex items-center justify-center gap-3 mt-1">
            <span className="font-mono text-xs text-muted-foreground">{entry.family}</span>
            <span
              className="font-mono text-[10px] tracking-widest px-1.5 py-0.5 rounded-sm"
              style={{ color: rarityColor, borderColor: rarityColor, border: '1px solid' }}
            >
              {getRarityLabel(rarity)}
            </span>
          </div>
        </div>

        {/* Taxonomy table */}
        <section>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
            Classification
          </p>
          <div className="border border-border rounded-md px-3">
            <MetaRow label="Order"       value={entry.order} />
            <MetaRow label="Family"      value={entry.family} />
            <MetaRow label="Habitat"     value={entry.habitat} />
            <MetaRow label="Temperament" value={entry.temperament} />
            <MetaRow label="Est. size"   value={entry.estimated_size} />
          </div>
        </section>

        {/* Physical traits */}
        <section>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
            Morphological traits
          </p>
          <div className="border border-border rounded-md px-3">
            <MetaRow label="Symmetry"    value={entry.symmetry} />
            <MetaRow label="Body form"   value={entry.body_shape} />
            <MetaRow label="Appendages"  value={entry.limb_style} />
            <MetaRow label="Pattern"     value={entry.pattern_type} />
          </div>
        </section>

        {/* Field notes */}
        {fieldNotesFull && (
          <section>
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
              Field notes
            </p>
            {showTeaser ? (
              <div>
                <p className="font-serif text-sm leading-relaxed text-muted-foreground">
                  {fieldNotesTeaserText}
                  <span className="text-muted-foreground/60">…</span>
                </p>
                <p className="mt-3 font-mono text-[11px] text-muted-foreground border border-border rounded px-3 py-2">
                  Sign in to read the complete field notes.
                </p>
              </div>
            ) : (
              <p className="font-serif text-sm leading-relaxed">{fieldNotesFull}</p>
            )}
          </section>
        )}

        {/* Discovery metadata */}
        <section>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
            Discovery record
          </p>
          <div className="border border-border rounded-md px-3">
            <MetaRow
              label="First catalogued"
              value={formatDate(entry.first_discovered_at)}
            />
            <MetaRow
              label="Discoverers"
              value={`${entry.discovery_count} explorer${entry.discovery_count !== 1 ? 's' : ''}`}
            />
            {isAuthenticated && firstDiscovererName && (
              <MetaRow label="First by" value={firstDiscovererName} />
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
