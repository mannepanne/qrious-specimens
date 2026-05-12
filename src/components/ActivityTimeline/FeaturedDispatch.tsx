// ABOUT: Featured "Dispatch of the Day" — horizontal layout with prominent illustration and pull-quote
// ABOUT: Mirrors image-side based on `mirrored` prop; click anywhere to open species page

import type { FeedEntry } from '@/hooks/useCommunity'
import { excerptFromFieldNotes, timeOfDay } from '@/lib/feedDate'

interface Props {
  entry: FeedEntry
  mirrored: boolean
  onViewSpecies?: (qrHash: string) => void
}

export function FeaturedDispatch({ entry, mirrored, onViewSpecies }: Props) {
  const quote = entry.pull_quote ?? excerptFromFieldNotes(entry.field_notes)
  const isClickable = !!entry.qr_hash && !!onViewSpecies
  const date = new Date(entry.created_at)

  const imageBlock = entry.species_image_url && (
    <div className="sm:w-[45%] shrink-0 bg-accent/20 sm:border-x-0 border-y sm:border-y-0 border-border aspect-square sm:aspect-auto">
      <img
        src={entry.species_image_url}
        alt={`Illustration of ${entry.species_name ?? 'specimen'}`}
        className="w-full h-full object-cover sm:object-contain"
        loading="lazy"
      />
    </div>
  )

  const textBlock = (
    <div className="flex-1 px-5 py-4 sm:py-5 flex flex-col gap-3 min-w-0">
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Dispatch of the day
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {timeOfDay(date)}
        </span>
      </div>

      <div>
        <h2 className="font-serif italic text-lg leading-tight">{entry.species_name}</h2>
      </div>

      {quote && (
        <blockquote className="font-serif text-[15px] italic leading-relaxed text-foreground/90 border-l-2 border-border pl-3">
          &ldquo;{quote}&rdquo;
        </blockquote>
      )}

      <div className="flex items-center justify-between mt-auto pt-1">
        <span className="font-mono text-[11px] text-muted-foreground">
          — recorded by{' '}
          <span className="font-medium text-foreground/80">{entry.display_name}</span>
        </span>
        <span aria-hidden="true" className="text-base text-muted-foreground/40">✽</span>
      </div>
    </div>
  )

  const article = (
    <article
      className={[
        'bg-card border border-border rounded-sm overflow-hidden',
        'flex flex-col sm:flex-row',
        mirrored ? 'sm:flex-row-reverse' : '',
      ].join(' ')}
    >
      {imageBlock}
      {textBlock}
    </article>
  )

  if (isClickable) {
    return (
      <button
        type="button"
        onClick={() => onViewSpecies!(entry.qr_hash!)}
        aria-label={`View ${entry.species_name ?? 'species'} in catalogue`}
        className="block w-full text-left transition-colors hover:bg-accent/20 rounded-sm"
      >
        {article}
      </button>
    )
  }

  return article
}
