// ABOUT: Public species catalogue — paginated, filterable index of all discovered species
// ABOUT: Accessible to unauthenticated visitors; clicking a species navigates to /species/:qrHash

import { useState, useEffect, useRef, useCallback, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCatalogue, useCatalogueTaxonomy } from '@/hooks/useCatalogue'
import type { CatalogueFilters, CatalogueEntry } from '@/hooks/useCatalogue'
import { useAuth } from '@/hooks/useAuth'
import SpeciesCard from '@/components/SpeciesCard/SpeciesCard'
import TaxonomicSidebar from '@/components/TaxonomicSidebar/TaxonomicSidebar'
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver'
import type { Rarity } from '@/lib/rarity'

const RARITY_OPTIONS: Rarity[] = ['rare', 'uncommon', 'common']
const HABITAT_OPTIONS = ['alpine', 'cave', 'coastal', 'deep sea', 'desert', 'forest', 'freshwater', 'urban'] as const
const SYMMETRY_OPTIONS = ['bilateral', 'fractal', 'radial', 'spiral'] as const
const BODY_SHAPE_OPTIONS = ['bell', 'diamond', 'elongated', 'ovoid', 'spherical', 'star'] as const
const LIMB_STYLE_OPTIONS = ['branching', 'flowing', 'jointed', 'spike', 'tentacle'] as const
const PATTERN_TYPE_OPTIONS = ['dots', 'mesh', 'none', 'rings', 'scales', 'stripes'] as const

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

export function CataloguePage() {
  const navigate = useNavigate()
  const { authState } = useAuth()
  const isAuthenticated = authState.status === 'authenticated'

  const [filters, setFilters] = useState<CatalogueFilters>({})
  const [searchInput, setSearchInput] = useState('')
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
    () => {
      if (catalogue.hasNextPage && !catalogue.isFetchingNextPage) {
        catalogue.fetchNextPage()
      }
    },
    { enabled: catalogue.hasNextPage ?? false },
  )

  function handleSpeciesClick(entry: CatalogueEntry) {
    // Pass the entry in navigation state so SpeciesPage can render immediately
    navigate(`/species/${entry.qr_hash}`, { state: { entry } })
  }

  function clearAllFilters() {
    setFilters({})
    setSearchInput('')
  }

  const hasActiveFilters = Object.values(filters).some(Boolean)

  const taxonomyData = taxonomy.data ?? new Map<string, number>()
  const taxonomyTotal = [...taxonomyData.values()].reduce((s, c) => s + c, 0)

  return (
    <main className="flex flex-col h-full">
      {/* Sign-up CTA for visitors */}
      {!isAuthenticated && (
        <div className="bg-accent/40 border-b border-border px-4 py-2 text-center shrink-0">
          <span className="font-mono text-xs text-muted-foreground">
            Browse freely.{' '}
            <button
              onClick={() => navigate('/enter')}
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
          {catalogue.isLoading ? 'Loading…' : `${totalCount} species catalogued`}
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
                Orders
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
                {HABITAT_OPTIONS.map(h => (
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
                {SYMMETRY_OPTIONS.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>

              {/* Body shape filter */}
              <select
                value={filters.bodyShape ?? ''}
                onChange={e => setFilters(prev => ({ ...prev, bodyShape: e.target.value || undefined }))}
                className="px-2 py-1 border border-border rounded font-mono text-[11px] bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Body form</option>
                {BODY_SHAPE_OPTIONS.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>

              {/* Limb style filter */}
              <select
                value={filters.limbStyle ?? ''}
                onChange={e => setFilters(prev => ({ ...prev, limbStyle: e.target.value || undefined }))}
                className="px-2 py-1 border border-border rounded font-mono text-[11px] bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Appendages</option>
                {LIMB_STYLE_OPTIONS.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>

              {/* Pattern type filter */}
              <select
                value={filters.patternType ?? ''}
                onChange={e => setFilters(prev => ({ ...prev, patternType: e.target.value || undefined }))}
                className="px-2 py-1 border border-border rounded font-mono text-[11px] bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Pattern</option>
                {PATTERN_TYPE_OPTIONS.map(s => (
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
                {filters.order      && <FilterChip label="Order"     value={filters.order}      onRemove={() => setFilters(p => ({ ...p, order: undefined }))} />}
                {filters.habitat    && <FilterChip label="Habitat"   value={filters.habitat}    onRemove={() => setFilters(p => ({ ...p, habitat: undefined }))} />}
                {filters.symmetry   && <FilterChip label="Symmetry"  value={filters.symmetry}   onRemove={() => setFilters(p => ({ ...p, symmetry: undefined }))} />}
                {filters.bodyShape  && <FilterChip label="Body form" value={filters.bodyShape}   onRemove={() => setFilters(p => ({ ...p, bodyShape: undefined }))} />}
                {filters.limbStyle  && <FilterChip label="Appendages" value={filters.limbStyle}  onRemove={() => setFilters(p => ({ ...p, limbStyle: undefined }))} />}
                {filters.patternType && <FilterChip label="Pattern"  value={filters.patternType} onRemove={() => setFilters(p => ({ ...p, patternType: undefined }))} />}
                {filters.rarity     && <FilterChip label="Rarity"    value={filters.rarity}     onRemove={() => setFilters(p => ({ ...p, rarity: undefined }))} />}
                {filters.search     && <FilterChip label="Search"    value={filters.search}     onRemove={() => { setSearchInput(''); setFilters(p => ({ ...p, search: undefined })) }} />}
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
                      onClick={() => handleSpeciesClick(entry)}
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
    </main>
  )
}
