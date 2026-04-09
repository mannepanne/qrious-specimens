// ABOUT: Magic link authentication hook using Supabase Auth
// ABOUT: Tracks auth state (session, loading, error) and exposes sendMagicLink / signOut
import { useState, useEffect } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export type AuthState =
  | { status: 'loading' }
  | { status: 'unauthenticated' }
  | { status: 'authenticated'; session: Session }

export interface UseAuthReturn {
  authState: AuthState
  sendMagicLink: (email: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

export function useAuth(): UseAuthReturn {
  const [authState, setAuthState] = useState<AuthState>({ status: 'loading' })

  useEffect(() => {
    // Resolve initial session from Supabase (handles page reload / deep link return)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthState(
        session ? { status: 'authenticated', session } : { status: 'unauthenticated' }
      )
    })

    // Subscribe to auth state changes (sign in via magic link, sign out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthState(
        session ? { status: 'authenticated', session } : { status: 'unauthenticated' }
      )
    })

    return () => subscription.unsubscribe()
  }, [])

  async function sendMagicLink(email: string): Promise<{ error: string | null }> {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // Redirect back to the app root after clicking the magic link
        emailRedirectTo: window.location.origin,
      },
    })
    if (error) return { error: error.message }
    return { error: null }
  }

  async function signOut(): Promise<void> {
    await supabase.auth.signOut()
  }

  return { authState, sendMagicLink, signOut }
}
