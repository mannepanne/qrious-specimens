// ABOUT: React Query hooks for the user's creature collection
// ABOUT: useCreatures — infinite-scroll paginated fetch; useAddCreature — insert + duplicate detection

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { CreatureDNA, CreatureRow } from '@/types/creature'

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
      // Use the deterministic 16-char DNA hash so creatures.qr_hash matches the
      // species_images.qr_hash, species_discoveries.qr_hash, and activity_feed.qr_hash
      // values (all of which are written from `dna.hash`). Earlier versions used a
      // separate 8-char FNV that produced mismatched joins — see ADR / issue #48.
      const { data, error } = await supabase
        .from('creatures')
        .insert({
          user_id: userId,
          qr_content: qrContent,
          qr_hash: dna.hash,
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
      // Refresh the cabinet list so the new nickname appears in grid views.
      queryClient.invalidateQueries({ queryKey: ['creatures', data.userId] })
      // Update the single-creature cache directly so SpecimenPage (when it
      // reads via useCreatureById) reflects the saved value immediately
      // without a network round-trip. The Cabinet → SpecimenPage path uses
      // navigation state instead — handled by an optimistic display in
      // SpecimenPage itself.
      queryClient.setQueryData<CreatureRow | undefined>(
        ['creature', data.id],
        (prev) => (prev ? { ...prev, nickname: data.nickname || null } : prev),
      )
    },
  })
}

/**
 * Fetch a single creature by its UUID — used by the /specimen/:id route.
 *
 * Accepts an optional `placeholderData` so the page can render instantly from
 * navigation state while a background fetch confirms freshness. Without this,
 * a stale `state.creature` (e.g. preserved through browser refresh after a
 * nickname save) would mask the latest DB row.
 */
export function useCreatureById(id: string | undefined, placeholderData?: CreatureRow) {
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
    staleTime: 2 * 60 * 1000,
    placeholderData,
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
