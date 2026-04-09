// ABOUT: Creature renderer router — selects the active render style from context
// ABOUT: Reads style from CreatureStyleProvider; supports per-render style overrides

import type { CreatureDNA } from '@/types/creature'
import type { CreatureStyle } from '@/hooks/useCreatureStyle'
import { useCreatureStyle } from '@/hooks/useCreatureStyle'
import CreatureRendererScifi from './CreatureRendererScifi'
import CreatureRendererSketch from './CreatureRendererSketch'
import CreatureRendererVolumetric from './CreatureRendererVolumetric'
import CreatureRendererGenerative from './CreatureRendererGenerative'

interface Props {
  dna: CreatureDNA
  size?: number
  showAnnotations?: boolean
  inkColor?: string
  className?: string
  animated?: boolean
  /** Override the global style for this render only */
  styleOverride?: CreatureStyle
  /** For generative style: scale image beyond size to fill a clipping container */
  overscale?: number
}

export default function CreatureRenderer(props: Props) {
  const { styleOverride, overscale, ...rest } = props
  const { style: contextStyle } = useCreatureStyle()
  const style = styleOverride ?? contextStyle

  switch (style) {
    case 'explorer-sketch':
      return <CreatureRendererSketch {...rest} />
    case 'volumetric-sketch':
      return <CreatureRendererVolumetric {...rest} />
    case 'generative-sketch':
      return <CreatureRendererGenerative dna={rest.dna} size={rest.size} className={rest.className} overscale={overscale} />
    case 'dark-scifi':
    default:
      return <CreatureRendererScifi {...rest} />
  }
}
