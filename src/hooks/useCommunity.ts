// ABOUT: React Query hooks for the Explorer's Gazette community layer
// ABOUT: Covers explorer profiles, activity feed, showcase, community stats, badge checking, and activity posting

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'

// ============================================================
// Types
// ============================================================

export interface ExplorerProfile {
  id: string
  user_id: string
  display_name: string
  is_public: boolean
  created_at: string
}

export interface FeedEntry {
  id: string
  event_type: 'discovery' | 'rare_discovery' | 'first_discovery' | 'badge_earned'
  species_name: string | null
  badge_slug: string | null
  badge_name: string | null
  badge_icon: string | null
  rarity: string | null
  display_name: string
  created_at: string
  qr_hash: string | null
  species_image_url: string | null
}

export interface ShowcaseExplorer {
  user_id: string
  display_name: string
  specimen_count: number
  rare_count: number
  first_discovery_count: number
  badges: Array<{ slug: string; name: string; icon: string; tier: string }>
  joined_at: string
}

export interface CommunityStats {
  total_explorers: number
  total_specimens: number
  total_species: number
}

/** A badge earned by the current user, including its display visibility state. */
export interface EarnedBadge {
  id: string
  badge_slug: string
  is_public: boolean
  earned_at: string
}

export interface BadgeResult {
  r_badge_slug: string
  r_badge_name: string
  r_badge_icon: string
  r_is_new: boolean
}

export interface PostActivityParams {
  event_type: 'discovery' | 'rare_discovery' | 'first_discovery' | 'badge_earned'
  species_name?: string
  badge_slug?: string
  rarity?: string
  qr_hash?: string
}

// ============================================================
// Explorer profile hooks
// ============================================================

/** Fetch the current user's explorer profile (or null if none). */
export function useExplorerProfile(userId: string | null) {
  return useQuery({
    queryKey: ['explorer-profile', userId],
    queryFn: async () => {
      if (!userId) return null
      const { data, error } = await supabase
        .from('explorer_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()
      if (error) throw error
      return data as ExplorerProfile | null
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  })
}

/** Create a new explorer profile for the current user. */
export function useCreateProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (params: { user_id: string; display_name: string; is_public: boolean }) => {
      const { data, error } = await supabase
        .from('explorer_profiles')
        .insert(params)
        .select()
        .single()
      if (error) throw error
      return data as ExplorerProfile
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['explorer-profile', data.user_id], data)
      queryClient.invalidateQueries({ queryKey: ['community-showcase'] })
      queryClient.invalidateQueries({ queryKey: ['community-stats'] })
    },
  })
}

/** Update display name or public/private toggle on an existing profile. */
export function useUpdateProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (params: { user_id: string; display_name?: string; is_public?: boolean }) => {
      const { user_id, ...updates } = params
      const { data, error } = await supabase
        .from('explorer_profiles')
        .update(updates)
        .eq('user_id', user_id)
        .select()
        .single()
      if (error) throw error
      return data as ExplorerProfile
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['explorer-profile', data.user_id], data)
      queryClient.invalidateQueries({ queryKey: ['community-showcase'] })
      queryClient.invalidateQueries({ queryKey: ['community-stats'] })
      queryClient.invalidateQueries({ queryKey: ['community-feed'] })
    },
  })
}

// ============================================================
// Feed, showcase, stats
// ============================================================

/** Recent activity from public explorer profiles. Polls every 30 seconds. */
export function useCommunityFeed(limit = 20) {
  return useQuery({
    queryKey: ['community-feed', limit],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_community_feed', { p_limit: limit })
      if (error) throw error
      return (data ?? []) as FeedEntry[]
    },
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
  })
}

/** Public explorer profiles ranked by specimen count. Polls every 60 seconds. */
export function useExplorerShowcase() {
  return useQuery({
    queryKey: ['community-showcase'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_explorer_showcase')
      if (error) throw error
      const rows = (data ?? []) as Array<{
        user_id: string
        display_name: string
        specimen_count: number
        rare_count: number
        first_discovery_count: number
        badges: ShowcaseExplorer['badges'] | null
        joined_at: string
      }>
      return rows.map(r => ({ ...r, badges: r.badges ?? [] })) as ShowcaseExplorer[]
    },
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
  })
}

