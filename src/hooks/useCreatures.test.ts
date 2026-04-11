// ABOUT: Tests for useCreatures and useAddCreature hooks

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { useCreatures, useAddCreature } from './useCreatures'
import type { CreatureRow } from '@/types/creature'

// Minimal DNA for testing
const TEST_DNA = {
  seed: 12345,
  hash: 'abcdef1234567890',
  symmetry: 'radial' as const,
  symmetryOrder: 5,
  bodyShape: 'ovoid' as const,
  bodyScale: 1.0,
  limbCount: 5,
  limbStyle: 'tentacle' as const,
  limbLength: 0.8,
  limbCurvature: 0.5,
  patternType: 'dots' as const,
  patternDensity: 0.5,
  eyeCount: 2,
  eyeSize: 1.0,
  eyeStyle: 'round' as const,
  hue1: 180,
  hue2: 240,
  saturation: 40,
  lightness: 50,
  hasAntennae: false,
  hasTail: true,
  hasShell: false,
  hasCrown: false,
  genus: 'Lumnema',
  species: 'gracilis',
  order: 'Radiata',
  family: 'Orbidae',
  habitat: 'pelagic',
  temperament: 'docile',
  estimatedSize: '12–18 cm',
}

const MOCK_CREATURE_ROW = {
  id: 'creature-1',
  qr_content: 'https://example.com',
  qr_hash: 'abcd1234',
  dna: TEST_DNA,
  nickname: null,
  discovered_at: '2026-04-09T00:00:00Z',
  is_first_discoverer: false,
}

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}))

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
}

describe('useCreatures', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns empty data when userId is undefined', () => {
    const { result } = renderHook(() => useCreatures(undefined), { wrapper: makeWrapper() })
    expect(result.current.data).toBeUndefined()
    expect(result.current.status).toBe('pending')
  })

  it('fetches creatures for a userId', async () => {
    const { supabase } = await import('@/lib/supabase')
    const mockSelect = vi.fn().mockReturnThis()
    const mockEq = vi.fn().mockReturnThis()
    const mockOrder = vi.fn().mockReturnThis()
    const mockRange = vi.fn().mockResolvedValue({ data: [MOCK_CREATURE_ROW], error: null })

    ;(supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      order: mockOrder,
      range: mockRange,
    })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockEq.mockReturnValue({ order: mockOrder })
    mockOrder.mockReturnValue({ range: mockRange })

    const { result } = renderHook(() => useCreatures('user-123'), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.status).toBe('success'))
    expect(result.current.data?.pages[0]).toEqual([MOCK_CREATURE_ROW])
  })
})

describe('useAddCreature', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('inserts a creature and returns the row', async () => {
    const { supabase } = await import('@/lib/supabase')
    const mockInsert = vi.fn().mockReturnThis()
    const mockSelect = vi.fn().mockReturnThis()
    const mockSingle = vi.fn().mockResolvedValue({ data: MOCK_CREATURE_ROW, error: null })

    ;(supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      insert: mockInsert,
      select: mockSelect,
      single: mockSingle,
    })
    mockInsert.mockReturnValue({ select: mockSelect })
    mockSelect.mockReturnValue({ single: mockSingle })

    const { result } = renderHook(() => useAddCreature(), { wrapper: makeWrapper() })

    let creature: CreatureRow | undefined
    await act(async () => {
      creature = await result.current.mutateAsync({
        userId: 'user-123',
        qrContent: 'https://example.com',
        dna: TEST_DNA,
      })
    })

    expect(creature).toEqual(MOCK_CREATURE_ROW)
  })

  it('throws DUPLICATE error on unique constraint violation', async () => {
    const { supabase } = await import('@/lib/supabase')
    const mockInsert = vi.fn().mockReturnThis()
    const mockSelect = vi.fn().mockReturnThis()
    const mockSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { code: '23505', message: 'duplicate key' },
    })

    ;(supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      insert: mockInsert,
      select: mockSelect,
      single: mockSingle,
    })
    mockInsert.mockReturnValue({ select: mockSelect })
    mockSelect.mockReturnValue({ single: mockSingle })

    const { result } = renderHook(() => useAddCreature(), { wrapper: makeWrapper() })

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          userId: 'user-123',
          qrContent: 'https://example.com',
          dna: TEST_DNA,
        })
      ).rejects.toThrow('DUPLICATE')
    })
  })
})
