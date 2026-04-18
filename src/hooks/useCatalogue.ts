// ABOUT: React Query hooks for the public species catalogue
// ABOUT: useCatalogue — paginated infinite query with server-side filters; useCatalogueTaxonomy — order index for sidebar

import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Rarity } from '@/lib/rarity'

export interface CatalogueEntry {
  qr_hash: string
  genus: string
  species: string
  order: string
  family: string
  habitat: string
  temperament: string
  estimated_size: string
  symmetry: string
  body_shape: string
  limb_style: string
  pattern_type: string
  image_url_512: string | null
  image_url_256: string | null
  field_notes: string | null
  discovery_count: number
  first_discovered_at: string
  first_discoverer_id: string | null
  total_count: number
}

export interface CatalogueFilters {
  search?: string
  order?: string
  habitat?: string
  symmetry?: string
  bodyShape?: string
  limbStyle?: string
  patternType?: string
  rarity?: Rarity
}

const PAGE_SIZE = 24

function buildRpcParams(filters: CatalogueFilters, limit: number, offset: number) {
  return {
    p_search:              filters.search     || null,
    p_order_filter:        filters.order      || null,
    p_habitat_filter:      filters.habitat    || null,
    p_symmetry_filter:     filters.symmetry   || null,
    p_body_shape_filter:   filters.bodyShape  || null,
    p_limb_style_filter:   filters.limbStyle  || null,
    p_pattern_type_filter: filters.patternType || null,
    p_rarity_filter:       filters.rarity     || null,
    p_limit:               limit,
    p_offset:              offset,
  }
}

/** Paginated catalogue with server-side filters. */
export function useCatalogue(filters: CatalogueFilters = {}) {
  return useInfiniteQuery({
    queryKey: ['catalogue', filters],
    queryFn: async ({ pageParam }) => {
      const params = buildRpcParams(filters, PAGE_SIZE, pageParam as number)
      const { data, error } = await supabase.rpc('get_catalogue', params)
      if (error) throw error
      return (data ?? []) as unknown as CatalogueEntry[]
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, page) => sum + page.length, 0)
      const total = lastPage[0]?.total_count ?? 0
      return loaded < total ? loaded : undefined
    },
    staleTime: 2 * 60 * 1000, // 2-minute cache — catalogue changes infrequently
  })
}

/** Fetch a single catalogue entry by qr_hash — used by the /species/:qrHash route. */
export function useCatalogueEntry(qrHash: string | undefined) {
  return useQuery({
    queryKey: ['catalogue-entry', qrHash],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_species_by_hash', { p_qr_hash: qrHash! })
      if (error) throw error
      const row = (data as unknown as CatalogueEntry[] | null)?.[0] ?? null
      // Attach total_count sentinel so the return value satisfies CatalogueEntry
      return row ? ({ ...row, total_count: 1 } as CatalogueEntry) : null
    },
    enabled: !!qrHash,
    staleTime: 2 * 60 * 1000,
  })
}

/** Per-order taxonomy entry — species count plus family breakdown. */
export interface OrderTaxonomy {
  count: number
  /** Family name → species count within this order */
  families: Map<string, number>
}

/** Full unfiltered catalogue fetch used to build the Taxonomic Index sidebar. */
export function useCatalogueTaxonomy() {
  return useQuery({
    queryKey: ['catalogue-taxonomy'],
    queryFn: async () => {
      const params = buildRpcParams({}, 500, 0)
      const { data, error } = await supabase.rpc('get_catalogue', params)
      if (error) throw error
      const entries = (data ?? []) as unknown as CatalogueEntry[]

      // Build order → { count, families } map, sorted alphabetically by order
      const taxonomy = new Map<string, OrderTaxonomy>()
      for (const entry of entries) {
        const existing = taxonomy.get(entry.order)
        if (existing) {
          existing.count++
          existing.families.set(entry.family, (existing.families.get(entry.family) ?? 0) + 1)
        } else {
          taxonomy.set(entry.order, { count: 1, families: new Map([[entry.family, 1]]) })
        }
      }
      return new Map([...taxonomy.entries()].sort(([a], [b]) => a.localeCompare(b)))
    },
    staleTime: 5 * 60 * 1000,
  })
}
