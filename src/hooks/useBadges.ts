// ABOUT: Hooks for badge definitions, explorer badges, and explorer rank calculation
// ABOUT: Badge definitions are static DB rows; rank is calculated server-side per-user via RPC

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

// ============================================================
// Types
// ============================================================

export interface ExplorerRank {
  rank: 'unranked' | 'bronze' | 'silver' | 'gold' | 'platinum'
  rank_icon: string
  score: number
  next_rank: string
  next_threshold: number
  progress: number // 0–1 fraction of the way to the next threshold
  breakdown: {
    badges: number
    specimens: number
    species: number
    rare: number
    firsts: number
    days_active: number
  }
}

export interface BadgeDefinition {
  slug: string
  name: string
  description: string
  icon: string
  tier: string
  sort_order: number
}

export interface ExplorerBadge {
  badge_slug: string
  earned_at: string
}

// ============================================================
// Constants
// ============================================================

/** Ordered rank tiers from lowest to highest. Used for directional rank-up detection. */
export const RANK_ORDER: ReadonlyArray<ExplorerRank['rank']> = ['unranked', 'bronze', 'silver', 'gold', 'platinum']

/** Rank display names in Victorian naturalist style. */
export const RANK_DISPLAY: Record<string, { name: string; label: string }> = {
  unranked:  { name: 'Unranked',             label: 'UNRANKED'  },
  bronze:    { name: 'Field Apprentice',      label: 'BRONZE'    },
  silver:    { name: 'Seasoned Collector',    label: 'SILVER'    },
  gold:      { name: 'Distinguished Fellow',  label: 'GOLD'      },
  platinum:  { name: 'Grand Archivist',       label: 'PLATINUM'  },
}

// ============================================================
// Hooks
// ============================================================

/** All badge definitions sorted by display order. Rarely changes — cached for 10 minutes. */
export function useBadgeDefinitions() {
  return useQuery({
    queryKey: ['badge-definitions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('badge_definitions')
        .select('*')
        .order('sort_order')
      if (error) throw error
      return (data ?? []) as BadgeDefinition[]
    },
    staleTime: 10 * 60 * 1000,
  })
}

/** Badges earned by a specific user. */
export function useExplorerBadges(userId: string | null) {
  return useQuery({
    queryKey: ['explorer-badges', userId],
    queryFn: async () => {
      if (!userId) return []
      const { data, error } = await supabase
        .from('explorer_badges')
        .select('badge_slug, earned_at')
        .eq('user_id', userId)
      if (error) throw error
      return (data ?? []) as ExplorerBadge[]
    },
    enabled: !!userId,
    staleTime: 60 * 1000,
  })
}

/** Explorer rank for a user — server-side calculation via RPC. Stale after 60 seconds. */
export function useExplorerRank(userId: string | null) {
  return useQuery({
    queryKey: ['explorer-rank', userId],
    queryFn: async () => {
      if (!userId) return null
      const { data, error } = await supabase.rpc('calculate_explorer_rank', { p_user_id: userId })
      if (error) throw error
      return data as unknown as ExplorerRank
    },
    enabled: !!userId,
    staleTime: 60 * 1000,
  })
}
