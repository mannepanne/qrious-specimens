// ABOUT: Deterministic creature DNA engine — any QR content string → unique species
// ABOUT: Uses FNV-1a hash + mulberry32 seeded PRNG; same input always yields same DNA

import type { CreatureDNA } from '@/types/creature'

// djb2 hash → 32-bit seed for the PRNG
function hashString(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0
  }
  return h >>> 0
}

// Two-round FNV-1a → 16 hex character species hash
function hashHex(str: string): string {
  let h1 = 0x811c9dc5
  let h2 = 0x01000193
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0
    h2 = Math.imul(h2 ^ c, 0x811c9dc5) >>> 0
  }
  return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0')
}

// mulberry32 PRNG — fast, high quality, seedable
function createRng(seed: number) {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)]
}

function range(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min)
}

function rangeInt(rng: () => number, min: number, max: number): number {
  return Math.floor(range(rng, min, max + 1))
}

const GENUS_PREFIXES = [
  'Lum', 'Vor', 'Cryst', 'Neb', 'Thal', 'Rad', 'Ign', 'Aqu',
  'Syl', 'Phor', 'Cel', 'Orb', 'Hex', 'Fib', 'Spir', 'Cor',
  'Vel', 'Aeth', 'Nox', 'Sol', 'Gyr', 'Plex', 'Arc', 'Zon',
  'Flux', 'Mor', 'Prim', 'Ser', 'Dex', 'Ven', 'Bry', 'Cal',
] as const

const GENUS_SUFFIXES = [
  'inae', 'ara', 'ella', 'odon', 'opus', 'tera', 'cera',
  'phora', 'morpha', 'stoma', 'derma', 'nema', 'zona', 'glyph',
  'axis', 'forma', 'ix', 'una', 'osa', 'antha', 'petra', 'mera',
] as const

const SPECIES_WORDS = [
  'velaris', 'profunda', 'stellata', 'spiralis', 'crystallina',
  'luminosa', 'abyssalis', 'elegans', 'mirabilis', 'gracilis',
  'robusta', 'tenuis', 'magna', 'parva', 'aurata', 'argentea',
  'radians', 'obscura', 'calida', 'frigida', 'antiqua', 'nova',
  'pulchra', 'formosa', 'striata', 'maculata', 'reticulata',
  'ramosa', 'nodosa', 'plana', 'convexa', 'undulata', 'serrata',
] as const

const ORDERS = [
  'Radiata', 'Spiralia', 'Crystalliformes', 'Tentaculata',
  'Arthrofossa', 'Nebulozoa', 'Hexapoda', 'Digitata',
  'Polymorphida', 'Fractalia', 'Geoderma', 'Luminaria',
] as const

const FAMILIES = [
  'Phosphoridae', 'Vorticidae', 'Crystallidae', 'Nebulidae',
  'Thalassidae', 'Radiolidae', 'Ignavidae', 'Sylvanidae',
  'Orbidae', 'Fibrillidae', 'Spiridae', 'Coronidae',
  'Gyrellidae', 'Plexidae', 'Arcturidae', 'Zonidae',
] as const

const HABITATS = [
  'pelagic', 'benthic', 'littoral', 'abyssal', 'reef-dwelling',
  'thermophilic', 'cryophilic', 'photosynthetic surface',
  'deep trench', 'coral garden', 'kelp forest', 'volcanic vent',
] as const

const TEMPERAMENTS = [
  'docile', 'curious', 'reclusive', 'gregarious', 'solitary',
  'territorial', 'migratory', 'sessile', 'symbiotic', 'predatory',
  'defensive', 'playful',
] as const

const SIZES = [
  '2–5 mm', '5–12 mm', '1–3 cm', '3–8 cm', '8–15 cm',
  '12–18 cm', '15–25 cm', '20–35 cm', '30–50 cm', '40–80 cm',
] as const

/** Generate fully deterministic creature DNA from any QR code content string */
export function generateCreatureDNA(qrContent: string): CreatureDNA {
  const seed = hashString(qrContent)
  const hash = hashHex(qrContent)
  const rng = createRng(seed)

  const symmetry = pick(rng, ['radial', 'bilateral', 'spiral', 'fractal'] as const)
  const symmetryOrder = symmetry === 'radial'    ? rangeInt(rng, 3, 8)
    : symmetry === 'bilateral' ? 2
    : symmetry === 'spiral'    ? rangeInt(rng, 1, 3)
    : rangeInt(rng, 2, 5)

  const bodyShape = pick(rng, ['ovoid', 'elongated', 'spherical', 'bell', 'star', 'diamond'] as const)
  const bodyScale = range(rng, 0.7, 1.3)

  const limbCount = symmetry === 'radial'
    ? symmetryOrder
    : symmetry === 'bilateral'
    ? rangeInt(rng, 2, 6) * 2
    : rangeInt(rng, 3, 8)
  const limbStyle = pick(rng, ['tentacle', 'jointed', 'branching', 'flowing', 'spike'] as const)
  const limbLength = range(rng, 0.4, 1.2)
  const limbCurvature = rng()

  const patternType = pick(rng, ['dots', 'stripes', 'rings', 'mesh', 'scales', 'none'] as const)
  const patternDensity = range(rng, 0.2, 1)

  const eyeCount = rangeInt(rng, 0, 4)
  const eyeSize = range(rng, 0.5, 1.5)
  const eyeStyle = pick(rng, ['round', 'slit', 'compound', 'stalk'] as const)

  const hue1 = range(rng, 0, 360)
  const hue2 = (hue1 + range(rng, 30, 180)) % 360
  const saturation = range(rng, 20, 60)
  const lightness = range(rng, 35, 65)

  const hasAntennae = rng() > 0.6
  const hasTail = rng() > 0.5
  const hasShell = rng() > 0.7
  const hasCrown = rng() > 0.8

  const genus = pick(rng, GENUS_PREFIXES) + pick(rng, GENUS_SUFFIXES)
  const species = pick(rng, SPECIES_WORDS)
  const order = pick(rng, ORDERS)
  const family = pick(rng, FAMILIES)
  const habitat = pick(rng, HABITATS)
  const temperament = pick(rng, TEMPERAMENTS)
  const estimatedSize = pick(rng, SIZES)

  return {
    seed, hash, symmetry, symmetryOrder, bodyShape, bodyScale,
    limbCount, limbStyle, limbLength, limbCurvature,
    patternType, patternDensity,
    eyeCount, eyeSize, eyeStyle,
    hue1, hue2, saturation, lightness,
    hasAntennae, hasTail, hasShell, hasCrown,
    genus, species, order, family, habitat, temperament,
    estimatedSize,
  }
}
