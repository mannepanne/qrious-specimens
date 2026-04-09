// ABOUT: Generative (AI-illustrated) creature renderer — Phase 3 placeholder
// ABOUT: Falls back to explorer-sketch until AI illustration is wired in Phase 4

import type { CreatureDNA } from '@/types/creature'
import CreatureRendererSketch from './CreatureRendererSketch'

interface Props {
  dna: CreatureDNA
  size?: number
  className?: string
  overscale?: number
}

/**
 * Phase 3: No AI illustration yet — renders the sketch style as a stand-in.
 * Phase 4 will replace this with Gemini-generated Victorian naturalist images.
 */
export default function CreatureRendererGenerative({ dna, size = 180, className }: Props) {
  return <CreatureRendererSketch dna={dna} size={size} className={className} />
}
