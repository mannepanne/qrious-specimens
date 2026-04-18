// ABOUT: Community headline stats bar for the Gazette
// ABOUT: Shows total explorers, specimens catalogued, and species discovered

import type { CommunityStats } from '@/hooks/useCommunity'

interface Props {
  stats: CommunityStats | undefined
  isLoading: boolean
}

export default function CommunityStats({ stats, isLoading }: Props) {
  if (isLoading || !stats) {
    return (
      <div className="flex justify-center gap-6 py-1">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex gap-1.5 items-center">
            <div className="h-2.5 w-6 rounded animate-pulse bg-accent/30" />
            <div className="h-2.5 w-14 rounded animate-pulse bg-accent/20" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="flex justify-center gap-5 font-mono text-[10px] tracking-widest text-muted-foreground">
      <span><span className="text-foreground">{stats.total_explorers}</span> EXPLORERS</span>
      <span aria-hidden="true">·</span>
      <span><span className="text-foreground">{stats.total_specimens}</span> SPECIMENS</span>
      <span aria-hidden="true">·</span>
      <span><span className="text-foreground">{stats.total_species}</span> SPECIES</span>
    </div>
  )
}
