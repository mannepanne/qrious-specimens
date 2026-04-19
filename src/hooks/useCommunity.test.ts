// ABOUT: Tests for useCommunity hooks
// ABOUT: Covers feed fetch, showcase fetch, stats, profile CRUD, badge checking, first discoverer lookup

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import {
  useCommunityFeed,
  useExplorerShowcase,
  useCommunityStats,
  useExplorerProfile,
  useCreateProfile,
  useUpdateProfile,
  usePostActivity,
  useCheckBadges,
  useFirstDiscoverer,
} from './useCommunity'

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(),
  },
}))

import { supabase } from '@/lib/supabase'

// Cast to vi.fn() to allow flexible mock shapes in tests
const mockRpc = supabase.rpc as ReturnType<typeof vi.fn>
const mockFrom = supabase.from as ReturnType<typeof vi.fn>

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children)
}

function makeFromChain(result: { data: unknown; error: null | Error }) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(result),
    single: vi.fn().mockResolvedValue(result),
  }
  return chain
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ============================================================
// Feed
// ============================================================

describe('useCommunityFeed', () => {
  it('returns feed entries', async () => {
    const entries = [
      {
        id: 'a1', event_type: 'discovery', species_name: 'Venoma rex',
        badge_slug: null, badge_name: null, badge_icon: null, rarity: 'common',
        display_name: 'Dr. A. Darwin', created_at: '2026-01-01T00:00:00Z',
        qr_hash: 'abc123', species_image_url: 'https://example.com/img.png',
      },
    ]
    mockRpc.mockResolvedValueOnce({ data: entries, error: null })

    const { result } = renderHook(() => useCommunityFeed(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(entries)
    expect(mockRpc).toHaveBeenCalledWith('get_community_feed', { p_limit: 20 })
  })

  it('forwards custom limit to RPC', async () => {
    mockRpc.mockResolvedValueOnce({ data: [], error: null })
    const { result } = renderHook(() => useCommunityFeed(5), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockRpc).toHaveBeenCalledWith('get_community_feed', { p_limit: 5 })
  })

  it('throws on RPC error', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: new Error('DB error') })
    const { result } = renderHook(() => useCommunityFeed(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

// ============================================================
// Showcase
// ============================================================

describe('useExplorerShowcase', () => {
  it('returns showcase entries with badges defaulting to empty array', async () => {
    const rows = [
      {
        user_id: 'u1', display_name: 'Prof. B. Huxley',
        specimen_count: 12, rare_count: 2, first_discovery_count: 1,
        badges: null, joined_at: '2026-01-01T00:00:00Z',
      },
    ]
    mockRpc.mockResolvedValueOnce({ data: rows, error: null })
    const { result } = renderHook(() => useExplorerShowcase(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data![0].badges).toEqual([])
  })

  it('preserves badges when present', async () => {
    const badge = { slug: 'first_steps', name: 'First Steps', icon: '🌱', tier: 'bronze' }
    mockRpc.mockResolvedValueOnce({
      data: [{ user_id: 'u2', display_name: 'Lt. C. Sedgwick', specimen_count: 1,
               rare_count: 0, first_discovery_count: 0, badges: [badge], joined_at: '2026-01-01T00:00:00Z' }],
      error: null,
    })
    const { result } = renderHook(() => useExplorerShowcase(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data![0].badges).toEqual([badge])
  })
})

// ============================================================
// Stats
// ============================================================

describe('useCommunityStats', () => {
  it('returns stats', async () => {
    const stats = { total_explorers: 5, total_specimens: 42, total_species: 18 }
    mockRpc.mockResolvedValueOnce({ data: [stats], error: null })
    const { result } = renderHook(() => useCommunityStats(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(stats)
  })
})

// ============================================================
// Profile CRUD
// ============================================================

describe('useExplorerProfile', () => {
  it('returns null when no userId', () => {
    // Query is disabled when userId is null — it stays idle and never fetches
    const { result } = renderHook(() => useExplorerProfile(null), { wrapper: createWrapper() })
    expect(result.current.isFetching).toBe(false)
    expect(result.current.data).toBeUndefined()
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('fetches profile for userId', async () => {
    const profile = { id: 'p1', user_id: 'u1', display_name: 'Dr. A. Darwin', is_public: true, created_at: '2026-01-01T00:00:00Z' }
    const chain = makeFromChain({ data: profile, error: null })
    mockFrom.mockReturnValueOnce(chain as never)
    const { result } = renderHook(() => useExplorerProfile('u1'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(profile)
  })

  it('returns null when profile not found', async () => {
    const chain = makeFromChain({ data: null, error: null })
    mockFrom.mockReturnValueOnce(chain as never)
    const { result } = renderHook(() => useExplorerProfile('u-unknown'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBeNull()
  })
})

describe('useCreateProfile', () => {
  it('calls insert and returns new profile', async () => {
    const profile = { id: 'p2', user_id: 'u2', display_name: 'Rev. X. Hooker', is_public: false, created_at: '2026-01-01T00:00:00Z' }
    const chain = makeFromChain({ data: profile, error: null })
    mockFrom.mockReturnValueOnce(chain as never)
    const { result } = renderHook(() => useCreateProfile(), { wrapper: createWrapper() })
    let data: unknown
    await act(async () => {
      data = await result.current.mutateAsync({ user_id: 'u2', display_name: 'Rev. X. Hooker', is_public: false })
    })
    expect(data).toEqual(profile)
    expect(chain.insert).toHaveBeenCalledWith({ user_id: 'u2', display_name: 'Rev. X. Hooker', is_public: false })
  })
})

describe('useUpdateProfile', () => {
  it('calls update and returns updated profile', async () => {
    const updated = { id: 'p3', user_id: 'u3', display_name: 'Dr. E. Blackwood', is_public: true, created_at: '2026-01-01T00:00:00Z' }
    const chain = makeFromChain({ data: updated, error: null })
    mockFrom.mockReturnValueOnce(chain as never)
    const { result } = renderHook(() => useUpdateProfile(), { wrapper: createWrapper() })
    let data: unknown
    await act(async () => {
      data = await result.current.mutateAsync({ user_id: 'u3', is_public: true })
    })
    expect(data).toEqual(updated)
    expect(chain.update).toHaveBeenCalledWith({ is_public: true })
  })
})

// ============================================================
// Activity posting
// ============================================================

describe('usePostActivity', () => {
  it('inserts into activity_feed', async () => {
    const chain = { insert: vi.fn().mockResolvedValue({ error: null }) }
    mockFrom.mockReturnValueOnce(chain as never)
    const { result } = renderHook(() => usePostActivity(), { wrapper: createWrapper() })
    await act(async () => {
      await result.current.mutateAsync({ event_type: 'discovery', species_name: 'Testus rex', qr_hash: 'abc' })
    })
    expect(chain.insert).toHaveBeenCalledWith({ event_type: 'discovery', species_name: 'Testus rex', qr_hash: 'abc' })
  })

  it('throws on insert error', async () => {
    const chain = { insert: vi.fn().mockResolvedValue({ error: new Error('DB fail') }) }
    mockFrom.mockReturnValueOnce(chain as never)
    const { result } = renderHook(() => usePostActivity(), { wrapper: createWrapper() })
    await act(async () => {
      await expect(result.current.mutateAsync({ event_type: 'discovery' })).rejects.toThrow('DB fail')
    })
  })
})

// ============================================================
// Badge checking
// ============================================================

describe('useCheckBadges', () => {
  it('calls check_and_award_badges RPC and returns results', async () => {
    const badges = [
      { r_badge_slug: 'first_steps', r_badge_name: 'First Steps', r_badge_icon: '🌱', r_is_new: true },
    ]
    mockRpc.mockResolvedValueOnce({ data: badges, error: null })
    const { result } = renderHook(() => useCheckBadges(), { wrapper: createWrapper() })
    let data: unknown
    await act(async () => {
      data = await result.current.mutateAsync('u1')
    })
    expect(data).toEqual(badges)
    expect(mockRpc).toHaveBeenCalledWith('check_and_award_badges', { p_user_id: 'u1' })
  })

  it('invalidates explorer-badges cache on success so BadgeCollection reflects new awards', async () => {
    const badges = [
      { r_badge_slug: 'first_steps', r_badge_name: 'First Steps', r_badge_icon: '🌱', r_is_new: true },
    ]
    mockRpc.mockResolvedValueOnce({ data: badges, error: null })

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      createElement(QueryClientProvider, { client: qc }, children)

    const { result } = renderHook(() => useCheckBadges(), { wrapper })
    await act(async () => { await result.current.mutateAsync('u1') })

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['explorer-badges', 'u1'] })
  })
})

// ============================================================
// First discoverer
// ============================================================

describe('useFirstDiscoverer', () => {
  it('returns null when no discoverer id', () => {
    // Query is disabled when firstDiscovererId is null — stays idle, never fetches
    const { result } = renderHook(() => useFirstDiscoverer(null), { wrapper: createWrapper() })
    expect(result.current.isFetching).toBe(false)
    expect(result.current.data).toBeUndefined()
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('returns display name when public profile exists', async () => {
    const chain = makeFromChain({ data: { display_name: 'Dr. A. Darwin' }, error: null })
    mockFrom.mockReturnValueOnce(chain as never)
    const { result } = renderHook(() => useFirstDiscoverer('u1'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBe('Dr. A. Darwin')
  })

  it('returns null when no public profile', async () => {
    const chain = makeFromChain({ data: null, error: null })
    mockFrom.mockReturnValueOnce(chain as never)
    const { result } = renderHook(() => useFirstDiscoverer('u-private'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBeNull()
  })

  it('does not fetch when enabled=false', async () => {
    const { result } = renderHook(() => useFirstDiscoverer('u1', false), { wrapper: createWrapper() })
    // Should stay idle — never fetches
    expect(result.current.isFetching).toBe(false)
    expect(mockFrom).not.toHaveBeenCalled()
  })
})
