// ABOUT: Admin-only React Query hooks for the admin dashboard
// ABOUT: All RPCs enforce is_admin() at the database level; client-side is for UX only

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

// ============================================================
// Types
// ============================================================

export interface AdminUser {
  user_id: string
  email: string
  display_name: string | null
  created_at: string
  creature_count: number
  is_admin: boolean
}

export interface ContactMessage {
  id: string
  sender_email: string
  sender_name: string | null
  message: string
  created_at: string
  read: boolean
}

export interface AdminStats {
  total_users: number
  users_with_specimens: number
  unique_specimens: number
  total_discoveries: number
  total_field_notes: number
  contact_submissions: number
}

// ============================================================
// Queries
// ============================================================

/** Fetch all contact messages, newest first. Admin-only via RLS. */
export function useAdminMessages() {
  return useQuery({
    queryKey: ['admin-messages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contact_messages')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as ContactMessage[]
    },
  })
}

/** Fetch all registered users via admin RPC. */
export function useAdminUsers() {
  return useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_list_users')
      if (error) throw error
      return (data ?? []) as AdminUser[]
    },
  })
}

/** Fetch site-wide statistics via admin RPC. */
export function useAdminStats() {
  return useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_get_stats')
      if (error) throw error
      return data as unknown as AdminStats
    },
  })
}

// ============================================================
// Mutations
// ============================================================

/** Mark a contact message as read. */
export function useMarkMessageRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('contact_messages')
        .update({ read: true })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-messages'] })
    },
  })
}

/** Export all data for a user as a JSON blob download. */
export function useGdprExport() {
  return useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.rpc('admin_export_user_data', {
        p_user_id: userId,
      })
      if (error) throw error
      return data as Record<string, unknown>
    },
  })
}

/** Delete all app data for a user. Does not delete their auth account. */
export function useGdprDelete() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.rpc('admin_delete_user_data', {
        p_user_id: userId,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    },
  })
}
