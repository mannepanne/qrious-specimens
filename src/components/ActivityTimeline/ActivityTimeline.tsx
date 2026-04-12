// ABOUT: Chronological feed of public discoveries and badge awards in the Gazette
// ABOUT: Colour-coded dots per event type; clicking a discovery entry opens its species in the Catalogue

import type { FeedEntry } from '@/hooks/useCommunity'

interface Props {
  entries: FeedEntry[]
  isLoading: boolean
  onViewSpecies?: (qrHash: string) => void
}

/** Dot colour classes for each event type. */
const EVENT_DOT: Record<FeedEntry['event_type'], string> = {
  discovery:       'bg-emerald-500',
  first_discovery: 'bg-purple-500',
  rare_discovery:  'bg-amber-500',
  badge_earned:    'bg-blue-500',
}

/** Human-readable time-ago string (coarse, no i18n library needed). */
function timeAgo(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime()
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1)  return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24)   return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30)    return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

function EntryText({ entry }: { entry: FeedEntry }) {
  switch (entry.event_type) {
    case 'discovery':
      return (
        <>
          <span className="font-medium">{entry.display_name}</span>
          {' discovered '}
          <span className="italic">{entry.species_name}</span>
        </>
      )
    case 'rare_discovery':
      return (
        <>
          <span className="font-medium">{entry.display_name}</span>
          {' discovered a rare '}
          <span className="italic">{entry.species_name}</span>
        </>
      )
    case 'first_discovery':
      return (
        <>
          <span className="font-medium">{entry.display_name}</span>
          {' was first to discover '}
          <span className="italic">{entry.species_name}</span>
        </>
      )
    case 'badge_earned':
      return (
        <>
          <span className="font-medium">{entry.display_name}</span>
          {' earned '}
          <span>{entry.badge_icon} {entry.badge_name}</span>
        </>
      )
  }
}

function TimelineEntry({ entry, onViewSpecies }: { entry: FeedEntry; onViewSpecies?: (qrHash: string) => void }) {
  const isDiscovery = entry.event_type !== 'badge_earned'
  const isClickable = isDiscovery && !!entry.qr_hash && !!onViewSpecies

  const content = (
    <div className="flex items-start gap-3">
      {/* Colour-coded dot */}
      <span
        className={[
          'mt-1.5 shrink-0 w-2 h-2 rounded-full',
          EVENT_DOT[entry.event_type],
        ].join(' ')}
        aria-hidden="true"
      />

      {/* Thumbnail (discoveries only) */}
      {entry.species_image_url && (
        <img
          src={entry.species_image_url}
          alt=""
          aria-hidden="true"
          width={40}
          height={40}
          loading="lazy"
          className="shrink-0 w-10 h-10 rounded object-contain bg-accent/20"
        />
      )}

      {/* Text + timestamp */}
      <div className="flex-1 min-w-0">
        <p className="font-mono text-xs leading-snug">
          <EntryText entry={entry} />
        </p>
        <p className="font-mono text-[10px] text-muted-foreground mt-0.5">
          {timeAgo(entry.created_at)}
        </p>
      </div>
    </div>
  )

  if (isClickable) {
    return (
      <button
        onClick={() => onViewSpecies!(entry.qr_hash!)}
        className="w-full text-left hover:bg-accent/40 rounded px-2 py-1.5 transition-colors"
        aria-label={`View ${entry.species_name ?? 'species'} in catalogue`}
      >
        {content}
      </button>
    )
  }

  return <div className="px-2 py-1.5">{content}</div>
}

export default function ActivityTimeline({ entries, isLoading, onViewSpecies }: Props) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-10 rounded animate-pulse bg-accent/20" />
        ))}
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <p className="font-serif text-sm italic text-muted-foreground text-center py-6">
        No activity recorded yet. Be the first to make your mark in the Gazette.
      </p>
    )
  }

  return (
    <ol aria-label="Activity timeline" className="space-y-0.5">
      {entries.map(entry => (
        <li key={entry.id}>
          <TimelineEntry entry={entry} onViewSpecies={onViewSpecies} />
        </li>
      ))}
    </ol>
  )
}
