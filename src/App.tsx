// ABOUT: Root application component — layered navigation shell with per-destination auth
// ABOUT: Catalogue and Gazette are publicly browsable; Cabinet and overlays require auth

import { useState, useRef, useEffect, useCallback } from 'react'
import { QueryClientProvider, useQueryClient } from '@tanstack/react-query'
import type { InfiniteData } from '@tanstack/react-query'
import { toast } from 'sonner'
import { queryClient } from '@/lib/queryClient'
import { Toaster } from '@/components/ui/sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { TabBar, type Tab } from '@/components/TabBar/TabBar'
import { SiteFooter } from '@/components/SiteFooter/SiteFooter'
import { useAddCreature, useUpdateNickname } from '@/hooks/useCreatures'
import type { CreatureRow } from '@/types/creature'
import type { WorkerResponse } from '@/types/worker'
import { generateCreatureDNA } from '@/lib/creatureEngine'
import { AuthPage } from '@/pages/AuthPage'
import { CataloguePage } from '@/pages/CataloguePage'
import { GazettePage } from '@/pages/GazettePage'
import { CabinetPage } from '@/pages/CabinetPage'
import { SpecimenPage } from '@/pages/SpecimenPage'
import QrScanner from '@/components/QrScanner/QrScanner'
import ExcavationAnimation from '@/components/ExcavationAnimation/ExcavationAnimation'
import type { ExcavationWorkerResult } from '@/components/ExcavationAnimation/ExcavationAnimation'
import type { CreatureDNA } from '@/types/creature'

type Overlay = 'scanner' | 'excavating' | null

// Cabinet requires an active session. Catalogue and Gazette are publicly browsable.
const AUTH_REQUIRED_TABS: Tab[] = ['cabinet']

