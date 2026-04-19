// ABOUT: Root application component — router, auth shell, and transient overlays
// ABOUT: Scanner and excavation overlays are full-screen state; all other navigation is URL-based

import { useState, useRef, useEffect, useCallback, createContext, useContext } from 'react'
import {
  BrowserRouter,
  Routes,
  Route,
  Outlet,
  useLocation,
  useNavigate,
  Navigate,
} from 'react-router-dom'
import { QueryClientProvider, useQueryClient } from '@tanstack/react-query'
import type { InfiniteData } from '@tanstack/react-query'
import { toast } from 'sonner'
import { queryClient } from '@/lib/queryClient'
import { Toaster } from '@/components/ui/sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { TabBar } from '@/components/TabBar/TabBar'
import { SiteFooter } from '@/components/SiteFooter/SiteFooter'
import { useAddCreature } from '@/hooks/useCreatures'
import { useExplorerProfile } from '@/hooks/useCommunity'
import { usePostExcavationEffects } from '@/hooks/usePostExcavationEffects'
import type { CreatureRow } from '@/types/creature'
import type { WorkerResponse } from '@/types/worker'
import { generateCreatureDNA } from '@/lib/creatureEngine'
import { AuthPage } from '@/pages/AuthPage'
import { CataloguePage } from '@/pages/CataloguePage'
import { GazettePage } from '@/pages/GazettePage'
import { CabinetPage } from '@/pages/CabinetPage'
import { SpecimenPage } from '@/pages/SpecimenPage'
import { SpeciesPage } from '@/pages/SpeciesPage'
import { FrameworkPage } from '@/pages/FrameworkPage'
import { AboutPage } from '@/pages/AboutPage'
import { PrivacyPage } from '@/pages/PrivacyPage'
import { ContactPage } from '@/pages/ContactPage'
import { SettingsPage } from '@/pages/SettingsPage'
import QrScanner from '@/components/QrScanner/QrScanner'
import ExcavationAnimation from '@/components/ExcavationAnimation/ExcavationAnimation'
import type { ExcavationWorkerResult } from '@/components/ExcavationAnimation/ExcavationAnimation'
import type { CreatureDNA } from '@/types/creature'

// ── Scan context ───────────────────────────────────────────────────────────
// Allows CabinetPage (a child route) to open the scanner overlay in AppShell.

interface ScanOverlayContextValue {
  openScanner: () => void
}

const ScanOverlayContext = createContext<ScanOverlayContextValue | null>(null)

export function useScanOverlay(): ScanOverlayContextValue {
  const ctx = useContext(ScanOverlayContext)
  if (!ctx) throw new Error('useScanOverlay must be used inside AppShell')
  return ctx
}

// Protected routes: unauthenticated access is redirected to /enter by AppShell
const PROTECTED_PREFIXES = ['/cabinet', '/specimen/', '/settings']

// ── Route definitions ──────────────────────────────────────────────────────
// Exported so tests can create a MemoryRouter with the same routes.

type Overlay = 'scanner' | 'excavating' | null

// Paths on which the TabBar is hidden — detail and auth pages
const NO_TABBAR_PREFIXES = ['/species/', '/specimen/']

