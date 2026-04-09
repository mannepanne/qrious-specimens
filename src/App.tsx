// ABOUT: Root application component — layered navigation shell with per-destination auth
// ABOUT: Catalogue and Gazette are publicly browsable; Cabinet and overlays require auth

import { useState, useRef, useEffect, useCallback } from 'react'
import { QueryClientProvider, useQueryClient } from '@tanstack/react-query'
import type { InfiniteData } from '@tanstack/react-query'
import { toast } from 'sonner'
import { queryClient } from '@/lib/queryClient'
import { Toaster } from '@/components/ui/sonner'
import { useAuth } from '@/hooks/useAuth'
import { TabBar, type Tab } from '@/components/TabBar/TabBar'
import { SiteFooter } from '@/components/SiteFooter/SiteFooter'
import { CreatureStyleProvider } from '@/hooks/useCreatureStyle'
import { useAddCreature, useUpdateNickname } from '@/hooks/useCreatures'
import type { CreatureRow } from '@/types/creature'
import { generateCreatureDNA } from '@/lib/creatureEngine'
import { AuthPage } from '@/pages/AuthPage'
import { CataloguePage } from '@/pages/CataloguePage'
import { GazettePage } from '@/pages/GazettePage'
import { CabinetPage } from '@/pages/CabinetPage'
import { SpecimenPage } from '@/pages/SpecimenPage'
import QrScanner from '@/components/QrScanner/QrScanner'
import HatchingAnimation from '@/components/HatchingAnimation/HatchingAnimation'
import type { CreatureDNA } from '@/types/creature'

type Overlay = 'scanner' | 'hatching' | null

// Cabinet requires an active session. Catalogue and Gazette are publicly browsable.
const AUTH_REQUIRED_TABS: Tab[] = ['cabinet']

