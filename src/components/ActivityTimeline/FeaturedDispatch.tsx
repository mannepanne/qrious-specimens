// ABOUT: Featured "Dispatch of the Day" — horizontal layout with prominent illustration and pull-quote
// ABOUT: Mirrors image-side based on `mirrored` prop; first_discovery entries get a "New to science" treatment

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
  const isFirst = entry.event_type === 'first_discovery'
  const date = new Date(entry.created_at)

  const imageBlock = entry.species_image_url && (
    <div
      className={[
        'sm:w-[45%] shrink-0 bg-accent/20 aspect-square sm:aspect-auto',
        'border-y sm:border-x-0 sm:border-y-0',
        isFirst ? 'border-amber-700/40' : 'border-border',
      ].join(' ')}
    >
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
        {isFirst ? (
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-amber-700 dark:text-amber-500 flex items-center gap-1.5">
            <span aria-hidden="true">⭐</span>
            <span>New to science</span>
          </span>
        ) : (
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Dispatch of the day
          </span>
        )}
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {timeOfDay(date)}
        </span>
      </div>

      <div>
        <h2 className="font-serif italic text-lg leading-tight">{entry.species_name}</h2>
        {isFirst && (
          <p className="font-serif text-[12px] italic text-amber-700/90 dark:text-amber-500/90 mt-0.5">
            First sighting in the world.
          </p>
        )}
      </div>

      {quote && (
        <blockquote
          className={[
            'font-serif text-[15px] italic leading-relaxed text-foreground/90 border-l-2 pl-3',
            isFirst ? 'border-amber-700/40' : 'border-border',
          ].join(' ')}
        >
          &ldquo;{quote}&rdquo;
        </blockquote>
      )}

      <div className="flex items-center justify-between mt-auto pt-1">
        <span className="font-mono text-[11px] text-muted-foreground">
          {isFirst ? '— first documented by ' : '— recorded by '}
          <span className={isFirst ? 'font-semibold text-foreground' : 'font-medium text-foreground/80'}>
            {entry.display_name}
          </span>
        </span>
        <span
          aria-hidden="true"
          className={['text-base', isFirst ? 'text-amber-700/60 dark:text-amber-500/60' : 'text-muted-foreground/40'].join(' ')}
        >
          ✽
        </span>
      </div>
    </div>
  )

  const article = (
    <article
      className={[
        'bg-card border rounded-sm overflow-hidden',
        'flex flex-col sm:flex-row',
        mirrored ? 'sm:flex-row-reverse' : '',
        isFirst ? 'border-amber-700/40 ring-1 ring-amber-500/20' : 'border-border',
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
