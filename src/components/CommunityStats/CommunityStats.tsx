// ABOUT: Community headline stats bar for the Gazette
// ABOUT: Shows total explorers, specimens catalogued, and species discovered

import type { CommunityStats } from '@/hooks/useCommunity'

interface Props {
  stats: CommunityStats | undefined
  isLoading: boolean
}

function StatItem({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="font-mono text-lg font-semibold tabular-nums">{value}</span>
      <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
    </div>
  )
}

export default function CommunityStats({ stats, isLoading }: Props) {
  if (isLoading || !stats) {
    return (
      <div className="flex justify-around py-3 border border-border rounded-lg">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <div className="h-6 w-12 rounded animate-pulse bg-accent/30" />
            <div className="h-3 w-16 rounded animate-pulse bg-accent/20" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="flex justify-around py-3 border border-border rounded-lg">
      <StatItem label="Explorers"  value={stats.total_explorers} />
      <StatItem label="Specimens"  value={stats.total_specimens} />
      <StatItem label="Species"    value={stats.total_species} />
    </div>
  )
}
