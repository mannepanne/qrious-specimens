// ABOUT: Creature renderer — Victorian naturalist ink-on-parchment illustration
// ABOUT: Thin wrapper around CreatureRendererSketch; stable public API for all consumers

import type { CreatureDNA } from '@/types/creature'
import CreatureRendererSketch from './CreatureRendererSketch'

interface Props {
  dna: CreatureDNA
  size?: number
  showAnnotations?: boolean
  inkColor?: string
  className?: string
  animated?: boolean
}

export default function CreatureRenderer(props: Props) {
  return <CreatureRendererSketch {...props} />
}
