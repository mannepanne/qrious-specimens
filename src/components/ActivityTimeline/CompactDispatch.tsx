// ABOUT: Compact dispatch — 80px illustration thumb, italic pull-quote excerpt, signature line
// ABOUT: Whole card is the click target → species page; first_discovery entries get a "First sighting" eyebrow

import type { FeedEntry } from '@/hooks/useCommunity'
import { excerptFromFieldNotes, timeOfDay } from '@/lib/feedDate'

interface Props {
  entry: FeedEntry
  onViewSpecies?: (qrHash: string) => void
}

export function CompactDispatch({ entry, onViewSpecies }: Props) {
  const quote = entry.pull_quote ?? excerptFromFieldNotes(entry.field_notes)
  const isFirst = entry.event_type === 'first_discovery'
  const isClickable = !!entry.qr_hash && !!onViewSpecies
  const date = new Date(entry.created_at)

  const article = (
    <article className={['flex gap-4 py-3.5', isFirst ? 'pl-2 border-l-2 border-amber-700/40' : ''].join(' ')}>
      {entry.species_image_url && (
        <img
          src={entry.species_image_url}
          alt=""
          aria-hidden="true"
          className="w-20 h-20 shrink-0 rounded-sm object-contain bg-accent/20"
          loading="lazy"
        />
      )}

      <div className="flex-1 min-w-0">
        {isFirst && (
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] font-semibold text-amber-700 dark:text-amber-500 mb-0.5 flex items-center gap-1">
            <span aria-hidden="true">⭐</span>
            <span>First sighting</span>
          </p>
        )}

        <p className="font-serif text-[15px] leading-snug">
          <span className="italic">{entry.species_name}</span>
        </p>

        {quote && (
          <p className="font-serif text-sm italic text-foreground/70 leading-snug mt-1 line-clamp-3">
            &ldquo;{quote}&rdquo;
          </p>
        )}

        <p className="font-mono text-[10px] text-muted-foreground mt-1.5">
          {isFirst ? '— first documented by ' : '— '}
          <span className={isFirst ? 'font-semibold text-foreground/80' : ''}>{entry.display_name}</span>
          {' · '}
          {timeOfDay(date)}
        </p>
      </div>
    </article>
  )

  if (isClickable) {
    return (
      <button
        type="button"
        onClick={() => onViewSpecies!(entry.qr_hash!)}
        aria-label={`View ${entry.species_name ?? 'species'} in catalogue`}
        className="block w-full text-left transition-colors hover:bg-accent/20 rounded-sm px-1"
      >
        {article}
      </button>
    )
  }

  return article
}
