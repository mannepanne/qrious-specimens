// ABOUT: Lightweight page-view tracker — inserts a row to page_events on each call
// ABOUT: Session ID is a UUID stored in sessionStorage; user_id is optional (nullable for anon visits)

import { useCallback } from 'react'
import { supabase } from '@/lib/supabase'

function getOrCreateSessionId(): string {
  const key = 'qrious_session_id'
  let id = sessionStorage.getItem(key)
  if (!id) {
    id = crypto.randomUUID()
    sessionStorage.setItem(key, id)
  }
  return id
}

/**
 * Returns a `trackPageView(pageName)` function.
 * Fire-and-forget: errors are logged but never surfaced to the user.
 */
export function useTrackPageView() {
  const trackPageView = useCallback(async (pageName: string, userId?: string | null) => {
    const sessionId = getOrCreateSessionId()
    const row: Record<string, string | null> = {
      page_name: pageName,
      session_id: sessionId,
      user_id: userId ?? null,
    }
    const { error } = await supabase.from('page_events').insert(row)
    if (error) {
      console.error('page_events insert failed:', error.message)
    }
  }, [])

  return { trackPageView }
}
