// ABOUT: Hook that fires a callback when a sentinel element scrolls into view
// ABOUT: Used for infinite scroll in the cabinet grid

import { useEffect, useRef } from 'react'

interface Options {
  rootMargin?: string
  threshold?: number
  enabled?: boolean
}

/** Calls onIntersect when the returned ref element enters the viewport */
export function useIntersectionObserver(
  onIntersect: () => void,
  { rootMargin = '100px', threshold = 0, enabled = true }: Options = {},
) {
  const ref = useRef<HTMLDivElement | null>(null)
  const callbackRef = useRef(onIntersect)
  callbackRef.current = onIntersect

  useEffect(() => {
    if (!enabled || !ref.current) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          callbackRef.current()
        }
      },
      { rootMargin, threshold },
    )

    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [rootMargin, threshold, enabled])

  return ref
}
