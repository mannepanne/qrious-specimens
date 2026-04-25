// ABOUT: Magic link authentication hook using Supabase Auth
// ABOUT: Tracks auth state (loading/unauthenticated/authenticated/error) and exposes sendMagicLink / signOut
import { useState, useEffect } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export type AuthState =
  | { status: 'loading' }
  | { status: 'unauthenticated' }
  | { status: 'authenticated'; session: Session }
  | { status: 'error'; message: string }

export interface UseAuthReturn {
  authState: AuthState
  sendMagicLink: (email: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

export function useAuth(): UseAuthReturn {
  const [authState, setAuthState] = useState<AuthState>({ status: 'loading' })

  useEffect(() => {
    // Resolve initial session — handles page reload and magic link return
    supabase.auth.getSession()
      .then(({ data: { session }, error }) => {
        if (error) {
          setAuthState({ status: 'error', message: error.message })
        } else {
          setAuthState(
            session ? { status: 'authenticated', session } : { status: 'unauthenticated' }
          )
        }
      })
      .catch(() => {
        // Network failure or corrupted localStorage — fall back to unauthenticated
        setAuthState({ status: 'unauthenticated' })
      })

    // Subscribe to auth state changes (sign in via magic link, sign out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        // Clean URL fragment left by magic link token exchange — token has been consumed
        if (window.location.hash || window.location.search.includes('code=')) {
          window.history.replaceState(null, '', window.location.pathname)
        }
        setAuthState({ status: 'authenticated', session })
      } else {
        setAuthState({ status: 'unauthenticated' })
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function sendMagicLink(email: string): Promise<{ error: string | null }> {
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          // Redirect back to the app root after clicking the magic link
          emailRedirectTo: window.location.origin,
        },
      })
      if (error) return { error: friendlyAuthMessage(error.message) }
      return { error: null }
    } catch (err) {
      // Synchronous throw — typically a complete network failure before the
      // request reaches Supabase. signInWithOtp normally folds errors into
      // the returned object, so this branch is rare.
      const message = err instanceof Error ? err.message : ''
      return { error: friendlyAuthMessage(message) }
    }
  }

  /** Maps raw auth-provider errors to user-friendly copy. Falls back to the original message. */
  function friendlyAuthMessage(raw: string): string {
    const lower = raw.toLowerCase()
    if (lower.includes('rate limit')) {
      return 'Too many dispatches in a short time. Please wait a minute before trying again.'
    }
    if (lower.includes('invalid') && lower.includes('email')) {
      return 'That correspondence address does not appear valid.'
    }
    if (lower.includes('failed to fetch') || lower.includes('network')) {
      return 'The post could not be sent. Check your connection and try again.'
    }
    return raw || 'The dispatch could not be sent. Please try again.'
  }

  async function signOut(): Promise<void> {
    await supabase.auth.signOut()
  }

  return { authState, sendMagicLink, signOut }
}
