// ABOUT: Cabinet page — the authenticated naturalist's personal specimen collection
// ABOUT: Infinite-scroll grid of SpecimenTeaser cards; scan CTA triggers the QR scanner overlay

import { useNavigate } from 'react-router-dom'
import { useMemo } from 'react'
import { BookOpen, LogOut, Scan, ScanLine, Settings } from 'lucide-react'
import { useCreatures, useDiscoveryCounts } from '@/hooks/useCreatures'
import { useAuth } from '@/hooks/useAuth'
import { useScanOverlay } from '@/App'
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver'
import { useExplorerRank, RANK_DISPLAY } from '@/hooks/useBadges'
import SpecimenTeaser from '@/components/SpecimenTeaser/SpecimenTeaser'
import type { CreatureRow } from '@/types/creature'
import { getRarityFromCount } from '@/lib/rarity'

export function CabinetPage() {
  const navigate = useNavigate()
  const { authState, signOut } = useAuth()
  const { openScanner } = useScanOverlay()

  // Cabinet is only rendered inside RequireAuth, so authState is always 'authenticated' here
  const userId = authState.status === 'authenticated' ? authState.session.user.id : ''
  const { data: explorerRank } = useExplorerRank(userId || null)

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, status } = useCreatures(userId)
  const sentinelRef = useIntersectionObserver(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage()
  })

  const allCreatures = data?.pages.flat() ?? []
  const qrHashes = allCreatures.map((c) => c.qr_hash)
  const { data: discoveryCounts } = useDiscoveryCounts(qrHashes)

  const rareCounts = {
    common:   allCreatures.filter((c) => getRarityFromCount(discoveryCounts?.[c.qr_hash]) === 'common').length,
    uncommon: allCreatures.filter((c) => getRarityFromCount(discoveryCounts?.[c.qr_hash]) === 'uncommon').length,
    rare:     allCreatures.filter((c) => getRarityFromCount(discoveryCounts?.[c.qr_hash]) === 'rare').length,
  }

  // Rotating Victorian expedition quotes — one per session, chosen on mount
  const expeditionQuote = useMemo(() => {
    const quotes = [
      'What the strata conceals, perseverance shall reveal.',
      'Curiosity is the only instrument worth carrying into the field.',
      'Every specimen tells a story older than memory.',
      'She walked the beach after every storm, for the sea gives up its secrets slowly.',
      'One finds not what one expects, but what one is prepared to see.',
      'The field naturalist knows that the world does not wait to be asked.',
      'To look is not yet to see; to see is not yet to understand.',
    ]
    return quotes[Math.floor(Math.random() * quotes.length)]
  }, [])

  function handleViewCreature(creature: CreatureRow, index: number, allCreatures: CreatureRow[]) {
    // Pass the full cabinet list so SpecimenPage can offer prev/next navigation
    navigate(`/specimen/${creature.id}`, {
      state: { creature, cabinetCreatures: allCreatures, cabinetIndex: index },
    })
  }

  return (
    <main className="flex flex-col h-full">
      {/* Cabinet header */}
      <div className="px-4 pt-4 pb-3 shrink-0 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-sm bg-foreground flex items-center justify-center shrink-0">
            <Scan className="h-4 w-4 text-background" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-serif text-lg font-medium leading-tight">QRious Specimens</h1>
            <p className="font-serif text-[10px] italic text-muted-foreground/60 leading-tight truncate">
              {expeditionQuote}
            </p>
            <p className="font-mono text-[9px] tracking-[2px] text-muted-foreground">
              {allCreatures.length > 0
                ? `${allCreatures.length} IN YOUR CABINET`
                : 'YOUR CABINET OF CURIOSITIES'}
              {explorerRank?.rank && explorerRank.rank !== 'unranked' && (
                <span
                  title={RANK_DISPLAY[explorerRank.rank]?.name}
                  aria-label={`Rank: ${RANK_DISPLAY[explorerRank.rank]?.name ?? explorerRank.rank}`}
                >
                  {' · '}{explorerRank.rank_icon} {explorerRank.rank.toUpperCase()}
                </span>
              )}
            </p>
          </div>
          <button
            onClick={() => navigate('/settings')}
            className="flex items-center gap-1.5 font-mono text-[10px] tracking-wider text-muted-foreground hover:text-foreground transition-colors shrink-0"
            title="Settings"
          >
            <Settings className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Settings</span>
          </button>
          <button
            onClick={signOut}
            className="flex items-center gap-1.5 font-mono text-[10px] tracking-wider text-muted-foreground hover:text-foreground transition-colors shrink-0"
            title="Close journal"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Close journal</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-4 space-y-4 max-w-2xl mx-auto">
          {/* Rarity stats bar */}
          {allCreatures.length > 0 && (
            <div className="flex gap-4 font-mono text-[10px] tracking-wider text-muted-foreground">
              {rareCounts.common   > 0 && <span>COMMON {rareCounts.common}</span>}
              {rareCounts.uncommon > 0 && <span>UNCOMMON {rareCounts.uncommon}</span>}
              {rareCounts.rare     > 0 && <span className="text-foreground">RARE {rareCounts.rare}</span>}
            </div>
          )}

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
            <div className="py-12 text-center">
              <p className="font-serif text-muted-foreground italic">
                The cabinet could not be reached. Please try again.
              </p>
            </div>
          )}

          {/* Empty state */}
          {status === 'success' && allCreatures.length === 0 && (
            <div className="py-16 text-center space-y-6">
              <BookOpen className="h-12 w-12 mx-auto text-muted-foreground/40" />
              <div>
                <p className="font-serif text-lg text-muted-foreground">
                  Your cabinet of curiosities awaits
                </p>
                <p className="font-serif text-sm text-muted-foreground/70 italic mt-1">
                  <button
                    onClick={openScanner}
                    className="underline hover:text-muted-foreground transition-colors"
                  >
                    Scan a QR code to resurrect your first specimen
                  </button>{' '}
                  from the digital strata
                </p>
              </div>
            </div>
          )}

          {/* Specimen grid */}
          {allCreatures.length > 0 && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {allCreatures.map((creature, index) => (
                  <SpecimenTeaser
                    key={creature.id}
                    creature={creature}
                    discoveryCount={discoveryCounts?.[creature.qr_hash]}
                    onClick={() => handleViewCreature(creature, index, allCreatures)}
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
            </>
          )}
        </div>
      </div>

      {/* Floating action button — excavate new specimen */}
      <button
        onClick={openScanner}
        aria-label="Excavate new specimen"
        className="fixed bottom-20 right-5 z-50 flex items-center gap-2 bg-foreground text-background font-mono text-[11px] tracking-widest px-4 py-3 rounded-full shadow-lg hover:opacity-90 active:scale-95 transition-all"
      >
        <ScanLine className="h-4 w-4 shrink-0" />
        EXCAVATE
      </button>
    </main>
  )
}
