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

// `phase` indicates how far the two-step erasure got. Total failure → app-data
// step never completed (RPC failed). Partial failure → app-data deleted but
// auth.users row remained (Admin API call failed). `auth_check_unavailable`
// → upstream Supabase 5xx during the is_admin() re-check (transient infra
// blip, not an authorisation failure — TD-025). `self_delete` → admin tried
// to delete their own account (TD-023). Each lets the dashboard render
// specific recovery guidance instead of a generic "delete failed".
export type AdminDeletePhase =
  | 'app_data'
  | 'auth_user'
  | 'auth_check_unavailable'
  | 'self_delete'
  | 'unknown'

export class AdminDeleteError extends Error {
  constructor(public readonly phase: AdminDeletePhase, message: string) {
    super(message)
    this.name = 'AdminDeleteError'
  }
}

interface AdminDeleteResponse {
  ok?: boolean
  app_data?: 'deleted' | 'failed'
  auth_user?: 'deleted' | 'failed'
  detail?: string
  error?: string
  code?: string
}

/**
 * Admin-only erasure: removes a user's app data via the `admin_delete_user_data`
 * RPC and then their `auth.users` row via the Supabase Auth Admin API. Both calls
 * happen server-side in the `/api/admin-delete-user` Worker so the service-role
 * key never reaches the browser. See ADR 2026-05-04-worker-mediated-account-erasure.md.
 */
export function useGdprDelete() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (userId: string) => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new AdminDeleteError('unknown', 'Not authenticated')

      const res = await fetch('/api/admin-delete-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ user_id: userId }),
      })

      const body = (await res.json().catch(() => ({}))) as AdminDeleteResponse

      if (res.ok && body.ok) return

      // Map Worker response shape to a phase-aware error. Order matters: more
      // specific signals (codes, partial-failure shape) before broader fallbacks.
      if (body.code === 'self_delete_blocked') {
        throw new AdminDeleteError(
          'self_delete',
          body.error ?? 'Cannot delete the calling admin.',
        )
      }
      if (body.code === 'auth_check_unavailable' || (res.status === 503 && body.error)) {
        throw new AdminDeleteError(
          'auth_check_unavailable',
          body.error ?? 'Auth check temporarily unavailable, please retry.',
        )
      }
      if (body.app_data === 'deleted' && body.auth_user === 'failed') {
        throw new AdminDeleteError(
          'auth_user',
          body.detail ?? 'Auth row removal failed after app data was deleted.',
        )
      }
      if (body.app_data === 'failed') {
        throw new AdminDeleteError(
          'app_data',
          body.detail ?? 'App data deletion failed; auth row not touched.',
        )
      }
      throw new AdminDeleteError('unknown', body.error ?? body.detail ?? `Request failed (${res.status})`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    },
  })
}