/** Community-wide headline stats. */
export function useCommunityStats() {
  return useQuery({
    queryKey: ['community-stats'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_community_stats')
      if (error) throw error
      const row = Array.isArray(data) ? data[0] : data
      return row as CommunityStats
    },
    staleTime: 5 * 60 * 1000,
  })
}

// ============================================================
// Activity posting
// ============================================================

/** Write an entry to the activity feed (only called when the user has a public profile). */
export function usePostActivity() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (params: PostActivityParams) => {
      const { error } = await supabase.from('activity_feed').insert(params)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-feed'] })
    },
    // Fires after a successful excavation. The discovery itself is already saved;
    // only the Gazette post failed. Single-id toast so multiple events collapse.
    onError: () => {
      toast.error('Your discovery did not reach the Gazette.', { id: 'gazette-post-error' })
    },
  })
}

// ============================================================
// Badge checking
// ============================================================

/** Run badge eligibility check for the given user and return all badges with is_new flag. */
export function useCheckBadges() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.rpc('check_and_award_badges', { p_user_id: userId })
      if (error) throw error
      return (data ?? []) as BadgeResult[]
    },
    onSuccess: (_data, userId) => {
      queryClient.invalidateQueries({ queryKey: ['community-showcase'] })
      // Invalidate the per-user badge cache so BadgeCollection reflects new awards immediately
      queryClient.invalidateQueries({ queryKey: ['explorer-badges', userId] })
    },
    onError: () => {
      toast.error('New badges could not be checked.', { id: 'badge-check-error' })
    },
  })
}

// ============================================================
// Badge visibility hooks (Field Kit — Settings page)
// ============================================================

/** All badges earned by the current user, with per-badge visibility state. */
export function useMyBadges(userId: string | null) {
  return useQuery({
    queryKey: ['my-badges', userId],
    queryFn: async () => {
      if (!userId) return []
      const { data, error } = await supabase
        .from('explorer_badges')
        .select('id, badge_slug, is_public, earned_at')
        .eq('user_id', userId)
      if (error) throw error
      return (data ?? []) as EarnedBadge[]
    },
    enabled: !!userId,
    staleTime: 60 * 1000,
  })
}

/** Toggle the public/private visibility of an earned badge. */
export function useToggleBadgeVisibility() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (params: { badgeId: string; isPublic: boolean; userId: string }) => {
      const { error } = await supabase
        .from('explorer_badges')
        .update({ is_public: params.isPublic })
        .eq('id', params.badgeId)
      if (error) throw error
      return { userId: params.userId }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['my-badges', data.userId] })
      queryClient.invalidateQueries({ queryKey: ['community-showcase'] })
    },
    onError: () => {
      toast.error('Could not update badge visibility.')
    },
  })
}

// ============================================================
// Contact form
// ============================================================

export interface ContactMessageParams {
  sender_email: string
  sender_name?: string
  message: string
}

/** Submit a contact message via the Worker API, which handles DB insert and Resend notification. */
export function useSubmitContact() {
  return useMutation({
    mutationFn: async (params: ContactMessageParams) => {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? 'Contact submission failed')
      }
    },
  })
}

// ============================================================
// First discoverer lookup
// ============================================================

/** Look up the public display name of the first discoverer of a species (if they have a public profile). */
export function useFirstDiscoverer(firstDiscovererId: string | null, enabled = true) {
  return useQuery({
    queryKey: ['first-discoverer', firstDiscovererId],
    queryFn: async () => {
      if (!firstDiscovererId) return null
      const { data, error } = await supabase
        .from('explorer_profiles')
        .select('display_name')
        .eq('user_id', firstDiscovererId)
        .eq('is_public', true)
        .maybeSingle()
      if (error) throw error
      return data?.display_name ?? null
    },
    enabled: enabled && !!firstDiscovererId,
    staleTime: 10 * 60 * 1000,
  })
}