function AppShell() {
  const { authState } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [overlay, setOverlay] = useState<Overlay>(null)
  const [excavatingDna, setExcavatingDna] = useState<CreatureDNA | null>(null)
  const [excavationWorkerResult, setExcavationWorkerResult] = useState<ExcavationWorkerResult | null>(null)

  const addCreature = useAddCreature()
  const queryClient = useQueryClient()

  const isAuthenticated = authState.status === 'authenticated'
  const userId = isAuthenticated ? authState.session.user.id : ''

  const explorerProfile = useExplorerProfile(isAuthenticated ? userId : null)
  const { fireEffects } = usePostExcavationEffects(
    isAuthenticated ? userId : null,
    explorerProfile.data,
  )

  const excavationResultRef = useRef<CreatureRow | null>(null)
  const excavationErrorRef = useRef<string | null>(null)
  const excavationWorkerResponseRef = useRef<WorkerResponse | null>(null)
  const animationDoneRef = useRef(false)
  const workerCalledRef = useRef(false)
  const workerFailedRef = useRef(false)

  const finishExcavation = useCallback(() => {
    animationDoneRef.current = false
    setOverlay(null)
    setExcavatingDna(null)
    setExcavationWorkerResult(null)

    if (excavationResultRef.current) {
      const creature = excavationResultRef.current
      const isFirstDiscoverer = excavationWorkerResponseRef.current?.isFirstDiscoverer ?? false

      if (isFirstDiscoverer) {
        toast('First discoverer!', {
          description: 'You are the first naturalist to catalogue this species.',
        })
      }

      if (workerFailedRef.current) {
        toast('The specimen eluded our naturalist.', {
          description: 'The illustration could not be captured — try viewing the specimen again.',
        })
      }

      fireEffects(creature, isFirstDiscoverer)

      // Navigate to the new specimen — pass the creature in state so SpecimenPage
      // can render immediately without waiting for a DB round-trip.
      navigate(`/specimen/${creature.id}`, {
        state: {
          creature: isFirstDiscoverer ? { ...creature, is_first_discoverer: true } : creature,
        },
      })
    } else if (excavationErrorRef.current === 'DUPLICATE') {
      toast('This specimen is already in your cabinet.', { description: 'Each QR code yields the same creature.' })
    } else if (excavationErrorRef.current) {
      toast('Could not add specimen', { description: 'Please try again.' })
    }
  }, [navigate, fireEffects])

  useEffect(() => {
    if (animationDoneRef.current && !addCreature.isPending) {
      finishExcavation()
    }
  }, [addCreature.isPending, finishExcavation])

  // ── Auth loading / error ────────────────────────────────────────────────

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

  // ── Scan flow ──────────────────────────────────────────────────────────

  function handleScan(content: string) {
    const clamped = content.slice(0, 4096)
    const dna = generateCreatureDNA(clamped)

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

    setExcavatingDna(dna)
    setExcavationWorkerResult(null)
    setOverlay('excavating')

    addCreature.mutateAsync({ userId, qrContent: clamped, dna }).then((row) => {
      excavationResultRef.current = row
    }).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err)
      excavationErrorRef.current = msg
    })
  }

  // NOTE: handleCommission calls /api/generate-creature directly rather than via useSpeciesImage.
  // This is intentional — the scan flow needs to pass the Worker result to ExcavationAnimation
  // at a precise phase, which requires direct control over timing.
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
      const data = res.ok ? (await res.json()) as WorkerResponse : null
      if (!data) workerFailedRef.current = true
      excavationWorkerResponseRef.current = data
      setExcavationWorkerResult({
        imageUrl512: data?.imageUrl512 ?? null,
        isFirstDiscoverer: data?.isFirstDiscoverer ?? false,
      })
    } catch {
      workerFailedRef.current = true
      setExcavationWorkerResult({ imageUrl512: null, isFirstDiscoverer: false })
    }
  }

  function handleExcavationComplete() {
    if (addCreature.isPending) {
      animationDoneRef.current = true
      return
    }
    finishExcavation()
  }

  // Auth guard — synchronous redirect for protected routes when unauthenticated
  const isProtectedPath = PROTECTED_PREFIXES.some(p => location.pathname.startsWith(p))
  if (isProtectedPath && authState.status === 'unauthenticated') {
    return <Navigate to="/enter" replace />
  }

  const hideTabBar = overlay !== null || NO_TABBAR_PREFIXES.some(p => location.pathname.startsWith(p))

  // Left strip is hidden on the auth page — it's a full-bleed centred layout
  const hideStrip = location.pathname.startsWith('/enter')

  return (
    <ScanOverlayContext.Provider value={{ openScanner: () => setOverlay('scanner') }}>
      {/* Fixed left decorative margin strip — journal-spine motif */}
      {!hideStrip && (
        <div className="hidden md:block fixed left-0 top-0 h-full w-10 border-r border-border bg-[hsl(36,20%,88%)] z-20 pointer-events-none" />
      )}

      <div className="flex min-h-screen flex-col md:ml-10">
        <div className="flex-1 pb-16">
          <Outlet />
        </div>

        <SiteFooter />
        <TabBar hidden={hideTabBar} />
      </div>

      {overlay === 'scanner' && (
        <QrScanner onScan={handleScan} onClose={() => setOverlay(null)} />
      )}
      {overlay === 'excavating' && excavatingDna && (
        <ExcavationAnimation
          dna={excavatingDna}
          workerResult={excavationWorkerResult}
          onCommission={handleCommission}
          onComplete={handleExcavationComplete}
        />
      )}
    </ScanOverlayContext.Provider>
  )
}

// ── Route tree ─────────────────────────────────────────────────────────────
// Exported so tests can render AppRoutes inside a MemoryRouter.

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/"                    element={<Navigate to="/catalogue" replace />} />
        <Route path="/catalogue"           element={<CataloguePage />} />
        <Route path="/catalogue/:order"    element={<CataloguePage />} />
        <Route path="/species/:qrHash"     element={<SpeciesPage />} />
        <Route path="/gazette"             element={<GazettePage />} />
        <Route path="/cabinet"             element={<CabinetPage />} />
        <Route path="/specimen/:id"        element={<SpecimenPage />} />
        <Route path="/enter"               element={<AuthPage />} />
        <Route path="/about"               element={<AboutPage />} />
        <Route path="/privacy"             element={<PrivacyPage />} />
        <Route path="/contact"             element={<ContactPage />} />
        <Route path="/settings"            element={<SettingsPage />} />
      </Route>
      {/* Temporary design prototype — standalone, outside AppShell. Remove once layout is approved. */}
      <Route path="/framework"             element={<FrameworkPage />} />
    </Routes>
  )
}

// ── App root ───────────────────────────────────────────────────────────────

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
      <Toaster />
    </QueryClientProvider>
  )
}
