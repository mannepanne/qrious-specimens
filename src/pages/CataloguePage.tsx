// ABOUT: Public species catalogue — paginated, filterable index of all discovered species
// ABOUT: Accessible to unauthenticated visitors; field notes auth-gated to a teaser

import { useState, useEffect, useRef, useCallback, type ChangeEvent } from 'react'
import { useCatalogue, useCatalogueTaxonomy } from '@/hooks/useCatalogue'
import type { CatalogueFilters, CatalogueEntry } from '@/hooks/useCatalogue'
import SpeciesCard from '@/components/SpeciesCard/SpeciesCard'
import TaxonomicSidebar from '@/components/TaxonomicSidebar/TaxonomicSidebar'
import SpeciesDetail from '@/components/SpeciesDetail/SpeciesDetail'
import PageFlip from '@/components/PageFlip/PageFlip'
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver'
import type { Rarity } from '@/lib/rarity'

interface Props {
  isAuthenticated: boolean
  onSignUpCta?: () => void
}

const RARITY_OPTIONS: Rarity[] = ['rare', 'uncommon', 'common']

// Filter chip for a single active filter value
function FilterChip({
  label,
  value,
  onRemove,
}: {
  label: string
  value: string
  onRemove: () => void
}) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-border font-mono text-[11px] bg-accent/50">
      <span className="text-muted-foreground">{label}:</span>
      <span>{value}</span>
      <button
        onClick={onRemove}
        aria-label={`Remove ${label} filter`}
        className="ml-0.5 opacity-60 hover:opacity-100"
      >
        ✕
      </button>
    </span>
  )
}

