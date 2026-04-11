// ABOUT: Tests for useSpeciesImage hook
// ABOUT: Verifies cache hit, cache miss + Worker trigger, loading state, and error handling

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { useSpeciesImage } from './useSpeciesImage'
import type { CreatureDNA } from '@/types/creature'

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getSession: vi.fn(),
    },
  },
}))

import { supabase } from '@/lib/supabase'

const MOCK_DNA: CreatureDNA = {
  seed: 99,
  hash: 'test1234test1234',
  symmetry: 'radial',
  symmetryOrder: 4,
  bodyShape: 'star',
  bodyScale: 1.0,
  limbCount: 5,
  limbStyle: 'tentacle',
  limbLength: 1.0,
  limbCurvature: 0.8,
  patternType: 'mesh',
  patternDensity: 0.5,
  eyeCount: 1,
  eyeSize: 0.3,
  eyeStyle: 'compound',
  hue1: 120,
  hue2: 240,
  saturation: 70,
  lightness: 45,
  hasAntennae: true,
  hasTail: false,
  hasShell: false,
  hasCrown: true,
  genus: 'Spectrus',
  species: 'testii',
  order: 'Testalia',
  family: 'Mockidae',
  habitat: 'deep sea',
  temperament: 'docile',
  estimatedSize: '2–5 cm',
}

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
}

describe('useSpeciesImage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn())
  })

  it('returns null values while loading', () => {
    const selectMock = { eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockReturnValue(new Promise(() => {})) }
    vi.mocked(supabase.from).mockReturnValue({ select: vi.fn().mockReturnValue(selectMock) } as unknown as ReturnType<typeof supabase.from>)

    const { result } = renderHook(() => useSpeciesImage('hash123', MOCK_DNA), {
      wrapper: makeWrapper(),
    })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.imageUrl).toBeNull()
    expect(result.current.fieldNotes).toBeNull()
  })

  it('returns cached data immediately when species_images has a row', async () => {
    const cachedRow = {
      image_url: 'https://r2.dev/original.png',
      image_url_512: 'https://r2.dev/512.png',
      image_url_256: 'https://r2.dev/256.png',
      field_notes: 'A most remarkable organism.',
    }

    const maybeSingleMock = vi.fn().mockResolvedValue({ data: cachedRow, error: null })
    const selectMock = { eq: vi.fn().mockReturnThis(), maybeSingle: maybeSingleMock }
    vi.mocked(supabase.from).mockReturnValue({ select: vi.fn().mockReturnValue(selectMock) } as unknown as ReturnType<typeof supabase.from>)

    const { result } = renderHook(() => useSpeciesImage('hash123', MOCK_DNA), {
      wrapper: makeWrapper(),
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.imageUrl).toBe(cachedRow.image_url)
    expect(result.current.imageUrl512).toBe(cachedRow.image_url_512)
    expect(result.current.imageUrl256).toBe(cachedRow.image_url_256)
    expect(result.current.fieldNotes).toBe(cachedRow.field_notes)

    // Worker should NOT have been called
    expect(fetch).not.toHaveBeenCalled()
  })

  it('triggers Worker mutation when no cached entry exists', async () => {
    // Cache miss
    const maybeSingleMock = vi.fn().mockResolvedValue({ data: null, error: null })
    const selectMock = { eq: vi.fn().mockReturnThis(), maybeSingle: maybeSingleMock }
    vi.mocked(supabase.from).mockReturnValue({ select: vi.fn().mockReturnValue(selectMock) } as unknown as ReturnType<typeof supabase.from>)

    // Auth session
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { access_token: 'test-token' } },
      error: null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    const workerResponse = {
      imageUrl: 'https://r2.dev/original.png',
      imageUrl512: 'https://r2.dev/512.png',
      imageUrl256: 'https://r2.dev/256.png',
      fieldNotes: 'Discovered in the digital strata.',
      isFirstDiscoverer: true,
      discoveryCount: 1,
      cached: false,
    }

    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(workerResponse), { status: 200 }))

    const { result } = renderHook(() => useSpeciesImage('hash123', MOCK_DNA), {
      wrapper: makeWrapper(),
    })

    // Wait for cache check to complete, then mutation to fire
    await waitFor(() => expect(result.current.imageUrl).toBe(workerResponse.imageUrl), { timeout: 3000 })

    expect(result.current.fieldNotes).toBe(workerResponse.fieldNotes)
    expect(result.current.isFirstDiscoverer).toBe(true)
    expect(fetch).toHaveBeenCalledWith('/api/generate-creature', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
    }))
  })

  it('returns null values and error on Worker failure', async () => {
    // Cache miss
    const maybeSingleMock = vi.fn().mockResolvedValue({ data: null, error: null })
    const selectMock = { eq: vi.fn().mockReturnThis(), maybeSingle: maybeSingleMock }
    vi.mocked(supabase.from).mockReturnValue({ select: vi.fn().mockReturnValue(selectMock) } as unknown as ReturnType<typeof supabase.from>)

    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { access_token: 'test-token' } },
      error: null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    vi.mocked(fetch).mockResolvedValue(new Response('Internal server error', { status: 500 }))

    const { result } = renderHook(() => useSpeciesImage('hash123', MOCK_DNA), {
      wrapper: makeWrapper(),
    })

    await waitFor(() => expect(result.current.error).not.toBeNull(), { timeout: 3000 })

    expect(result.current.imageUrl).toBeNull()
    expect(result.current.fieldNotes).toBeNull()
    expect(result.current.error).toBeInstanceOf(Error)
  })

  it('does not trigger when qrHash is null', () => {
    const maybeSingleMock = vi.fn()
    const selectMock = { eq: vi.fn().mockReturnThis(), maybeSingle: maybeSingleMock }
    vi.mocked(supabase.from).mockReturnValue({ select: vi.fn().mockReturnValue(selectMock) } as unknown as ReturnType<typeof supabase.from>)

    renderHook(() => useSpeciesImage(null, MOCK_DNA), { wrapper: makeWrapper() })

    // Should not have queried Supabase (query disabled when qrHash is null)
    expect(supabase.from).not.toHaveBeenCalled()
  })
})
