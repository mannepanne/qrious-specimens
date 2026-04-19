// ABOUT: Displays an explorer's current rank, score, progress to next rank, and stat breakdown
// ABOUT: Used in Settings (Phase 8) and available to Cabinet header for rank badge display

import type { ExplorerRank } from '@/hooks/useBadges'
import { RANK_DISPLAY } from '@/hooks/useBadges'

export { RANK_DISPLAY }

// Tier-specific colour classes
const TIER_COLOURS: Record<string, string> = {
  unranked: 'text-muted-foreground border-border',
  bronze:   'text-amber-700 border-amber-300',
  silver:   'text-slate-500 border-slate-300',
  gold:     'text-yellow-700 border-yellow-400',
  platinum: 'text-purple-700 border-purple-300',
}

const TIER_BAR: Record<string, string> = {
  unranked: 'bg-muted-foreground/40',
  bronze:   'bg-amber-500',
  silver:   'bg-slate-400',
  gold:     'bg-yellow-500',
  platinum: 'bg-purple-500',
}

interface Props {
  rank: ExplorerRank | null | undefined
  isLoading?: boolean
}

export default function ExplorerRankCard({ rank, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="border border-border rounded-sm p-4 space-y-3 animate-pulse bg-accent/10">
        <div className="h-5 w-40 bg-accent/30 rounded" />
        <div className="h-2 w-full bg-accent/30 rounded-full" />
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-8 bg-accent/20 rounded" />
          ))}
        </div>
      </div>
    )
  }

  if (!rank) return null

  const display = RANK_DISPLAY[rank.rank] ?? RANK_DISPLAY.unranked
  const colours = TIER_COLOURS[rank.rank] ?? TIER_COLOURS.unranked
  const barColour = TIER_BAR[rank.rank] ?? TIER_BAR.unranked
  const isPlatinum = rank.rank === 'platinum'
  const progressPct = Math.round(rank.progress * 100)

  return (
    <div className={['border rounded-sm p-4 space-y-4', colours].join(' ')}>
      {/* Rank name + score */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-mono text-[9px] tracking-[2px] text-muted-foreground">
            {display.label} RANK
          </p>
          <p className="font-serif text-lg font-medium mt-0.5">
            {rank.rank_icon} {display.name}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="font-mono text-[9px] tracking-[2px] text-muted-foreground">SCORE</p>
          <p className="font-mono text-base font-medium">{rank.score.toFixed(1)}</p>
        </div>
      </div>

      {/* Progress bar */}
      {isPlatinum ? (
        <div className="space-y-1">
          <div className="h-1.5 w-full rounded-full bg-border overflow-hidden">
            <div className={['h-full w-full rounded-full', barColour].join(' ')} />
          </div>
          <p className="font-mono text-[9px] tracking-wider text-muted-foreground">MAX RANK</p>
        </div>
      ) : (
        <div className="space-y-1">
          <div className="h-1.5 w-full rounded-full bg-border overflow-hidden">
            <div
              className={['h-full rounded-full transition-all', barColour].join(' ')}
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="font-mono text-[9px] tracking-wider text-muted-foreground">
            {rank.score.toFixed(1)} / {rank.next_threshold} · Progress to {RANK_DISPLAY[rank.next_rank]?.name ?? rank.next_rank}
          </p>
        </div>
      )}

      {/* Stat breakdown */}
      <div className="grid grid-cols-3 gap-x-4 gap-y-2">
        {[
          { label: 'SPECIMENS',  value: rank.breakdown.specimens  },
          { label: 'SPECIES',    value: rank.breakdown.species    },
          { label: 'BADGES',     value: rank.breakdown.badges     },
          { label: 'RARE FINDS', value: rank.breakdown.rare       },
          { label: 'FIRSTS',     value: rank.breakdown.firsts     },
          { label: 'DAYS ACTIVE',value: rank.breakdown.days_active},
        ].map(({ label, value }) => (
          <div key={label}>
            <p className="font-mono text-[8px] tracking-[1px] text-muted-foreground">{label}</p>
            <p className="font-mono text-sm font-medium">{value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
