// ABOUT: Field Dispatches feed — groups feed entries by UTC day, picks one featured "Dispatch of the Day" per group
// ABOUT: Composes DatelineHeader / FeaturedDispatch / CompactDispatch / BadgeDispatch / Fleuron; preserves onViewSpecies API

import type { FeedEntry } from '@/hooks/useCommunity'
import { groupByDay } from '@/lib/feedDate'
import { Fleuron } from './Fleuron'
import { DatelineHeader } from './DatelineHeader'
import { FeaturedDispatch } from './FeaturedDispatch'
import { CompactDispatch } from './CompactDispatch'
import { BadgeDispatch } from './BadgeDispatch'

interface Props {
  entries: FeedEntry[]
  isLoading: boolean
  onViewSpecies?: (qrHash: string) => void
}

/**
 * Dispatch-of-the-day rule: per UTC-day group, pick one entry to feature.
 * Most recent first_discovery wins; fall back to most recent ordinary discovery.
 * Badge entries never qualify. Returns null when nothing in the group is eligible.
 *
 * The input is assumed to be in chronological order (DESC by created_at), as
 * returned by `get_community_feed`. "Most recent" therefore means the first
 * entry of the matching event_type in the group.
 */
function pickFeaturedId(entries: FeedEntry[]): string | null {
  const firstDiscovery = entries.find(e => e.event_type === 'first_discovery')
  if (firstDiscovery) return firstDiscovery.id
  const discovery = entries.find(e => e.event_type === 'discovery')
  if (discovery) return discovery.id
  return null
}

export default function ActivityTimeline({ entries, isLoading, onViewSpecies }: Props) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-20 rounded animate-pulse bg-accent/20" />
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

  const groups = groupByDay(entries)
  let featuredCount = 0 // walks chronologically across the whole feed for alternation

  return (
    <section aria-label="Activity timeline">
      {groups.map((group, gi) => {
        const featuredId = pickFeaturedId(group.entries)
        const groupDate = new Date(group.entries[0].created_at)

        return (
          <div key={group.dateKey}>
            <DatelineHeader date={groupDate} />

            {group.entries.map((entry, i) => {
              const isFeatured = entry.id === featuredId
              const prev = group.entries[i - 1]
              const showSeparator = i > 0 && !isFeatured && prev?.id !== featuredId

              if (isFeatured) {
                const mirrored = featuredCount % 2 === 1
                featuredCount += 1
                return (
                  <div key={entry.id}>
                    {i > 0 && <Fleuron />}
                    <FeaturedDispatch entry={entry} mirrored={mirrored} onViewSpecies={onViewSpecies} />
                    {i < group.entries.length - 1 && <Fleuron />}
                  </div>
                )
              }

              if (entry.event_type === 'badge_earned') {
                return (
                  <div key={entry.id}>
                    {showSeparator && <div className="border-t border-border/60" />}
                    <BadgeDispatch entry={entry} />
                  </div>
                )
              }

              return (
                <div key={entry.id}>
                  {showSeparator && <div className="border-t border-border/60" />}
                  <CompactDispatch entry={entry} onViewSpecies={onViewSpecies} />
                </div>
              )
            })}

            {gi < groups.length - 1 && <div className="h-3" />}
          </div>
        )
      })}
    </section>
  )
}
