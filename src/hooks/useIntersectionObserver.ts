// ABOUT: Hook that fires a callback when a sentinel element scrolls into view
// ABOUT: Used for infinite scroll in the cabinet grid

import { useCallback, useRef } from 'react'

interface Options {
  rootMargin?: string
  threshold?: number
  enabled?: boolean
}

/**
 * Returns a callback ref to attach to the sentinel element. Using a callback ref
 * (rather than useRef + useEffect) ensures the observer is created whenever the
 * sentinel mounts — including after the initial empty-state resolves to data.
 */
export function useIntersectionObserver(
  onIntersect: () => void,
  { rootMargin = '100px', threshold = 0, enabled = true }: Options = {},
) {
  const observerRef = useRef<IntersectionObserver | null>(null)
  const callbackRef = useRef(onIntersect)
  callbackRef.current = onIntersect

  const setRef = useCallback(
    (el: HTMLDivElement | null) => {
      observerRef.current?.disconnect()
      observerRef.current = null
      if (!el || !enabled) return

      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting) {
            callbackRef.current()
          }
        },
        { rootMargin, threshold },
      )
      observerRef.current.observe(el)
    },
    [rootMargin, threshold, enabled],
  )

  return setRef
}