function AppShell() {
  const { authState, sendMagicLink, signOut } = useAuth()
  const [activeTab, setActiveTab] = useState<Tab>('catalogue')
  const [overlay, setOverlay] = useState<Overlay>(null)
  const [excavatingDna, setExcavatingDna] = useState<CreatureDNA | null>(null)
  const [excavationWorkerResult, setExcavationWorkerResult] = useState<ExcavationWorkerResult | null>(null)
  const [viewingCreature, setViewingCreature] = useState<CreatureRow | null>(null)
  const [cabinetIndex, setCabinetIndex] = useState<{ index: number; total: number } | null>(null)
  // Snapshot of cabinet creatures for prev/next navigation from SpecimenPage (TD-002)
  const cabinetCreaturesRef = useRef<CreatureRow[]>([])

  const addCreature = useAddCreature()
  const updateNickname = useUpdateNickname()
  const queryClient = useQueryClient()

  // Store excavation state in refs for access from callbacks without stale closures
  const excavationResultRef = useRef<CreatureRow | null>(null)
  const excavationErrorRef = useRef<string | null>(null)
  const excavationWorkerResponseRef = useRef<WorkerResponse | null>(null)
  // Set to true when animation fires onComplete while the insert is still pending
  const animationDoneRef = useRef(false)
  // Prevent calling the Worker more than once per excavation
  const workerCalledRef = useRef(false)
  // Set to true if Worker call failed with no image
  const workerFailedRef = useRef(false)

  // Extracted so it can be called by both handleExcavationComplete and the
  // useEffect that watches for the insert settling after animation finishes.
  // Must be declared before early returns to satisfy the rules of hooks.
  const finishExcavation = useCallback(() => {
    animationDoneRef.current = false
    setOverlay(null)
    setExcavatingDna(null)
    setExcavationWorkerResult(null)

    if (excavationResultRef.current) {
      const creature = excavationResultRef.current
      const isFirstDiscoverer = excavationWorkerResponseRef.current?.isFirstDiscoverer ?? false

      // Reflect first-discoverer status immediately without waiting for a cabinet reload
      setViewingCreature(isFirstDiscoverer ? { ...creature, is_first_discoverer: true } : creature)
      setCabinetIndex(null) // from scan, no prev/next context

      // First discoverer notification — only when this user is the first globally
      if (isFirstDiscoverer) {
        toast('First discoverer!', {
          description: 'You are the first naturalist to catalogue this species.',
        })
      }

      // Worker failed — specimen added to cabinet but no illustration captured
      if (workerFailedRef.current) {
        toast('The specimen eluded our naturalist.', {
          description: 'The illustration could not be captured — try viewing the specimen again.',
        })
      }
    } else if (excavationErrorRef.current === 'DUPLICATE') {
      toast('This specimen is already in your cabinet.', { description: 'Each QR code yields the same creature.' })
    } else if (excavationErrorRef.current) {
      toast('Could not add specimen', { description: 'Please try again.' })
    }
  }, [])

  // When the insert settles AFTER the animation already finished (race: slow network),
  // complete the transition that handleExcavationComplete deferred
  useEffect(() => {
    if (animationDoneRef.current && !addCreature.isPending) {
      finishExcavation()
    }
  }, [addCreature.isPending, finishExcavation])

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

    excavationResultRef.current = null
    excavationErrorRef.current = null
    excavationWorkerResponseRef.current = null
    animationDoneRef.current = false
    workerCalledRef.current = false
    workerFailedRef.current = false

    // Close scanner, start excavation immediately
    setExcavatingDna(dna)
    setExcavationWorkerResult(null)
    setOverlay('excavating')

    // Insert in parallel — excavation animation buys time
    addCreature.mutateAsync({ userId, qrContent: clamped, dna }).then((row) => {
      excavationResultRef.current = row
    }).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err)
      excavationErrorRef.current = msg
    })
  }

  // NOTE: handleCommission calls /api/generate-creature directly rather than via useSpeciesImage.
  // This is intentional — the scan flow needs to pass the Worker result to ExcavationAnimation
  // at a precise phase, which requires direct control over timing. useSpeciesImage covers all
  // other entry points (SpecimenPage, SpecimenTeaser) where passive background loading is fine.
  /** Fired by ExcavationAnimation when COMMISSIONING ILLUSTRATION phase begins */
  async function handleCommission() {
    if (workerCalledRef.current || !excavatingDna) return
    workerCalledRef.current = true

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const res = await fetch('/api/generate-creature', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ qrHash: excavatingDna.hash, dna: excavatingDna }),
      })

      const data = res.ok
        ? (await res.json()) as WorkerResponse
        : null

      if (!data) workerFailedRef.current = true
      excavationWorkerResponseRef.current = data

      // Unblock the animation — even on failure, pass a result so animation can proceed
      setExcavationWorkerResult({
        imageUrl512: data?.imageUrl512 ?? null,
        isFirstDiscoverer: data?.isFirstDiscoverer ?? false,
      })
    } catch {
      // Network failure — unblock animation with no image
      workerFailedRef.current = true
      setExcavationWorkerResult({ imageUrl512: null, isFirstDiscoverer: false })
    }
  }

  function handleExcavationComplete() {
    if (addCreature.isPending) {
      // Insert hasn't settled yet — defer the transition; the useEffect above will
      // call finishExcavation() as soon as isPending flips to false
      animationDoneRef.current = true
      return
    }
    finishExcavation()
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
        {activeTab === 'catalogue' && (
          <CataloguePage
            isAuthenticated={isAuthenticated}
            onSignUpCta={() => setActiveTab('cabinet')}
          />
        )}
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

      {/* Excavation animation overlay */}
      {overlay === 'excavating' && excavatingDna && (
        <ExcavationAnimation
          dna={excavatingDna}
          workerResult={excavationWorkerResult}
          onCommission={handleCommission}
          onComplete={handleExcavationComplete}
        />
      )}
    </div>
  )
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppShell />
      <Toaster />
    </QueryClientProvider>
  )
}
