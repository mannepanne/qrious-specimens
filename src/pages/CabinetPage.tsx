// ABOUT: Cabinet page — the authenticated naturalist's personal specimen collection
// ABOUT: Infinite-scroll grid of SpecimenTeaser cards; scan CTA triggers the QR scanner

import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCreatures, useDiscoveryCounts } from '@/hooks/useCreatures'
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver'
import { useCreatureStyle, type CreatureStyle } from '@/hooks/useCreatureStyle'
import SpecimenTeaser from '@/components/SpecimenTeaser/SpecimenTeaser'
import type { CreatureRow } from '@/types/creature'
import type { UseAuthReturn } from '@/hooks/useAuth'
import { ScanLine } from 'lucide-react'

interface CabinetPageProps {
  userId: string
  email: string
  signOut: UseAuthReturn['signOut']
  onOpenScanner: () => void
  onViewCreature: (creature: CreatureRow, index: number, allCreatures: CreatureRow[]) => void
}

const STYLE_LABELS: Record<CreatureStyle, string> = {
  'explorer-sketch':   'Explorer Sketch',
  'volumetric-sketch': 'Volumetric Sketch',
  'dark-scifi':        'Dark Sci-Fi',
  'generative-sketch': 'Generative Sketch',
}

export function CabinetPage({ userId, email, signOut, onOpenScanner, onViewCreature }: CabinetPageProps) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, status } = useCreatures(userId)
  const { style: creatureStyle, setStyle } = useCreatureStyle()
  // useIntersectionObserver creates and returns the ref; pass it to the sentinel element
  const sentinelRef = useIntersectionObserver(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage()
  })

  const allCreatures = data?.pages.flat() ?? []

  // Collect all QR hashes to get rarity data in bulk
  const qrHashes = allCreatures.map((c) => c.qr_hash)
  const { data: discoveryCounts } = useDiscoveryCounts(qrHashes)

  return (
    <main className="min-h-screen">
      {/* Cabinet header */}
      <div className="px-4 pt-8 pb-4 space-y-4">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="font-serif text-2xl font-medium">Cabinet of Curiosities</h1>
            <p className="font-serif text-sm text-muted-foreground italic mt-1">
              {allCreatures.length > 0
                ? `${allCreatures.length} specimen${allCreatures.length !== 1 ? 's' : ''} catalogued`
                : 'Awaiting your first discovery'}
            </p>
          </div>

          {/* Temp sign-out */}
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground font-mono mb-1 truncate max-w-[120px]">{email}</p>
            <Button variant="outline" size="sm" className="font-mono text-[10px] tracking-wider" onClick={signOut}>
              SIGN OUT
            </Button>
          </div>
        </div>

        {/* Specimen style selector */}
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] tracking-wider text-muted-foreground shrink-0">RENDER STYLE</span>
          <Select value={creatureStyle} onValueChange={(v) => setStyle(v as CreatureStyle)}>
            <SelectTrigger className="h-8 font-mono text-xs flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(STYLE_LABELS) as CreatureStyle[]).map((s) => (
                <SelectItem key={s} value={s} className="font-mono text-xs">
                  {STYLE_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Scan CTA */}
        <Button
          className="w-full gap-2 font-mono tracking-wider"
          onClick={onOpenScanner}
        >
          <ScanLine className="h-4 w-4" />
          EXCAVATE NEW SPECIMEN
        </Button>
      </div>

      {/* Loading state */}
      {status === 'pending' && (
        <div className="flex items-center justify-center py-20">
          <p className="font-mono text-xs text-muted-foreground tracking-widest animate-pulse">
            CONSULTING THE STRATA...
          </p>
        </div>
      )}

      {/* Error state */}
      {status === 'error' && (
        <div className="px-4 py-12 text-center">
          <p className="font-serif text-muted-foreground italic">
            The cabinet could not be reached. Please try again.
          </p>
        </div>
      )}

      {/* Empty state */}
      {status === 'success' && allCreatures.length === 0 && (
        <div className="px-4 py-16 text-center space-y-3">
          <p className="font-serif text-lg italic text-muted-foreground">
            No specimens yet
          </p>
          <p className="font-serif text-sm text-muted-foreground/70 max-w-xs mx-auto">
            Scan any QR code you encounter in the world to discover your first creature.
          </p>
        </div>
      )}

      {/* Specimen grid */}
      {allCreatures.length > 0 && (
        <div className="px-4 pb-8">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {allCreatures.map((creature, index) => (
              <SpecimenTeaser
                key={creature.id}
                creature={creature}
                discoveryCount={discoveryCounts?.[creature.qr_hash]}
                onClick={() => onViewCreature(creature, index, allCreatures)}
              />
            ))}
          </div>

          {/* Infinite scroll sentinel */}
          <div ref={sentinelRef} className="py-4 flex justify-center">
            {isFetchingNextPage && (
              <p className="font-mono text-[10px] text-muted-foreground tracking-widest animate-pulse">
                UNEARTHING MORE...
              </p>
            )}
          </div>
        </div>
      )}
    </main>
  )
}
