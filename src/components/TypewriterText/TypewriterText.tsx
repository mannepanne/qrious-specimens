// ABOUT: Typewriter animation component — reveals text character by character
// ABOUT: Used for field notes in the specimen page when notes first arrive

import { useState, useEffect, useRef } from 'react'

interface Props {
  text: string
  /** Characters per second */
  speed?: number
  /** Whether to animate or show full text immediately */
  animate?: boolean
  className?: string
  onComplete?: () => void
}

export default function TypewriterText({
  text,
  speed = 40,
  animate = true,
  className,
  onComplete,
}: Props) {
  const [displayedCount, setDisplayedCount] = useState(animate ? 0 : text.length)
  const completeFired = useRef(false)

  useEffect(() => {
    if (!animate) {
      setDisplayedCount(text.length)
      return
    }

    setDisplayedCount(0)
    completeFired.current = false
    const interval = 1000 / speed

    let i = 0
    const timer = setInterval(() => {
      i++
      setDisplayedCount(i)
      if (i >= text.length) {
        clearInterval(timer)
        if (!completeFired.current) {
          completeFired.current = true
          onComplete?.()
        }
      }
    }, interval)

    return () => clearInterval(timer)
  }, [text, speed, animate, onComplete])

  const displayed = text.slice(0, displayedCount)
  const isTyping = displayedCount < text.length && animate

  return (
    <span className={className}>
      {displayed}
      {isTyping && (
        <span className="inline-block w-[2px] h-[1em] bg-current ml-0.5 align-text-bottom animate-pulse" />
      )}
    </span>
  )
}
