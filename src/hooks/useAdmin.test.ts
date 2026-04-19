// ABOUT: Tests for admin dashboard hooks
// ABOUT: Covers message fetching, mark-as-read, user listing, GDPR export and delete

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import {
  useAdminMessages,
  useAdminUsers,
  useAdminStats,
  useMarkMessageRead,
  useGdprExport,
  useGdprDelete,
} from './useAdmin'

vi.mock('@/lib/supabase', () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() },
}))

import { supabase } from '@/lib/supabase'
const mockFrom = vi.mocked(supabase.from)
const mockRpc  = vi.mocked(supabase.rpc)

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
})

// ── Fixtures ──────────────────────────────────────────────────────────────────

const message = {
  id: 'm1',
  sender_email: 'test@example.com',
  sender_name: 'Test',
  message: 'Hello',
  created_at: '2026-01-01T00:00:00Z',
  read: false,
}

const user = {
  user_id: 'u1',
  email: 'user@example.com',
  display_name: 'Test Explorer',
  created_at: '2026-01-01T00:00:00Z',
  creature_count: 3,
  is_admin: false,
}

const stats = {
  total_users: 5,
  users_with_specimens: 3,
  unique_specimens: 10,
  total_discoveries: 20,
  total_field_notes: 15,
  contact_submissions: 1,
}

// ── useAdminMessages ──────────────────────────────────────────────────────────

describe('useAdminMessages', () => {
  it('returns messages from contact_messages table', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: [message], error: null }),
      }),
    } as never)

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useAdminMessages(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([message])
  })

  it('throws on DB error', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: null, error: new Error('forbidden') }),
      }),
    } as never)

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useAdminMessages(), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

// ── useAdminUsers ─────────────────────────────────────────────────────────────

describe('useAdminUsers', () => {
  it('returns users from admin_list_users RPC', async () => {
    mockRpc.mockResolvedValue({ data: [user], error: null } as never)

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useAdminUsers(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockRpc).toHaveBeenCalledWith('admin_list_users')
    expect(result.current.data).toEqual([user])
  })
})

// ── useAdminStats ─────────────────────────────────────────────────────────────

describe('useAdminStats', () => {
  it('returns stats from admin_get_stats RPC', async () => {
    mockRpc.mockResolvedValue({ data: stats, error: null } as never)

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useAdminStats(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockRpc).toHaveBeenCalledWith('admin_get_stats')
    expect(result.current.data).toEqual(stats)
  })
})

// ── useMarkMessageRead ────────────────────────────────────────────────────────

describe('useMarkMessageRead', () => {
  it('updates read = true and invalidates messages query', async () => {
    mockFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    } as never)

    const { qc, wrapper } = createWrapper()
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useMarkMessageRead(), { wrapper })

    await act(async () => { await result.current.mutateAsync('m1') })

    expect(mockFrom).toHaveBeenCalledWith('contact_messages')
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['admin-messages'] })
  })
})

// ── useGdprExport ─────────────────────────────────────────────────────────────

describe('useGdprExport', () => {
  it('calls admin_export_user_data RPC and returns data', async () => {
    const exported = { profile: {}, creatures: [], exported_at: '2026-01-01' }
    mockRpc.mockResolvedValue({ data: exported, error: null } as never)

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useGdprExport(), { wrapper })

    let returnedData: unknown
    await act(async () => {
      returnedData = await result.current.mutateAsync('u1')
    })

    expect(mockRpc).toHaveBeenCalledWith('admin_export_user_data', { p_user_id: 'u1' })
    expect(returnedData).toEqual(exported)
  })
})

// ── useGdprDelete ─────────────────────────────────────────────────────────────

describe('useGdprDelete', () => {
  it('calls admin_delete_user_data RPC and invalidates users query', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null } as never)

    const { qc, wrapper } = createWrapper()
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useGdprDelete(), { wrapper })

    await act(async () => { await result.current.mutateAsync('u1') })

    expect(mockRpc).toHaveBeenCalledWith('admin_delete_user_data', { p_user_id: 'u1' })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['admin-users'] })
  })
})
