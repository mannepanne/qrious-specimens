// ABOUT: Page-flip animation wrapper — 3D perspective turn when pageKey changes
// ABOUT: Used for specimen-to-specimen navigation in the cabinet

import { useState, useEffect, useRef, type ReactNode } from 'react'

interface Props {
  /** Changes when the page content changes — triggers the flip animation */
  pageKey: string
  /** Direction: 1 = forward, -1 = backward */
  direction: number
  children: ReactNode
}

export default function PageFlip({ pageKey, direction, children }: Props) {
  const [phase, setPhase] = useState<'idle' | 'exit' | 'enter'>('idle')
  const prevKeyRef = useRef(pageKey)
  const dirRef = useRef(direction)
  const exitTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const enterTimerRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    dirRef.current = direction
  }, [direction])

  useEffect(() => {
    if (pageKey === prevKeyRef.current) return
    prevKeyRef.current = pageKey

    if (exitTimerRef.current) clearTimeout(exitTimerRef.current)
    if (enterTimerRef.current) clearTimeout(enterTimerRef.current)

    setPhase('exit')

    exitTimerRef.current = setTimeout(() => {
      setPhase('enter')
      enterTimerRef.current = setTimeout(() => setPhase('idle'), 300)
    }, 200)

    return () => {
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current)
      if (enterTimerRef.current) clearTimeout(enterTimerRef.current)
    }
  }, [pageKey])

  const isForward = dirRef.current > 0

  let style: React.CSSProperties = {}

  if (phase === 'exit') {
    style = {
      transform: isForward
        ? 'perspective(1200px) rotateY(-3deg) translateX(-20px) scale(0.98)'
        : 'perspective(1200px) rotateY(3deg) translateX(20px) scale(0.98)',
      opacity: 0,
      transformOrigin: isForward ? 'left center' : 'right center',
      transition: 'transform 200ms cubic-bezier(0.4, 0, 0.7, 0.2), opacity 180ms ease-out',
    }
  } else if (phase === 'enter') {
    style = {
      transform: 'perspective(1200px) rotateY(0) translateX(0) scale(1)',
      opacity: 1,
      transformOrigin: isForward ? 'right center' : 'left center',
      transition: 'transform 300ms cubic-bezier(0.2, 0.8, 0.3, 1), opacity 250ms ease-in',
    }
  }

  return <div style={style}>{children}</div>
}
