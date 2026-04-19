// ABOUT: Integration tests for usePostExcavationEffects
// ABOUT: Covers discovery activity posting, badge toasts with tier, badge activity, and rank-up notifications

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { toast } from 'sonner'
import { usePostExcavationEffects } from './usePostExcavationEffects'
import { useCheckBadges, usePostActivity } from './useCommunity'
import { useBadgeDefinitions, useExplorerRank } from './useBadges'
import type { ExplorerRank } from './useBadges'
import type { CreatureRow } from '@/types/creature'

vi.mock('sonner', () => ({ toast: vi.fn() }))

vi.mock('./useCommunity', () => ({
  useCheckBadges: vi.fn(),
  usePostActivity: vi.fn(),
}))

// Partially mock useBadges — keep real RANK_DISPLAY and RANK_ORDER constants, mock the hooks
vi.mock('./useBadges', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./useBadges')>()
  return { ...actual, useBadgeDefinitions: vi.fn(), useExplorerRank: vi.fn() }
})

const mockToast = vi.mocked(toast)
const mockUseCheckBadges = vi.mocked(useCheckBadges)
const mockUsePostActivity = vi.mocked(usePostActivity)
const mockUseBadgeDefinitions = vi.mocked(useBadgeDefinitions)
const mockUseExplorerRank = vi.mocked(useExplorerRank)

// ── Fixtures ─────────────────────────────────────────────────────────────────

const badgeDefs = [
  { slug: 'first_steps', name: 'First Steps', description: '', icon: '🌱', tier: 'bronze', sort_order: 1 },
  { slug: 'rare_find',   name: 'Rare Find',   description: '', icon: '💎', tier: 'silver', sort_order: 2 },
]

const newBadge = { r_badge_slug: 'first_steps', r_badge_name: 'First Steps', r_badge_icon: '🌱', r_is_new: true }
const oldBadge = { r_badge_slug: 'first_steps', r_badge_name: 'First Steps', r_badge_icon: '🌱', r_is_new: false }

const creature: CreatureRow = {
  id: 'c1',
  qr_content: 'test-qr-content',
  qr_hash: 'abc123',
  dna: { genus: 'Testus', species: 'rex' } as CreatureRow['dna'],
  nickname: null,
  discovered_at: '2026-01-01T00:00:00Z',
  is_first_discoverer: false,
}

const publicProfile  = { is_public: true }
const privateProfile = { is_public: false }

function makeRankData(rank: ExplorerRank['rank']): ExplorerRank {
  return {
    rank,
    rank_icon: '♞',
    score: 10,
    next_rank: 'silver',
    next_threshold: 35,
    progress: 0.3,
    breakdown: { badges: 0, specimens: 5, species: 3, rare: 0, firsts: 0, days_active: 2 },
  }
}

// ── Test setup ────────────────────────────────────────────────────────────────

let checkBadgesMutate: ReturnType<typeof vi.fn>
let postActivityMutate: ReturnType<typeof vi.fn>

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return {
    qc,
    wrapper: ({ children }: { children: React.ReactNode }) =>
      createElement(QueryClientProvider, { client: qc }, children),
  }
}

beforeEach(() => {
  vi.clearAllMocks()

  checkBadgesMutate = vi.fn()
  mockUseCheckBadges.mockReturnValue({ mutate: checkBadgesMutate } as never)

  postActivityMutate = vi.fn()
  mockUsePostActivity.mockReturnValue({ mutate: postActivityMutate } as never)

  mockUseBadgeDefinitions.mockReturnValue({ data: badgeDefs } as never)
  mockUseExplorerRank.mockReturnValue({ data: undefined } as never)
})

// ── fireEffects ───────────────────────────────────────────────────────────────

