// ABOUT: Badge-earned dispatch — emoji icon with tier-tinted ring, smallcaps prose
// ABOUT: Not clickable — there's no badge detail page to navigate to

import type { FeedEntry } from '@/hooks/useCommunity'

interface Props {
  entry: FeedEntry
}

const TIER_RING: Record<NonNullable<FeedEntry['badge_tier']>, string> = {
  bronze: 'ring-amber-700/30 bg-amber-50/40',
  silver: 'ring-slate-400/40 bg-slate-50/40',
  gold:   'ring-amber-500/40 bg-amber-50/60',
}

export function BadgeDispatch({ entry }: Props) {
  const ring = entry.badge_tier ? TIER_RING[entry.badge_tier] : 'ring-border bg-card'

  return (
    <article className="flex items-center gap-3 py-3 px-1">
      <span
        aria-hidden="true"
        className={['shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-xl ring-1', ring].join(' ')}
      >
        {entry.badge_icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-serif text-sm leading-snug">
          <span className="font-medium">{entry.display_name}</span>
          <span className="text-muted-foreground"> was awarded </span>
          <span className="italic">{entry.badge_name}</span>
        </p>
        {entry.badge_tier && (
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground mt-0.5">
            {entry.badge_tier} tier
          </p>
        )}
      </div>
    </article>
  )
}
