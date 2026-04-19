// ABOUT: Standalone species detail page — route /species/:qrHash
// ABOUT: Reads entry from navigation state (fast path) or fetches via get_species_by_hash RPC
// ABOUT: Supports prev/next catalogue navigation by index (passed in state from CataloguePage)

import { useRef, useCallback } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useCatalogueEntry } from '@/hooks/useCatalogue'
import type { CatalogueEntry } from '@/hooks/useCatalogue'
import { useFirstDiscoverer } from '@/hooks/useCommunity'
import { useAuth } from '@/hooks/useAuth'
import SpeciesDetail from '@/components/SpeciesDetail/SpeciesDetail'

interface LocationState {
  entry?: CatalogueEntry
  catalogueEntries?: CatalogueEntry[]
  catalogueIndex?: number
}

export function SpeciesPage() {
  const { qrHash } = useParams<{ qrHash: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { authState } = useAuth()

  const state = (location.state as LocationState | null) ?? {}
  const stateEntry = state.entry
  const catalogueEntries = state.catalogueEntries ?? []
  const catalogueIndex = state.catalogueIndex ?? -1

  const { data: fetchedEntry, isLoading, error } = useCatalogueEntry(
    stateEntry ? undefined : qrHash
  )

  const entry = stateEntry ?? fetchedEntry
  const isAuthenticated = authState.status === 'authenticated'

  const firstDiscoverer = useFirstDiscoverer(
    entry?.first_discoverer_id ?? null,
    isAuthenticated && !!entry,
  )

  const hasPrev = catalogueIndex > 0
  const hasNext = catalogueIndex >= 0 && catalogueIndex < catalogueEntries.length - 1

  const handlePrev = useCallback(() => {
    if (!hasPrev) return
    const prev = catalogueEntries[catalogueIndex - 1]
    navigate(`/species/${prev.qr_hash}`, {
      state: { entry: prev, catalogueEntries, catalogueIndex: catalogueIndex - 1 },
    })
  }, [hasPrev, catalogueEntries, catalogueIndex, navigate])

  const handleNext = useCallback(() => {
    if (!hasNext) return
    const next = catalogueEntries[catalogueIndex + 1]
    navigate(`/species/${next.qr_hash}`, {
      state: { entry: next, catalogueEntries, catalogueIndex: catalogueIndex + 1 },
    })
  }, [hasNext, catalogueEntries, catalogueIndex, navigate])

  // Touch swipe — left swipe → next, right swipe → prev (min 50px threshold)
  const touchStartXRef = useRef<number | null>(null)

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX
  }, [])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return
    const delta = touchStartXRef.current - e.changedTouches[0].clientX
    touchStartXRef.current = null
    if (Math.abs(delta) < 50) return
    if (delta > 0) handleNext()
    else handlePrev()
  }, [handleNext, handlePrev])

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="animate-pulse text-muted-foreground text-sm font-mono tracking-widest">
          Consulting the strata…
        </p>
      </div>
    )
  }

  if (error || !entry) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center gap-4">
        <p className="font-serif text-lg text-muted-foreground italic">Species not found</p>
        <button
          onClick={() => navigate('/')}
          className="font-mono text-xs underline text-muted-foreground hover:text-foreground"
        >
          Browse the catalogue
        </button>
      </div>
    )
  }

  // When opened via direct URL or bookmark there is no prior history entry — fall back to catalogue
  const canGoBack = location.key !== 'default'

  return (
    <div
      className="min-h-screen bg-background"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <SpeciesDetail
        entry={entry}
        isAuthenticated={isAuthenticated}
        onPrev={hasPrev ? handlePrev : null}
        onNext={hasNext ? handleNext : null}
        onClose={() => canGoBack ? navigate(-1) : navigate('/')}
        firstDiscovererName={firstDiscoverer.data}
      />
    </div>
  )
}
