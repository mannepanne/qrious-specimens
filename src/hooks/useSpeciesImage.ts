// ABOUT: Hook for fetching or triggering AI-generated creature illustrations
// ABOUT: Checks species_images cache first; triggers Worker mutation on cache miss

import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { CreatureDNA } from '@/types/creature'
import type { WorkerResponse } from '@/types/worker'

interface SpeciesImageCacheRow {
  image_url: string
  image_url_512: string | null
  image_url_256: string | null
  field_notes: string | null
}

export interface SpeciesImageResult {
  /** Full-size R2 URL — use for SpecimenPage */
  imageUrl: string | null
  /** 512px R2 URL — use for SpecimenPage display */
  imageUrl512: string | null
  /** 256px R2 URL — use for SpecimenTeaser thumbnail */
  imageUrl256: string | null
  fieldNotes: string | null
  isFirstDiscoverer: boolean
  isLoading: boolean
  error: Error | null
}

export function useSpeciesImage(
  qrHash: string | null,
  dna: CreatureDNA | null,
): SpeciesImageResult {
  const queryClient = useQueryClient()

  // Step 1: Check species_images table for a cached entry
  const { data: cached, isLoading: cacheLoading } = useQuery({
    queryKey: ['species-image', qrHash],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('species_images')
        .select('image_url, image_url_512, image_url_256, field_notes')
        .eq('qr_hash', qrHash!)
        .maybeSingle()
      if (error) throw error
      return data as SpeciesImageCacheRow | null
    },
    enabled: !!qrHash,
    staleTime: 5 * 60 * 1000, // 5-minute cache — images don't change once generated
  })

  // Step 2: If no cached entry, call the Worker
  const mutation = useMutation({
    mutationFn: async (): Promise<WorkerResponse> => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const res = await fetch('/api/generate-creature', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ qrHash, dna }),
      })

      if (!res.ok) {
        const body = await res.text()
        throw new Error(`Worker error ${res.status}: ${body.slice(0, 200)}`)
      }

      return res.json() as Promise<WorkerResponse>
    },
    onSuccess: () => {
      // Invalidate the cache query so it refetches the newly written row
      queryClient.invalidateQueries({ queryKey: ['species-image', qrHash] })
    },
  })

  // Auto-trigger the mutation when cache miss is confirmed
  useEffect(() => {
    if (!qrHash || !dna || cacheLoading) return
    if (cached !== null) return // cache hit — no need to generate
    if (mutation.isPending || mutation.isSuccess || mutation.isError) return
    mutation.mutate()
  }, [qrHash, dna, cacheLoading, cached, mutation])

  const workerData = mutation.data

  return {
    imageUrl: cached?.image_url ?? workerData?.imageUrl ?? null,
    imageUrl512: cached?.image_url_512 ?? workerData?.imageUrl512 ?? null,
    imageUrl256: cached?.image_url_256 ?? workerData?.imageUrl256 ?? null,
    fieldNotes: cached?.field_notes ?? workerData?.fieldNotes ?? null,
    isFirstDiscoverer: workerData?.isFirstDiscoverer ?? false,
    isLoading: cacheLoading || mutation.isPending,
    error: mutation.error,
  }
}
