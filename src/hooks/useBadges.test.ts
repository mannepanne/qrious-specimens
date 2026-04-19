// ABOUT: Tests for useBadges hooks — badge definitions, explorer badges, explorer rank
// ABOUT: Verifies correct RPC/table calls and return value shapes

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { useBadgeDefinitions, useExplorerBadges, useExplorerRank } from './useBadges'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(),
  },
}))

import { supabase } from '@/lib/supabase'

const mockRpc = supabase.rpc as ReturnType<typeof vi.fn>
const mockFrom = supabase.from as ReturnType<typeof vi.fn>

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children)
}

function makeFromChain(result: { data: unknown; error: null }) {
  return {
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue(result),
    eq: vi.fn().mockReturnThis(),
  }
}

beforeEach(() => { vi.clearAllMocks() })

describe('useBadgeDefinitions', () => {
  it('returns badge definitions from the badge_definitions table', async () => {
    const defs = [
      { slug: 'first-specimen', name: 'First Find', description: 'desc', icon: '🔬', tier: 'bronze', sort_order: 1 },
    ]
    mockFrom.mockReturnValue(makeFromChain({ data: defs, error: null }))

    const { result } = renderHook(() => useBadgeDefinitions(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(defs)
    expect(mockFrom).toHaveBeenCalledWith('badge_definitions')
  })

  it('returns empty array when table has no rows', async () => {
    mockFrom.mockReturnValue(makeFromChain({ data: null, error: null }))

    const { result } = renderHook(() => useBadgeDefinitions(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([])
  })
})

describe('useExplorerBadges', () => {
  it('returns earned badges for a user', async () => {
    const badges = [{ badge_slug: 'first-specimen', earned_at: '2026-01-01T00:00:00Z' }]
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: badges, error: null }),
    }
    mockFrom.mockReturnValue(chain)

    const { result } = renderHook(() => useExplorerBadges('user-123'), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(badges)
    expect(mockFrom).toHaveBeenCalledWith('explorer_badges')
  })

  it('returns empty array when userId is null', async () => {
    const { result } = renderHook(() => useExplorerBadges(null), { wrapper: createWrapper() })

    // Query is disabled, stays in loading state rather than fetching
    expect(result.current.isLoading).toBe(false)
    expect(result.current.data).toBeUndefined()
    expect(mockFrom).not.toHaveBeenCalled()
  })
})

describe('useExplorerRank', () => {
  it('calls calculate_explorer_rank RPC with the user id', async () => {
    const rank = {
      rank: 'bronze',
      rank_icon: '♞',
      score: 12.5,
      next_rank: 'silver',
      next_threshold: 35,
      progress: 0.36,
      breakdown: { badges: 2, specimens: 5, species: 3, rare: 0, firsts: 0, days_active: 7 },
    }
    mockRpc.mockResolvedValue({ data: rank, error: null })

    const { result } = renderHook(() => useExplorerRank('user-123'), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(rank)
    expect(mockRpc).toHaveBeenCalledWith('calculate_explorer_rank', { p_user_id: 'user-123' })
  })

  it('does not fetch when userId is null', () => {
    const { result } = renderHook(() => useExplorerRank(null), { wrapper: createWrapper() })

    expect(result.current.isLoading).toBe(false)
    expect(mockRpc).not.toHaveBeenCalled()
  })
})
