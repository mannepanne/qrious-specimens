// ABOUT: Standalone species detail page — route /species/:qrHash
// ABOUT: Reads entry from navigation state (fast path) or fetches via get_species_by_hash RPC

import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useCatalogueEntry } from '@/hooks/useCatalogue'
import type { CatalogueEntry } from '@/hooks/useCatalogue'
import { useFirstDiscoverer } from '@/hooks/useCommunity'
import { useAuth } from '@/hooks/useAuth'
import SpeciesDetail from '@/components/SpeciesDetail/SpeciesDetail'

export function SpeciesPage() {
  const { qrHash } = useParams<{ qrHash: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { authState } = useAuth()

  // Navigation state carries the entry when coming from the catalogue list (fast path)
  const stateEntry = (location.state as { entry?: CatalogueEntry } | null)?.entry

  const { data: fetchedEntry, isLoading, error } = useCatalogueEntry(
    stateEntry ? undefined : qrHash
  )

  const entry = stateEntry ?? fetchedEntry
  const isAuthenticated = authState.status === 'authenticated'

  const firstDiscoverer = useFirstDiscoverer(
    entry?.first_discoverer_id ?? null,
    isAuthenticated && !!entry,
  )

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

  return (
    <div className="min-h-screen bg-background">
      <SpeciesDetail
        entry={entry}
        isAuthenticated={isAuthenticated}
        onPrev={null}
        onNext={null}
        onClose={() => navigate(-1)}
        firstDiscovererName={firstDiscoverer.data}
      />
    </div>
  )
}