export function CataloguePage({ isAuthenticated, onSignUpCta }: Props) {
  const [filters, setFilters] = useState<CatalogueFilters>({})
  const [searchInput, setSearchInput] = useState('')
  const [selectedEntry, setSelectedEntry] = useState<CatalogueEntry | null>(null)
  const [flipDirection, setFlipDirection] = useState(1)
  const [showMobileSidebar, setShowMobileSidebar] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  const catalogue = useCatalogue(filters)
  const taxonomy = useCatalogueTaxonomy()

  const allEntries: CatalogueEntry[] = catalogue.data?.pages.flatMap(p => p) ?? []
  const totalCount = catalogue.data?.pages[0]?.[0]?.total_count ?? 0

  // 300ms search debounce
  const handleSearchChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchInput(value)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setFilters(prev => ({ ...prev, search: value || undefined }))
    }, 300)
  }, [])

  useEffect(() => () => clearTimeout(debounceRef.current), [])

  // Infinite scroll sentinel
  const sentinelRef = useIntersectionObserver(
    useCallback(() => {
      if (catalogue.hasNextPage && !catalogue.isFetchingNextPage) {
        catalogue.fetchNextPage()
      }
    }, [catalogue]),
    { enabled: catalogue.hasNextPage ?? false },
  )

  // Navigation between species in the detail view
  const selectedIndex = selectedEntry
    ? allEntries.findIndex(e => e.qr_hash === selectedEntry.qr_hash)
    : -1

  function openEntry(entry: CatalogueEntry, direction = 1) {
    setFlipDirection(direction)
    setSelectedEntry(entry)
  }

  function goToPrev() {
    if (selectedIndex > 0) openEntry(allEntries[selectedIndex - 1], -1)
  }

  function goToNext() {
    if (selectedIndex < allEntries.length - 1) openEntry(allEntries[selectedIndex + 1], 1)
  }

  function clearAllFilters() {
    setFilters({})
    setSearchInput('')
  }

  const hasActiveFilters = Object.values(filters).some(Boolean)

  const taxonomyData = taxonomy.data ?? new Map<string, number>()

  // Count all species across the full (unfiltered) taxonomy for the sidebar total
  const taxonomyTotal = [...taxonomyData.values()].reduce((s, c) => s + c, 0)

  return (
    <main className="flex flex-col h-full">
      {/* Sign-up CTA for visitors */}
      {!isAuthenticated && (
        <div className="bg-accent/40 border-b border-border px-4 py-2 text-center shrink-0">
          <span className="font-mono text-xs text-muted-foreground">
            Browse freely.{' '}
            <button
              onClick={onSignUpCta}
              className="underline hover:text-foreground transition-colors"
            >
              Sign in
            </button>
            {' '}to scan QR codes, collect specimens, and read complete field notes.
          </span>
        </div>
      )}

      {/* Page title */}
      <div className="px-4 pt-4 pb-3 shrink-0">
        <h1 className="font-serif text-2xl">The Species Catalogue</h1>
        <p className="font-mono text-xs text-muted-foreground mt-0.5">
          {totalCount > 0 ? `${totalCount} species catalogued` : 'Loading…'}
        </p>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Taxonomic sidebar — desktop always visible, mobile behind toggle */}
        <aside
          className={[
            'shrink-0 border-r border-border overflow-y-auto transition-all duration-200',
            'hidden md:block w-48 px-3 py-2',
          ].join(' ')}
        >
          <TaxonomicSidebar
            taxonomy={taxonomyData}
            selectedOrder={filters.order ?? null}
            totalCount={taxonomyTotal}
            onSelectOrder={order => setFilters(prev => ({ ...prev, order: order ?? undefined }))}
          />
        </aside>

        {/* Main column */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Search + filter bar */}
          <div className="px-4 pb-3 pt-1 space-y-2 shrink-0">
            <div className="flex gap-2">
              {/* Mobile taxonomy toggle */}
              <button
                onClick={() => setShowMobileSidebar(prev => !prev)}
                className="md:hidden px-3 py-2 border border-border rounded font-mono text-xs hover:bg-accent transition-colors shrink-0"
                aria-label="Toggle taxonomy"
              >
                ⫶
              </button>
              {/* Search input */}
              <input
                type="search"
                value={searchInput}
                onChange={handleSearchChange}
                placeholder="Search species, orders, families…"
                className="flex-1 px-3 py-2 border border-border rounded font-mono text-xs bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            {/* Trait filter dropdowns */}
            <div className="flex flex-wrap gap-2">
              {/* Rarity filter */}
              <select
                value={filters.rarity ?? ''}
                onChange={e => setFilters(prev => ({ ...prev, rarity: (e.target.value as Rarity) || undefined }))}
                className="px-2 py-1 border border-border rounded font-mono text-[11px] bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Rarity</option>
                {RARITY_OPTIONS.map(r => (
                  <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                ))}
              </select>

              {/* Habitat filter */}
              <select
                value={filters.habitat ?? ''}
                onChange={e => setFilters(prev => ({ ...prev, habitat: e.target.value || undefined }))}
                className="px-2 py-1 border border-border rounded font-mono text-[11px] bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Habitat</option>
                {['coastal', 'forest', 'desert', 'cave', 'deep sea', 'alpine', 'freshwater', 'urban'].map(h => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>

              {/* Symmetry filter */}
              <select
                value={filters.symmetry ?? ''}
                onChange={e => setFilters(prev => ({ ...prev, symmetry: e.target.value || undefined }))}
                className="px-2 py-1 border border-border rounded font-mono text-[11px] bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Symmetry</option>
                {['bilateral', 'radial', 'spiral', 'fractal'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>

              {/* Clear filters */}
              {hasActiveFilters && (
                <button
                  onClick={clearAllFilters}
                  className="px-2 py-1 border border-border rounded font-mono text-[11px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                >
                  Clear filters
                </button>
              )}
            </div>

            {/* Active filter chips */}
            {hasActiveFilters && (
              <div className="flex flex-wrap gap-1.5">
                {filters.order    && <FilterChip label="Order"    value={filters.order}    onRemove={() => setFilters(p => ({ ...p, order: undefined }))} />}
                {filters.habitat  && <FilterChip label="Habitat"  value={filters.habitat}  onRemove={() => setFilters(p => ({ ...p, habitat: undefined }))} />}
                {filters.symmetry && <FilterChip label="Symmetry" value={filters.symmetry} onRemove={() => setFilters(p => ({ ...p, symmetry: undefined }))} />}
                {filters.rarity   && <FilterChip label="Rarity"   value={filters.rarity}   onRemove={() => setFilters(p => ({ ...p, rarity: undefined }))} />}
                {filters.search   && <FilterChip label="Search"   value={filters.search}   onRemove={() => { setSearchInput(''); setFilters(p => ({ ...p, search: undefined })) }} />}
              </div>
            )}
          </div>

          {/* Mobile sidebar overlay */}
          {showMobileSidebar && (
            <div className="md:hidden border-b border-border bg-background px-4 py-3 shrink-0">
              <TaxonomicSidebar
                taxonomy={taxonomyData}
                selectedOrder={filters.order ?? null}
                totalCount={taxonomyTotal}
                onSelectOrder={order => {
                  setFilters(prev => ({ ...prev, order: order ?? undefined }))
                  setShowMobileSidebar(false)
                }}
              />
            </div>
          )}

          {/* Species grid */}
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            {catalogue.isLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 pt-2">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="h-44 rounded-lg border border-border animate-pulse bg-accent/20" />
                ))}
              </div>
            ) : allEntries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <p className="font-serif text-lg text-muted-foreground italic">No specimens match your criteria.</p>
                {hasActiveFilters && (
                  <button
                    onClick={clearAllFilters}
                    className="mt-3 font-mono text-xs underline text-muted-foreground hover:text-foreground"
                  >
                    Clear all filters
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 pt-2">
                  {allEntries.map(entry => (
                    <SpeciesCard
                      key={entry.qr_hash}
                      entry={entry}
                      onClick={() => openEntry(entry)}
                    />
                  ))}
                </div>

                {/* Infinite scroll sentinel */}
                <div ref={sentinelRef} className="h-4" />

                {catalogue.isFetchingNextPage && (
                  <div className="flex justify-center py-4">
                    <span className="font-mono text-xs text-muted-foreground animate-pulse">
                      Loading more specimens…
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Species detail overlay */}
      {selectedEntry && (
        <div
          className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm overflow-y-auto"
          onClick={e => { if (e.target === e.currentTarget) setSelectedEntry(null) }}
        >
          <div className="max-w-lg mx-auto min-h-full">
            <PageFlip pageKey={selectedEntry.qr_hash} direction={flipDirection}>
              <SpeciesDetail
                entry={selectedEntry}
                isAuthenticated={isAuthenticated}
                onPrev={selectedIndex > 0 ? goToPrev : null}
                onNext={selectedIndex < allEntries.length - 1 ? goToNext : null}
                onClose={() => setSelectedEntry(null)}
              />
            </PageFlip>
          </div>
        </div>
      )}
    </main>
  )
}
