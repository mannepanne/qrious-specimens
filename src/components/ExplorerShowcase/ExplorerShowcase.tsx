// ABOUT: Grid of public explorer profiles in the Gazette showcase
// ABOUT: Shows initials avatar, display name, specimen count, and earned badge icons

import type { ShowcaseExplorer } from '@/hooks/useCommunity'

interface Props {
  explorers: ShowcaseExplorer[]
  isLoading: boolean
}

/** Two-letter initials extracted from a display name ("Dr. A. Darwin" → "AD"). */
function initials(displayName: string): string {
  const words = displayName.replace(/^[A-Za-z]+\.\s*/, '').split(/\s+/)
  return words
    .slice(0, 2)
    .map(w => w[0] ?? '')
    .join('')
    .toUpperCase()
}

function ExplorerCard({ explorer }: { explorer: ShowcaseExplorer }) {
  return (
    <article className="border border-border rounded-lg p-3 flex flex-col gap-2">
      {/* Avatar + name */}
      <div className="flex items-center gap-2">
        <div
          aria-hidden="true"
          className="shrink-0 w-9 h-9 rounded-full bg-accent flex items-center justify-center font-mono text-xs font-semibold"
        >
          {initials(explorer.display_name)}
        </div>
        <div className="min-w-0">
          <p className="font-mono text-xs font-medium truncate">{explorer.display_name}</p>
          <p className="font-mono text-[10px] text-muted-foreground">
            {explorer.specimen_count} specimen{explorer.specimen_count !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Badge icons (up to 5 shown) */}
      {explorer.badges.length > 0 && (
        <div className="flex flex-wrap gap-1" aria-label="Earned badges">
          {explorer.badges.slice(0, 5).map(badge => (
            <span
              key={badge.slug}
              title={badge.name}
              className="text-sm"
              aria-label={badge.name}
            >
              {badge.icon}
            </span>
          ))}
          {explorer.badges.length > 5 && (
            <span className="font-mono text-[10px] text-muted-foreground self-center">
              +{explorer.badges.length - 5}
            </span>
          )}
        </div>
      )}
    </article>
  )
}

export default function ExplorerShowcase({ explorers, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-20 rounded-lg border border-border animate-pulse bg-accent/20" />
        ))}
      </div>
    )
  }

  if (explorers.length === 0) {
    return (
      <p className="font-serif text-sm italic text-muted-foreground text-center py-6">
        No explorers have joined the Gazette yet.
      </p>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {explorers.map(explorer => (
        <ExplorerCard key={explorer.user_id} explorer={explorer} />
      ))}
    </div>
  )
}
