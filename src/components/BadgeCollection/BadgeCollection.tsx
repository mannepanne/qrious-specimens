// ABOUT: Grid of all badge definitions showing earned (with tier) or locked state
// ABOUT: Used in Settings (Phase 8); receives definitions and earned badge slugs as props

import type { BadgeDefinition, ExplorerBadge } from '@/hooks/useBadges'

const TIER_LABEL: Record<string, string> = {
  bronze:   'BRONZE',
  silver:   'SILVER',
  gold:     'GOLD',
}

const TIER_COLOURS: Record<string, string> = {
  bronze:  'text-amber-700 border-amber-300 bg-amber-50/60',
  silver:  'text-slate-500 border-slate-300 bg-slate-50/60',
  gold:    'text-yellow-700 border-yellow-400 bg-yellow-50/60',
}

interface Props {
  definitions: BadgeDefinition[]
  earnedBadges: ExplorerBadge[]
  isLoading?: boolean
}

export default function BadgeCollection({ definitions, earnedBadges, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-20 rounded-sm border border-border animate-pulse bg-accent/10" />
        ))}
      </div>
    )
  }

  const earnedSlugs = new Set(earnedBadges.map(b => b.badge_slug))

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {definitions.map(def => {
        const isEarned = earnedSlugs.has(def.slug)
        const tierColour = TIER_COLOURS[def.tier] ?? 'text-muted-foreground border-border bg-card'

        return (
          <div
            key={def.slug}
            className={[
              'border rounded-sm p-3 flex flex-col gap-1 transition-colors',
              isEarned ? tierColour : 'border-border bg-card opacity-50',
            ].join(' ')}
          >
            <span className="text-2xl" aria-hidden="true">{isEarned ? def.icon : '🔒'}</span>
            <p className="font-serif text-xs font-medium leading-tight">{def.name}</p>
            <p className={[
              'font-mono text-[8px] tracking-[1.5px]',
              isEarned ? '' : 'text-muted-foreground',
            ].join(' ')}>
              {isEarned ? (TIER_LABEL[def.tier] ?? def.tier.toUpperCase()) : 'LOCKED'}
            </p>
          </div>
        )
      })}
    </div>
  )
}
