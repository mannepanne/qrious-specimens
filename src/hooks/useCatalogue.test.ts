// ABOUT: Tests for useCatalogue and useCatalogueTaxonomy hooks
// ABOUT: Verifies RPC params, pagination, filter passing, and empty-result handling

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { useCatalogue, useCatalogueTaxonomy } from './useCatalogue'
import type { CatalogueEntry } from './useCatalogue'
import { supabase } from '@/lib/supabase'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
  },
}))

const mockRpc = supabase.rpc as ReturnType<typeof vi.fn>

function makeEntry(overrides: Partial<CatalogueEntry> = {}): CatalogueEntry {
  return {
    qr_hash: 'abc123def456abcd',
    genus: 'Testus',
    species: 'mockii',
    order: 'Testidae',
    family: 'Mockaceae',
    habitat: 'coastal',
    temperament: 'curious',
    estimated_size: '5–10 cm',
    symmetry: 'bilateral',
    body_shape: 'ovoid',
    limb_style: 'jointed',
    pattern_type: 'dots',
    image_url_512: 'https://example.com/512.png',
    image_url_256: 'https://example.com/256.png',
    field_notes: 'A curious specimen was observed.',
    discovery_count: 3,
    first_discovered_at: '2026-01-01T00:00:00Z',
    first_discoverer_id: null,
    total_count: 1,
    ...overrides,
  }
}

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children)
}

describe('useCatalogue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches catalogue with default params on mount', async () => {
    const entries = [makeEntry({ total_count: 1 })]
    mockRpc.mockResolvedValue({ data: entries, error: null })

    const { result } = renderHook(() => useCatalogue(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockRpc).toHaveBeenCalledWith('get_catalogue', expect.objectContaining({
      p_search: null,
      p_order_filter: null,
      p_limit: 24,
      p_offset: 0,
    }))

    const pages = result.current.data?.pages ?? []
    expect(pages[0]).toHaveLength(1)
    expect(pages[0][0].genus).toBe('Testus')
  })

  it('passes search query to RPC', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null })

    const { result } = renderHook(() => useCatalogue({ search: 'Nebulo' }), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockRpc).toHaveBeenCalledWith('get_catalogue', expect.objectContaining({
      p_search: 'Nebulo',
    }))
  })

  it('passes order filter to RPC', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null })

    const { result } = renderHook(() => useCatalogue({ order: 'Testidae' }), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockRpc).toHaveBeenCalledWith('get_catalogue', expect.objectContaining({
      p_order_filter: 'Testidae',
    }))
  })

  it('passes trait filters to RPC', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null })

    const { result } = renderHook(
      () => useCatalogue({ habitat: 'coastal', symmetry: 'bilateral', rarity: 'rare' }),
      { wrapper: makeWrapper() },
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockRpc).toHaveBeenCalledWith('get_catalogue', expect.objectContaining({
      p_habitat_filter: 'coastal',
      p_symmetry_filter: 'bilateral',
      p_rarity_filter: 'rare',
    }))
  })

  it('returns hasNextPage=false when all results are loaded', async () => {
    // total_count matches loaded count → no next page
    const entries = [makeEntry({ total_count: 1 })]
    mockRpc.mockResolvedValue({ data: entries, error: null })

    const { result } = renderHook(() => useCatalogue(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.hasNextPage).toBe(false)
  })

  it('handles empty results gracefully', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null })

    const { result } = renderHook(() => useCatalogue({ search: 'xyzxyzxyz' }), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const pages = result.current.data?.pages ?? []
    expect(pages[0]).toHaveLength(0)
    expect(result.current.hasNextPage).toBe(false)
  })

  it('reports error state when RPC fails', async () => {
    mockRpc.mockResolvedValue({ data: null, error: new Error('Database error') })

    const { result } = renderHook(() => useCatalogue(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

describe('useCatalogueTaxonomy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns a map of order → species count', async () => {
    const entries = [
      makeEntry({ order: 'Arachnoida', total_count: 3 }),
      makeEntry({ order: 'Arachnoida', total_count: 3 }),
      makeEntry({ order: 'Molluscia', total_count: 3 }),
    ]
    mockRpc.mockResolvedValue({ data: entries, error: null })

    const { result } = renderHook(() => useCatalogueTaxonomy(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const taxonomy = result.current.data!
    expect(taxonomy.get('Arachnoida')).toBe(2)
    expect(taxonomy.get('Molluscia')).toBe(1)
  })

  it('returns alphabetically sorted orders', async () => {
    const entries = [
      makeEntry({ order: 'Zebridae' }),
      makeEntry({ order: 'Arachnoida' }),
      makeEntry({ order: 'Molluscia' }),
    ]
    mockRpc.mockResolvedValue({ data: entries, error: null })

    const { result } = renderHook(() => useCatalogueTaxonomy(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const keys = [...result.current.data!.keys()]
    expect(keys).toEqual(['Arachnoida', 'Molluscia', 'Zebridae'])
  })

  it('fetches with p_limit=500 and no filters', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null })

    const { result } = renderHook(() => useCatalogueTaxonomy(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockRpc).toHaveBeenCalledWith('get_catalogue', expect.objectContaining({
      p_limit: 500,
      p_offset: 0,
      p_search: null,
      p_order_filter: null,
    }))
  })
})
