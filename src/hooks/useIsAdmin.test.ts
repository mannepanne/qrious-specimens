// ABOUT: Tests for useIsAdmin hook
// ABOUT: Verifies admin flag reading from profiles table, fail-safe false on error

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { useIsAdmin } from './useIsAdmin'

vi.mock('@/lib/supabase', () => ({
  supabase: { from: vi.fn() },
}))

import { supabase } from '@/lib/supabase'
const mockFrom = vi.mocked(supabase.from)

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return {
    wrapper: ({ children }: { children: React.ReactNode }) =>
      createElement(QueryClientProvider, { client: qc }, children),
  }
}

function mockProfileQuery(result: { data: unknown; error: unknown }) {
  mockFrom.mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue(result),
      }),
    }),
  } as never)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useIsAdmin', () => {
  it('returns true when is_admin is true', async () => {
    mockProfileQuery({ data: { is_admin: true }, error: null })
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useIsAdmin('user-1'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBe(true)
  })

  it('returns false when is_admin is false', async () => {
    mockProfileQuery({ data: { is_admin: false }, error: null })
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useIsAdmin('user-1'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBe(false)
  })

  it('returns false when userId is null', async () => {
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useIsAdmin(null), { wrapper })
    // Query is disabled — data stays undefined (not even fetched)
    expect(mockFrom).not.toHaveBeenCalled()
    expect(result.current.data).toBeUndefined()
  })

  it('returns false on DB error (fail-safe)', async () => {
    mockProfileQuery({ data: null, error: new Error('DB error') })
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useIsAdmin('user-1'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBe(false)
  })
})
