// ABOUT: Hook to check whether the current user has admin privileges
// ABOUT: Reads is_admin from the profiles table; returns false on any error (fail-safe)

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

/** Returns true when the given user has is_admin = true in the profiles table. */
export function useIsAdmin(userId: string | null | undefined) {
  return useQuery({
    queryKey: ['is-admin', userId],
    queryFn: async () => {
      if (!userId) return false
      const { data, error } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', userId)
        .single()
      if (error) {
        console.error('[useIsAdmin] Failed to check admin status:', error)
        return false
      }
      return data?.is_admin === true
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  })
}