describe('fireEffects', () => {
  it('is a no-op when userId is null', () => {
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => usePostExcavationEffects(null, publicProfile), { wrapper })

    act(() => { result.current.fireEffects(creature, false) })

    expect(checkBadgesMutate).not.toHaveBeenCalled()
    expect(postActivityMutate).not.toHaveBeenCalled()
  })

  it('posts discovery activity when profile is public and not first discoverer', () => {
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => usePostExcavationEffects('u1', publicProfile), { wrapper })

    act(() => { result.current.fireEffects(creature, false) })

    expect(postActivityMutate).toHaveBeenCalledWith({
      event_type: 'discovery',
      species_name: 'Testus rex',
      qr_hash: 'abc123',
    })
  })

  it('posts first_discovery activity when isFirstDiscoverer is true', () => {
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => usePostExcavationEffects('u1', publicProfile), { wrapper })

    act(() => { result.current.fireEffects(creature, true) })

    expect(postActivityMutate).toHaveBeenCalledWith(
      expect.objectContaining({ event_type: 'first_discovery' }),
    )
  })

  it('does not post discovery activity when profile is private', () => {
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => usePostExcavationEffects('u1', privateProfile), { wrapper })

    act(() => { result.current.fireEffects(creature, false) })

    // checkBadges is still called; postActivity is not
    expect(checkBadgesMutate).toHaveBeenCalledWith('u1', expect.any(Object))
    expect(postActivityMutate).not.toHaveBeenCalled()
  })

  it('calls checkBadges with userId regardless of profile visibility', () => {
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => usePostExcavationEffects('u1', privateProfile), { wrapper })

    act(() => { result.current.fireEffects(creature, false) })

    expect(checkBadgesMutate).toHaveBeenCalledWith('u1', expect.any(Object))
  })

  it('fires a toast for each new badge, including its tier label', () => {
    checkBadgesMutate.mockImplementation((_uid: string, opts: { onSuccess?: (d: unknown[]) => void }) => {
      opts?.onSuccess?.([newBadge])
    })
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => usePostExcavationEffects('u1', publicProfile), { wrapper })

    act(() => { result.current.fireEffects(creature, false) })

    expect(mockToast).toHaveBeenCalledWith('🌱 First Steps · BRONZE', { description: 'New badge earned!' })
  })

  it('does not fire a badge toast when r_is_new is false', () => {
    checkBadgesMutate.mockImplementation((_uid: string, opts: { onSuccess?: (d: unknown[]) => void }) => {
      opts?.onSuccess?.([oldBadge])
    })
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => usePostExcavationEffects('u1', publicProfile), { wrapper })

    act(() => { result.current.fireEffects(creature, false) })

    expect(mockToast).not.toHaveBeenCalled()
  })

  it('posts badge_earned activity for public profile on new badge', () => {
    checkBadgesMutate.mockImplementation((_uid: string, opts: { onSuccess?: (d: unknown[]) => void }) => {
      opts?.onSuccess?.([newBadge])
    })
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => usePostExcavationEffects('u1', publicProfile), { wrapper })

    act(() => { result.current.fireEffects(creature, false) })

    expect(postActivityMutate).toHaveBeenCalledWith({
      event_type: 'badge_earned',
      badge_slug: 'first_steps',
    })
  })

  it('does not post badge_earned activity when profile is private', () => {
    checkBadgesMutate.mockImplementation((_uid: string, opts: { onSuccess?: (d: unknown[]) => void }) => {
      opts?.onSuccess?.([newBadge])
    })
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => usePostExcavationEffects('u1', privateProfile), { wrapper })

    act(() => { result.current.fireEffects(creature, false) })

    // badge toast fires but no activity post
    expect(mockToast).toHaveBeenCalledWith(expect.stringContaining('First Steps'), expect.any(Object))
    expect(postActivityMutate).not.toHaveBeenCalled()
  })

  it('invalidates explorer-rank query after badge check completes', () => {
    checkBadgesMutate.mockImplementation((_uid: string, opts: { onSuccess?: (d: unknown[]) => void }) => {
      opts?.onSuccess?.([])
    })
    const { qc, wrapper } = createWrapper()
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => usePostExcavationEffects('u1', publicProfile), { wrapper })

    act(() => { result.current.fireEffects(creature, false) })

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['explorer-rank'] })
  })
})

// ── Rank-up detection ─────────────────────────────────────────────────────────

describe('rank-up detection', () => {
  it('fires no toast when rank data first becomes available (no previous rank to compare)', async () => {
    const { wrapper } = createWrapper()
    renderHook(() => usePostExcavationEffects('u1', publicProfile), { wrapper })

    // Rank transitions from undefined → bronze on remount
    mockUseExplorerRank.mockReturnValue({ data: makeRankData('bronze') } as never)
    // Re-render happens automatically via mock; no toast expected (prev was undefined)
    await waitFor(() => {})
    expect(mockToast).not.toHaveBeenCalled()
  })

  it('fires a rank-up toast when the tier advances', async () => {
    // Start at bronze so prevRankRef is set
    mockUseExplorerRank.mockReturnValue({ data: makeRankData('bronze') } as never)
    const { wrapper } = createWrapper()
    const { rerender } = renderHook(() => usePostExcavationEffects('u1', publicProfile), { wrapper })

    // Wait for initial effect to run and record 'bronze' as prevRank
    await waitFor(() => {})

    // Advance to silver
    mockUseExplorerRank.mockReturnValue({ data: makeRankData('silver') } as never)
    rerender()

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        'Seasoned Collector',
        { description: 'You have been promoted to a new rank.' },
      ),
    )
  })

  it('fires no toast when rank stays the same between renders', async () => {
    mockUseExplorerRank.mockReturnValue({ data: makeRankData('bronze') } as never)
    const { wrapper } = createWrapper()
    const { rerender } = renderHook(() => usePostExcavationEffects('u1', publicProfile), { wrapper })

    await waitFor(() => {})
    rerender()
    await waitFor(() => {})

    expect(mockToast).not.toHaveBeenCalled()
  })

  it('fires no toast when rank unexpectedly regresses', async () => {
    mockUseExplorerRank.mockReturnValue({ data: makeRankData('silver') } as never)
    const { wrapper } = createWrapper()
    const { rerender } = renderHook(() => usePostExcavationEffects('u1', publicProfile), { wrapper })

    await waitFor(() => {})

    // Regress to bronze — should be guarded against
    mockUseExplorerRank.mockReturnValue({ data: makeRankData('bronze') } as never)
    rerender()

    await waitFor(() => {})
    expect(mockToast).not.toHaveBeenCalled()
  })
})
