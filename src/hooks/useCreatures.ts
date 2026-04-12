// ABOUT: React Query hooks for the user's creature collection
// ABOUT: useCreatures — infinite-scroll paginated fetch; useAddCreature — insert + duplicate detection

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { CreatureDNA, CreatureRow } from '@/types/creature'

// Simple FNV-1a hash for QR content → 8 hex char dedup key
function hashQr(content: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < content.length; i++) {
    h = Math.imul(h ^ content.charCodeAt(i), 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

const PAGE_SIZE = 30

export function useCreatures(userId: string | undefined) {
  return useInfiniteQuery({
    queryKey: ['creatures', userId],
    queryFn: async ({ pageParam = 0 }) => {
      if (!userId) return [] as CreatureRow[]
      const from = (pageParam as number) * PAGE_SIZE
      const to = from + PAGE_SIZE - 1
      const { data, error } = await supabase
        .from('creatures')
        .select('*')
        .eq('user_id', userId)
        .order('discovered_at', { ascending: false })
        .range(from, to)
      if (error) throw error
      return data as CreatureRow[]
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage || lastPage.length < PAGE_SIZE) return undefined
      return allPages.length
    },
    enabled: !!userId,
  })
}

export function useAddCreature() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      userId,
      qrContent,
      dna,
    }: {
      userId: string
      qrContent: string
      dna: CreatureDNA
    }) => {
      const qrHash = hashQr(qrContent)

      // Phase 3: insert directly without register_discovery RPC (wired in Phase 4)
      const { data, error } = await supabase
        .from('creatures')
        .insert({
          user_id: userId,
          qr_content: qrContent,
          qr_hash: qrHash,
          dna: dna as unknown as Record<string, unknown>,
        })
        .select()
        .single()

      if (error) {
        if (error.code === '23505') {
          throw new Error('DUPLICATE')
        }
        throw error
      }

      return data as CreatureRow
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['creatures', variables.userId] })
    },
  })
}

export function useUpdateNickname() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, nickname, userId }: { id: string; nickname: string; userId: string }) => {
      const { error } = await supabase
        .from('creatures')
        .update({ nickname })
        .eq('id', id)
      if (error) throw error
      return { id, nickname, userId }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['creatures', data.userId] })
    },
  })
}

/** Fetch a single creature by its UUID — used by the /specimen/:id route for direct URL access. */
export function useCreatureById(id: string | undefined) {
  return useQuery({
    queryKey: ['creature', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('creatures')
        .select('*')
        .eq('id', id!)
        .single()
      if (error) throw error
      return data as CreatureRow
    },
    enabled: !!id,
  })
}

/** Fetch discovery counts for a set of QR hashes (for rarity display) */
export function useDiscoveryCounts(qrHashes: string[]) {
  return useQuery({
    queryKey: ['discovery-counts', qrHashes],
    queryFn: async () => {
      if (qrHashes.length === 0) return {} as Record<string, number>
      const { data, error } = await supabase
        .from('species_discoveries')
        .select('qr_hash, discovery_count')
        .in('qr_hash', qrHashes)
      if (error) throw error
      const map: Record<string, number> = {}
      for (const row of data ?? []) {
        map[row.qr_hash] = row.discovery_count
      }
      return map
    },
    enabled: qrHashes.length > 0,
  })
}
