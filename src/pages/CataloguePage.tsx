// ABOUT: Public species catalogue — paginated, filterable index of all discovered species
// ABOUT: Accessible to unauthenticated visitors; clicking a species navigates to /species/:qrHash

import { useState, useEffect, useRef, useCallback, type ChangeEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Search } from 'lucide-react'
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

  // Order comes from the URL path (/catalogue/:order) — other filters remain local state
  const { order: orderParam } = useParams<{ order?: string }>()
  const [filters, setFilters] = useState<CatalogueFilters>({ order: orderParam })
  const [searchInput, setSearchInput] = useState('')
  const [showMobileSidebar, setShowMobileSidebar] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  // Keep filters.order in sync with the URL param whenever navigation changes it
  useEffect(() => {
    setFilters(prev => ({ ...prev, order: orderParam }))
  }, [orderParam])

  const catalogue = useCatalogue(filters)
  const taxonomy = useCatalogueTaxonomy()

  const allEntries: CatalogueEntry[] = catalogue.data?.pages.flatMap(p => p) ?? []

  // Infinite scroll sentinel
  const sentinelRef = useIntersectionObserver(
    () => {
      if (catalogue.hasNextPage && !catalogue.isFetchingNextPage) {
        catalogue.fetchNextPage()
      }
    },
    { enabled: catalogue.hasNextPage ?? false },
  )

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

  function handleSpeciesClick(entry: CatalogueEntry) {
    // Pass the entry in navigation state so SpeciesPage can render immediately
    navigate(`/species/${entry.qr_hash}`, { state: { entry } })
  }

  function clearAllFilters() {
    setFilters({})
    setSearchInput('')
    if (orderParam) navigate('/catalogue')
  }

  const taxonomyData = taxonomy.data ?? new Map()
  // Total across all orders — used in the header; does not change when filters are applied
  const taxonomyTotal = [...taxonomyData.values()].reduce((s, v) => s + v.count, 0)

  const nonOrderFilterCount = [
    filters.rarity, filters.habitat, filters.symmetry,
    filters.bodyShape, filters.limbStyle, filters.patternType, filters.search,
  ].filter(Boolean).length
  const hasActiveFilters = !!(orderParam || nonOrderFilterCount > 0)

  return (
    <main className="flex flex-col h-full">
      {/* Page title */}
      <div className="px-4 pt-4 pb-3 shrink-0">
        <h1 className="font-serif text-2xl">Catalogue of Known Species</h1>
        <p className="font-mono text-xs text-muted-foreground mt-0.5">
          {taxonomy.isLoading ? 'Loading…' : `${taxonomyTotal} species documented`}
        </p>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Taxonomic sidebar — desktop always visible, mobile behind toggle */}
        <aside className="hidden md:block shrink-0 border-r border-border overflow-y-auto w-48 px-3 py-2">
          <TaxonomicSidebar
            taxonomy={taxonomyData}
            selectedOrder={orderParam ?? null}
            totalCount={taxonomyTotal}
            onSelectOrder={order => {
              if (order) navigate(`/catalogue/${encodeURIComponent(order)}`)
              else navigate('/catalogue')
            }}
          />
        </aside>

        {/* Main column */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Sign-in CTA for visitors — above search/filter controls, width matches 4-col grid */}
          {!isAuthenticated && (
            <div className="px-4 pt-2 shrink-0">
              <div className="mx-auto max-w-[688px] border border-border rounded p-3 text-center font-mono text-[11px] text-muted-foreground bg-accent/30">
                Browse freely —{' '}
                <button
                  onClick={() => navigate('/enter')}
                  className="underline hover:text-foreground transition-colors"
                >
                  sign in
                </button>
                {' '}to scan QR codes, collect specimens, and read complete field notes.
              </div>
            </div>
          )}

          {/* Search + filter controls */}
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

              {/* Search input with icon */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <input
                  type="search"
                  value={searchInput}
                  onChange={handleSearchChange}
                  placeholder="Search by name, order, or family…"
                  className="w-full pl-8 pr-3 py-2 border border-border rounded font-mono text-xs bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              {/* Filter toggle */}
              <button
                onClick={() => setShowFilters(f => !f)}
                className={[
                  'flex items-center gap-1.5 px-3 py-2 border border-border rounded font-mono text-[11px] tracking-widest transition-colors shrink-0',
                  showFilters ? 'bg-accent' : 'hover:bg-accent',
                ].join(' ')}
                aria-expanded={showFilters}
              >
                <span>FILTERS</span>
                {nonOrderFilterCount > 0 && (
                  <span className="bg-foreground text-background rounded-full w-4 h-4 text-[10px] flex items-center justify-center">
                    {nonOrderFilterCount}
                  </span>
                )}
                <span className="text-[10px] opacity-60" aria-hidden="true">{showFilters ? '▲' : '▼'}</span>
              </button>
            </div>

            {/* Collapsible trait filter dropdowns */}
            {showFilters && (
              <div className="flex flex-wrap gap-2">
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

                <select
                  value={filters.habitat ?? ''}
                  onChange={e => setFilters(prev => ({ ...prev, habitat: e.target.value || undefined }))}
                  className="px-2 py-1 border border-border rounded font-mono text-[11px] bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">Habitat</option>
                  {HABITAT_OPTIONS.map(h => <option key={h} value={h}>{h}</option>)}
                </select>

                <select
                  value={filters.symmetry ?? ''}
                  onChange={e => setFilters(prev => ({ ...prev, symmetry: e.target.value || undefined }))}
                  className="px-2 py-1 border border-border rounded font-mono text-[11px] bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">Symmetry</option>
                  {SYMMETRY_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>

                <select
                  value={filters.bodyShape ?? ''}
                  onChange={e => setFilters(prev => ({ ...prev, bodyShape: e.target.value || undefined }))}
                  className="px-2 py-1 border border-border rounded font-mono text-[11px] bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">Body form</option>
                  {BODY_SHAPE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>

                <select
                  value={filters.limbStyle ?? ''}
                  onChange={e => setFilters(prev => ({ ...prev, limbStyle: e.target.value || undefined }))}
                  className="px-2 py-1 border border-border rounded font-mono text-[11px] bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">Appendages</option>
                  {LIMB_STYLE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>

                <select
                  value={filters.patternType ?? ''}
                  onChange={e => setFilters(prev => ({ ...prev, patternType: e.target.value || undefined }))}
                  className="px-2 py-1 border border-border rounded font-mono text-[11px] bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">Pattern</option>
                  {PATTERN_TYPE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>

                {hasActiveFilters && (
                  <button
                    onClick={clearAllFilters}
                    className="px-2 py-1 border border-border rounded font-mono text-[11px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  >
                    Clear all
                  </button>
                )}
              </div>
            )}

            {/* Active filter chips — visible whether filters bar is open or closed */}
            {hasActiveFilters && (
              <div className="flex flex-wrap gap-1.5">
                {orderParam          && <FilterChip label="Order"      value={orderParam}           onRemove={() => navigate('/catalogue')} />}
                {filters.habitat     && <FilterChip label="Habitat"    value={filters.habitat}      onRemove={() => setFilters(p => ({ ...p, habitat: undefined }))} />}
                {filters.symmetry    && <FilterChip label="Symmetry"   value={filters.symmetry}     onRemove={() => setFilters(p => ({ ...p, symmetry: undefined }))} />}
                {filters.bodyShape   && <FilterChip label="Body form"  value={filters.bodyShape}    onRemove={() => setFilters(p => ({ ...p, bodyShape: undefined }))} />}
                {filters.limbStyle   && <FilterChip label="Appendages" value={filters.limbStyle}    onRemove={() => setFilters(p => ({ ...p, limbStyle: undefined }))} />}
                {filters.patternType && <FilterChip label="Pattern"    value={filters.patternType}  onRemove={() => setFilters(p => ({ ...p, patternType: undefined }))} />}
                {filters.rarity      && <FilterChip label="Rarity"     value={filters.rarity}       onRemove={() => setFilters(p => ({ ...p, rarity: undefined }))} />}
                {filters.search      && <FilterChip label="Search"     value={filters.search}       onRemove={() => { setSearchInput(''); setFilters(p => ({ ...p, search: undefined })) }} />}
              </div>
            )}
          </div>

          {/* Mobile sidebar overlay */}
          {showMobileSidebar && (
            <div className="md:hidden border-b border-border bg-background px-4 py-3 shrink-0">
              <TaxonomicSidebar
                taxonomy={taxonomyData}
                selectedOrder={orderParam ?? null}
                totalCount={taxonomyTotal}
                onSelectOrder={order => {
                  if (order) navigate(`/catalogue/${encodeURIComponent(order)}`)
                  else navigate('/catalogue')
                  setShowMobileSidebar(false)
                }}
              />
            </div>
          )}

          {/* Species grid — centred, fixed card widths, max 4 columns */}
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            {catalogue.isLoading ? (
              <div className="grid grid-cols-[repeat(2,160px)] sm:grid-cols-[repeat(3,160px)] lg:grid-cols-[repeat(4,160px)] gap-4 justify-center pt-2">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="w-[160px] h-52 rounded-lg border border-border animate-pulse bg-accent/20" />
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
                <div className="grid grid-cols-[repeat(2,160px)] sm:grid-cols-[repeat(3,160px)] lg:grid-cols-[repeat(4,160px)] gap-4 justify-center pt-2">
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
