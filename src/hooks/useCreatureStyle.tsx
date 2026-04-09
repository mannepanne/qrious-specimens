// ABOUT: React context + hook for the creature rendering style preference
// ABOUT: Persisted in localStorage; default is explorer-sketch (works without AI)

import { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'

export type CreatureStyle = 'dark-scifi' | 'explorer-sketch' | 'volumetric-sketch' | 'generative-sketch'

interface CreatureStyleContextValue {
  style: CreatureStyle
  setStyle: (s: CreatureStyle) => void
}

const CreatureStyleContext = createContext<CreatureStyleContextValue>({
  style: 'explorer-sketch',
  setStyle: () => {},
})

const STORAGE_KEY = 'qrious-creature-style'

const VALID_STYLES: CreatureStyle[] = ['dark-scifi', 'explorer-sketch', 'volumetric-sketch', 'generative-sketch']

export function CreatureStyleProvider({ children }: { children: ReactNode }) {
  const [style, setStyleState] = useState<CreatureStyle>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored && VALID_STYLES.includes(stored as CreatureStyle)) {
        return stored as CreatureStyle
      }
    } catch {
      // localStorage unavailable (SSR, private browsing restrictions)
    }
    return 'explorer-sketch'
  })

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, style)
    } catch {
      // ignore
    }
  }, [style])

  return (
    <CreatureStyleContext.Provider value={{ style, setStyle: setStyleState }}>
      {children}
    </CreatureStyleContext.Provider>
  )
}

export function useCreatureStyle() {
  return useContext(CreatureStyleContext)
}