function AppShell() {
  const { authState, sendMagicLink, signOut } = useAuth()
  const [activeTab, setActiveTab] = useState<Tab>('catalogue')
  const [overlay, setOverlay] = useState<Overlay>(null)
  const [hatchingDna, setHatchingDna] = useState<CreatureDNA | null>(null)
  const [viewingCreature, setViewingCreature] = useState<CreatureRow | null>(null)
  const [cabinetIndex, setCabinetIndex] = useState<{ index: number; total: number } | null>(null)
  // Used to collect cabinet creatures for prev/next navigation from SpecimenPage
  const cabinetCreaturesRef = useRef<CreatureRow[]>([])

  const addCreature = useAddCreature()
  const updateNickname = useUpdateNickname()
  const queryClient = useQueryClient()

  // Store hatching result while animation plays
  const hatchingResultRef = useRef<CreatureRow | null>(null)
  const hatchingErrorRef = useRef<string | null>(null)
  // Set to true when the animation fires onComplete while the insert is still pending
  const animationDoneRef = useRef(false)

  // Extracted so it can be called by both handleHatchingComplete and the
  // useEffect that watches for the insert settling after animation finishes.
  // Must be declared before early returns to satisfy the rules of hooks.
  const finishHatching = useCallback(() => {
    animationDoneRef.current = false
    setOverlay(null)
    setHatchingDna(null)

    if (hatchingResultRef.current) {
      setViewingCreature(hatchingResultRef.current)
      setCabinetIndex(null) // from scan, no prev/next context
    } else if (hatchingErrorRef.current === 'DUPLICATE') {
      toast('This specimen is already in your cabinet.', { description: 'Each QR code yields the same creature.' })
    } else if (hatchingErrorRef.current) {
      toast('Could not add specimen', { description: 'Please try again.' })
    }
  }, [])

  // When the insert settles AFTER the animation already finished (race: slow network),
  // complete the transition that handleHatchingComplete deferred
  useEffect(() => {
    if (animationDoneRef.current && !addCreature.isPending) {
      finishHatching()
    }
  }, [addCreature.isPending, finishHatching])

  if (authState.status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="animate-pulse text-muted-foreground text-sm font-mono tracking-widest">
          Loading…
        </p>
      </div>
    )
  }

  if (authState.status === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="text-center space-y-3">
          <p className="font-serif text-lg">Could not connect to the Cabinet</p>
          <p className="text-sm text-muted-foreground">{authState.message}</p>
          <button
            className="text-sm underline underline-offset-4 hover:text-foreground text-muted-foreground"
            onClick={() => window.location.reload()}
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  const isAuthenticated = authState.status === 'authenticated'
  const userId = isAuthenticated ? authState.session.user.id : ''
  const email = isAuthenticated ? (authState.session.user.email ?? '') : ''

  const tabNeedsAuth = AUTH_REQUIRED_TABS.includes(activeTab)
  if (!isAuthenticated && tabNeedsAuth) {
    return <AuthPage sendMagicLink={sendMagicLink} />
  }

  // ── Scan flow ──────────────────────────────────────────────────────────

  function handleScan(content: string) {
    // Clamp to 4096 chars — keeps insert lean and prevents main-thread pin on hash loop
    const clamped = content.slice(0, 4096)
    const dna = generateCreatureDNA(clamped)

    // Fast duplicate check against the cached cabinet before starting the animation
    const cached = queryClient.getQueryData<InfiniteData<CreatureRow[]>>(['creatures', userId])
    const allCached = cached?.pages.flat() ?? []
    if (allCached.some((c) => c.qr_hash === dna.hash)) {
      setOverlay(null)
      toast('This specimen is already in your cabinet.', { description: 'Each QR code yields the same creature.' })
      return
    }

    hatchingResultRef.current = null
    hatchingErrorRef.current = null
    animationDoneRef.current = false

    // Close scanner, start hatching immediately
    setHatchingDna(dna)
    setOverlay('hatching')

    // Insert in parallel — hatching animation buys time
    addCreature.mutateAsync({ userId, qrContent: clamped, dna }).then((row) => {
      hatchingResultRef.current = row
    }).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err)
      hatchingErrorRef.current = msg
    })
  }

  function handleHatchingComplete() {
    if (addCreature.isPending) {
      // Insert hasn't settled yet — defer the transition; the useEffect above will
      // call finishHatching() as soon as isPending flips to false
      animationDoneRef.current = true
      return
    }
    finishHatching()
  }

  // ── Cabinet navigation ─────────────────────────────────────────────────

  function handleViewCreature(creature: CreatureRow, index: number, allCreatures: CreatureRow[]) {
    cabinetCreaturesRef.current = allCreatures
    setViewingCreature(creature)
    setCabinetIndex({ index, total: allCreatures.length })
  }

  function handlePrevCreature() {
    if (!cabinetIndex) return
    const prev = cabinetCreaturesRef.current[cabinetIndex.index - 1]
    if (prev) {
      setViewingCreature(prev)
      setCabinetIndex({ index: cabinetIndex.index - 1, total: cabinetIndex.total })
    }
  }

  function handleNextCreature() {
    if (!cabinetIndex) return
    const next = cabinetCreaturesRef.current[cabinetIndex.index + 1]
    if (next) {
      setViewingCreature(next)
      setCabinetIndex({ index: cabinetIndex.index + 1, total: cabinetIndex.total })
    }
  }

  function handleUpdateNickname(id: string, nickname: string) {
    updateNickname.mutate({ id, nickname, userId })
    // Optimistically update the viewing creature
    if (viewingCreature?.id === id) {
      setViewingCreature({ ...viewingCreature, nickname })
    }
  }

  // ── Specimen page (from scan or cabinet click) ─────────────────────────

  if (viewingCreature) {
    return (
      <SpecimenPage
        creature={viewingCreature}
        onBack={() => setViewingCreature(null)}
        onUpdateNickname={handleUpdateNickname}
        currentIndex={cabinetIndex?.index}
        totalCount={cabinetIndex?.total}
        onPrev={cabinetIndex ? handlePrevCreature : undefined}
        onNext={cabinetIndex ? handleNextCreature : undefined}
      />
    )
  }

  // ── Main shell ─────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex-1 pb-16">
        {activeTab === 'catalogue' && <CataloguePage />}
        {activeTab === 'gazette'   && <GazettePage />}
        {activeTab === 'cabinet'   && isAuthenticated && (
          <CabinetPage
            userId={userId}
            email={email}
            signOut={signOut}
            onOpenScanner={() => setOverlay('scanner')}
            onViewCreature={handleViewCreature}
          />
        )}
      </div>

      <SiteFooter />
      <TabBar
        activeTab={activeTab}
        onTabChange={(tab) => { setActiveTab(tab); setOverlay(null) }}
        hidden={overlay !== null}
      />

      {/* Scanner overlay */}
      {overlay === 'scanner' && (
        <QrScanner
          onScan={handleScan}
          onClose={() => setOverlay(null)}
        />
      )}

      {/* Hatching animation overlay */}
      {overlay === 'hatching' && hatchingDna && (
        <HatchingAnimation
          dna={hatchingDna}
          onComplete={handleHatchingComplete}
        />
      )}
    </div>
  )
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <CreatureStyleProvider>
        <AppShell />
        <Toaster />
      </CreatureStyleProvider>
    </QueryClientProvider>
  )
}
