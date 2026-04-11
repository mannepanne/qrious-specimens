// ABOUT: Shared TypeScript types for creatures — DNA structure and collection rows

export interface CreatureDNA {
  seed: number
  hash: string
  // Body plan
  symmetry: 'radial' | 'bilateral' | 'spiral' | 'fractal'
  symmetryOrder: number
  bodyShape: 'ovoid' | 'elongated' | 'spherical' | 'bell' | 'star' | 'diamond'
  bodyScale: number // 0.7–1.3
  // Appendages
  limbCount: number
  limbStyle: 'tentacle' | 'jointed' | 'branching' | 'flowing' | 'spike'
  limbLength: number // 0.4–1.2
  limbCurvature: number // 0–1
  // Surface
  patternType: 'dots' | 'stripes' | 'rings' | 'mesh' | 'scales' | 'none'
  patternDensity: number // 0.2–1
  // Eyes / sensory
  eyeCount: number
  eyeSize: number
  eyeStyle: 'round' | 'slit' | 'compound' | 'stalk'
  // Colour palette (HSL)
  hue1: number   // 0–360
  hue2: number   // 0–360
  saturation: number // 0–100
  lightness: number  // 0–100
  // Extra features
  hasAntennae: boolean
  hasTail: boolean
  hasShell: boolean
  hasCrown: boolean
  // Classification
  genus: string
  species: string
  order: string
  family: string
  habitat: string
  temperament: string
  estimatedSize: string
}

export interface CreatureRow {
  id: string
  qr_content: string
  qr_hash: string
  dna: CreatureDNA
  nickname: string | null
  discovered_at: string
  is_first_discoverer: boolean
}
