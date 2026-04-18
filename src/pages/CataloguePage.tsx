// ABOUT: Public species catalogue — paginated, filterable index of all discovered species
// ABOUT: Accessible to unauthenticated visitors; clicking a species navigates to /species/:qrHash

import { useState, useEffect, useRef, useCallback, type ChangeEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BookOpen, ChevronDown, ChevronRight, Compass, Search, SlidersHorizontal, X } from 'lucide-react'
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

// Row of toggle pill buttons for a single filter dimension
function FilterRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: readonly string[]
  value: string | undefined
  onChange: (v: string | undefined) => void
}) {
  return (
    <div className="space-y-1.5">
      <p className="font-mono text-[9px] tracking-[2px] text-muted-foreground">{label.toUpperCase()}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => onChange(value === opt ? undefined : opt)}
            className={[
              'px-2 py-1 rounded-sm text-xs font-serif transition-colors border',
              value === opt
                ? 'bg-foreground text-background border-foreground'
                : 'bg-card border-border hover:border-foreground/30',
            ].join(' ')}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  )
}

export function CataloguePage() {
  const navigate = useNavigate()
  const { authState } = useAuth()
  const isAuthenticated = authState.status === 'authenticated'

  // Order comes from the URL path (/catalogue/:order) — other filters remain local state
  const { order: orderParam } = useParams<{ order?: string }>()
  const [filters, setFilters] = useState<CatalogueFilters>({ order: orderParam })
  const [familyFilter, setFamilyFilter] = useState<string | null>(null)
  const [searchInput, setSearchInput] = useState('')
  const [showMobileSidebar, setShowMobileSidebar] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  // Keep filters.order in sync with the URL param; clear family when order changes
  useEffect(() => {
    setFilters(prev => ({ ...prev, order: orderParam }))
    setFamilyFilter(null)
  }, [orderParam])

  const catalogue = useCatalogue(filters)
  const taxonomy = useCatalogueTaxonomy()

  const allEntries: CatalogueEntry[] = catalogue.data?.pages.flatMap(p => p) ?? []
  // Family filtering is client-side on top of the server-side order filter
  const displayEntries = familyFilter
    ? allEntries.filter(e => e.family === familyFilter)
    : allEntries

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
    navigate(`/species/${entry.qr_hash}`, { state: { entry } })
  }

  function clearAllFilters() {
    setFilters({})
    setFamilyFilter(null)
    setSearchInput('')
    if (orderParam) navigate('/catalogue')
  }

  function clearTraitFilters() {
    setFilters(prev => ({
      ...prev,
      rarity: undefined,
      habitat: undefined,
      symmetry: undefined,
      bodyShape: undefined,
      limbStyle: undefined,
      patternType: undefined,
    }))
  }

  const taxonomyData = taxonomy.data ?? new Map()
  const taxonomyTotal = [...taxonomyData.values()].reduce((s, v) => s + v.count, 0)

  const traitFilterCount = [
    filters.rarity, filters.habitat, filters.symmetry,
    filters.bodyShape, filters.limbStyle, filters.patternType,
  ].filter(Boolean).length
  const hasActiveFilters = !!(orderParam || familyFilter || traitFilterCount > 0 || filters.search)
  const hasActiveTraitFilters = traitFilterCount > 0

  // Total entries shown — from the last page's metadata or the flat list length
  const totalCount = catalogue.data?.pages[catalogue.data.pages.length - 1]?.length !== undefined
    ? allEntries.length
    : allEntries.length

  return (
    <main className="flex flex-col h-full">
      {/* Page title */}
      <div className="px-4 pt-4 pb-3 shrink-0 border-b border-border">
        <h1 className="font-serif text-2xl">Catalogue of Known Species</h1>
        <p className="font-mono text-xs text-muted-foreground mt-0.5">
          {taxonomy.isLoading ? 'Loading…' : `${taxonomyTotal} species documented`}
        </p>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Taxonomic sidebar — desktop always visible */}
        <aside className="hidden md:block shrink-0 border-r border-border overflow-y-auto w-48 px-3 py-2">
          <TaxonomicSidebar
            taxonomy={taxonomyData}
            selectedOrder={orderParam ?? null}
            selectedFamily={familyFilter}
            totalCount={taxonomyTotal}
            onSelectOrder={order => {
              if (order) navigate(`/catalogue/${encodeURIComponent(order)}`)
              else navigate('/catalogue')
            }}
            onSelectFamily={setFamilyFilter}
          />
        </aside>

        {/* Main column */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Sign-in CTA for visitors */}
          {!isAuthenticated && (
            <div className="px-4 pt-2 shrink-0">
              <div className="bg-card border rounded-sm p-6 text-center space-y-3">
                <Compass className="h-10 w-10 mx-auto text-muted-foreground/40" />
                <div>
                  <p className="font-serif text-base font-medium">A fellowship of curious naturalists</p>
                  <p className="font-serif text-sm text-muted-foreground italic mt-1">
                    Sign in to discover QRious specimens, earn badges, and join the Gazette
                  </p>
                </div>
                <button
                  onClick={() => navigate('/enter')}
                  className="font-mono text-xs tracking-widest px-5 py-2.5 bg-foreground text-background rounded hover:opacity-90 transition-opacity"
                >
                  START EXPLORING
                </button>
              </div>
            </div>
          )}

          {/* Search + filter controls */}
          <div className="px-4 pb-3 pt-2 space-y-2 shrink-0">
            {/* Search bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <input
                type="search"
                value={searchInput}
                onChange={handleSearchChange}
                placeholder="Search by name, order, or family…"
                className="w-full pl-8 pr-3 py-2 border border-border rounded font-mono text-xs bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            {/* Taxonomic index accordion — mobile only */}
            <div className="md:hidden">
              <button
                onClick={() => { setShowMobileSidebar(p => !p); if (!showMobileSidebar) setShowFilters(false) }}
                className={[
                  'w-full flex items-center justify-between px-3 py-2.5 rounded-sm border transition-colors',
                  showMobileSidebar || orderParam
                    ? 'bg-foreground/5 border-foreground/20'
                    : 'bg-card border-border hover:border-foreground/20',
                ].join(' ')}
              >
                <span className="flex items-center gap-2">
                  <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-mono text-[10px] tracking-[2px]">TAXONOMIC INDEX</span>
                  {orderParam && !showMobileSidebar && (
                    <span className="font-serif text-xs text-muted-foreground italic ml-1">
                      — {orderParam}
                    </span>
                  )}
                </span>
                {showMobileSidebar
                  ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                }
              </button>

              {showMobileSidebar && (
                <div className="mt-2 border rounded-sm bg-muted/20 p-3">
                  <TaxonomicSidebar
                    taxonomy={taxonomyData}
                    selectedOrder={orderParam ?? null}
                    selectedFamily={familyFilter}
                    totalCount={taxonomyTotal}
                    onSelectOrder={order => {
                      if (order) navigate(`/catalogue/${encodeURIComponent(order)}`)
                      else navigate('/catalogue')
                      setShowMobileSidebar(false)
                    }}
                    onSelectFamily={f => { setFamilyFilter(f); setShowMobileSidebar(false) }}
                  />
                </div>
              )}
            </div>

            {/* Filter by traits accordion */}
            <div>
              <button
                onClick={() => { setShowFilters(p => !p); if (!showFilters) setShowMobileSidebar(false) }}
                className={[
                  'w-full flex items-center justify-between px-3 py-2.5 rounded-sm border transition-colors',
                  showFilters || hasActiveTraitFilters
                    ? 'bg-foreground/5 border-foreground/20'
                    : 'bg-card border-border hover:border-foreground/20',
                ].join(' ')}
                aria-expanded={showFilters}
              >
                <span className="flex items-center gap-2">
                  <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-mono text-[10px] tracking-[2px]">FILTER BY TRAITS</span>
                  {!showFilters && hasActiveTraitFilters && (
                    <span className="bg-foreground text-background text-[9px] rounded-full px-1.5 py-0.5 leading-none font-mono">
                      {traitFilterCount}
                    </span>
                  )}
                </span>
                {showFilters
                  ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                }
              </button>

              {showFilters && (
                <div className="mt-2 space-y-3 bg-muted/20 rounded-sm p-3 border border-border">
                  <FilterRow
                    label="Rarity"
                    options={RARITY_OPTIONS}
                    value={filters.rarity}
                    onChange={v => setFilters(prev => ({ ...prev, rarity: v as Rarity | undefined }))}
                  />
                  <FilterRow
                    label="Habitat"
                    options={HABITAT_OPTIONS}
                    value={filters.habitat}
                    onChange={v => setFilters(prev => ({ ...prev, habitat: v }))}
                  />
                  <FilterRow
                    label="Symmetry"
                    options={SYMMETRY_OPTIONS}
                    value={filters.symmetry}
                    onChange={v => setFilters(prev => ({ ...prev, symmetry: v }))}
                  />
                  <FilterRow
                    label="Body form"
                    options={BODY_SHAPE_OPTIONS}
                    value={filters.bodyShape}
                    onChange={v => setFilters(prev => ({ ...prev, bodyShape: v }))}
                  />
                  <FilterRow
                    label="Appendages"
                    options={LIMB_STYLE_OPTIONS}
                    value={filters.limbStyle}
                    onChange={v => setFilters(prev => ({ ...prev, limbStyle: v }))}
                  />
                  <FilterRow
                    label="Pattern"
                    options={PATTERN_TYPE_OPTIONS}
                    value={filters.patternType}
                    onChange={v => setFilters(prev => ({ ...prev, patternType: v }))}
                  />
                  {hasActiveTraitFilters && (
                    <button
                      onClick={clearTraitFilters}
                      className="flex items-center gap-1 font-mono text-[10px] tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <X className="h-3 w-3" /> CLEAR TRAITS
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Results count + clear all */}
            <div className="flex items-center justify-between">
              <p className="font-mono text-[10px] tracking-[2px] text-muted-foreground">
                {catalogue.isLoading ? 'LOADING…' : (
                  <>
                    {displayEntries.length} SPECIMEN{displayEntries.length !== 1 ? 'S' : ''}
                    {hasActiveFilters && ' MATCHING'}
                  </>
                )}
              </p>
              {hasActiveFilters && (
                <button
                  onClick={clearAllFilters}
                  className="font-mono text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  Clear all
                </button>
              )}
            </div>
          </div>

          {/* Species grid — centred, fixed card widths, max 4 columns */}
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            {catalogue.isLoading ? (
              <div className="grid grid-cols-[repeat(2,160px)] sm:grid-cols-[repeat(3,160px)] lg:grid-cols-[repeat(4,160px)] gap-4 justify-center pt-2">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="w-[160px] h-52 rounded-lg border border-border animate-pulse bg-accent/20" />
                ))}
              </div>
            ) : displayEntries.length === 0 ? (
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
                  {displayEntries.map(entry => (
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
