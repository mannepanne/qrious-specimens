// ABOUT: Heuristic classifier for the opening sentence of a field-notes entry
// ABOUT: Used by the trial-and-score loop to detect opener-shape uniformity (TD-031)

/**
 * The classifier exists to validate prompt changes mechanically: regenerate N
 * field notes, classify each opener, assert no single shape exceeds the
 * uniformity threshold. It is intentionally coarse — only six buckets — so it
 * stays deterministic and reviewable. Subtle stylistic variation is for human
 * review; this just catches gross uniformity.
 *
 * Buckets are listed in priority order: a sentence matching multiple gets the
 * earliest bucket that matches.
 */

export type OpenerShape =
  | 'temporal-prepositional'
  | 'generic-introduction'
  | 'body-part-first'
  | 'numeric-feature'
  | 'setting-first'
  | 'mistaken-identity'
  | 'rhetorical-question'
  | 'other'

const TEMPORAL_PREPOSITIONS = new Set([
  'upon',
  'when',
  'whilst',
  'while',
  'as',
  'having',
  'before',
  'after',
  'during',
])

const SPECIMEN_NOUNS = new Set([
  'creature',
  'specimen',
  'organism',
  'being',
  'animal',
])

const BODY_PART_NOUNS = new Set([
  'eye',
  'eyes',
  'spine',
  'spines',
  'tentacle',
  'tentacles',
  'limb',
  'limbs',
  'leg',
  'legs',
  'antenna',
  'antennae',
  'crown',
  'carapace',
  'shell',
  'tail',
  'dome',
  'fronds',
  'frill',
  'frills',
  'fin',
  'fins',
  'stalk',
  'stalks',
  'ornamentation',
  'pattern',
  'stripes',
  'dots',
  'scales',
  'mesh',
  'rings',
  'filaments',
  'appendages',
  'body',
  'head',
  'mantle',
  'feathers',
  // abstract-property leads — "The radial symmetry struck me first..."
  'symmetry',
  'form',
  'geometry',
  'architecture',
  'silhouette',
  'shape',
  'outline',
  'profile',
  'spheroid',
  'structure',
  'arrangement',
  'configuration',
  'aspect',
  'bearing',
  'posture',
  'colour',
  'colouration',
  'coloration',
  'hue',
  'tint',
  'sheen',
  'lustre',
  'iridescence',
])

const SETTING_PREPOSITIONS = new Set([
  'among',
  'amongst',
  'in',
  'within',
  'beneath',
  'above',
  'below',
  'beside',
  'near',
  'across',
  'between',
  'under',
  'inside',
])

const NUMBER_WORDS = new Set([
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
])

function tokens(sentence: string): string[] {
  return sentence
    .trim()
    .split(/\s+/)
    .map((t) => t.replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, '').toLowerCase())
    .filter(Boolean)
}

export function classifyOpenerShape(sentence: string): OpenerShape {
  const t = tokens(sentence)
  if (t.length === 0) return 'other'

  const w0 = t[0]
  const w1 = t[1] ?? ''
  const w2 = t[2] ?? ''

  // Mistaken-identity template: "What I had first taken for...", "I mistook...", "I had taken it for...", "I took it for..."
  if (w0 === 'what' && w1 === 'i' && (w2 === 'had' || w2 === 'first' || w2 === 'took')) {
    return 'mistaken-identity'
  }
  if (w0 === 'i' && (w1 === 'mistook' || w1 === 'took' || (w1 === 'had' && w2 === 'taken'))) {
    return 'mistaken-identity'
  }

  // Rhetorical-question template: "By what curious accident...", "How does...", "What manner of..."
  if (w0 === 'by' && w1 === 'what') return 'rhetorical-question'
  if (w0 === 'how' && (w1 === 'does' || w1 === 'do' || w1 === 'can' || w1 === 'might' || w1 === 'shall')) {
    return 'rhetorical-question'
  }
  if (w0 === 'what' && w1 === 'manner') return 'rhetorical-question'

  // Temporal-prepositional: leading conjunction or preposition of time
  if (TEMPORAL_PREPOSITIONS.has(w0)) return 'temporal-prepositional'
  if (w0 === 'at' && (w1 === 'first' || w1 === 'the' || w1 === 'this')) {
    return 'temporal-prepositional'
  }

  // Numeric-feature: leading number word (or digit) — e.g. "Three eyes regarded me..."
  if (NUMBER_WORDS.has(w0) || /^\d+$/.test(w0)) return 'numeric-feature'

  // Generic specimen-introduction: "The creature presents...", "This specimen exhibits..."
  if ((w0 === 'the' || w0 === 'this') && SPECIMEN_NOUNS.has(w1)) return 'generic-introduction'

  // Body-part-first: "The eyes caught the light...", "The crown rose..."
  if ((w0 === 'the' || w0 === 'this' || w0 === 'its') && BODY_PART_NOUNS.has(w1)) {
    return 'body-part-first'
  }
  // Possessive variant: "The creature's eyes..." → still anatomical lead
  if ((w0 === 'the' || w0 === 'this') && (w1.endsWith("'s") || w1 === "creature's" || w1 === "specimen's") && BODY_PART_NOUNS.has(w2)) {
    return 'body-part-first'
  }
  // Adjectival body-part lead: "The delicate filaments..." / "The single eye..."
  if ((w0 === 'the' || w0 === 'this') && t.slice(1, 5).some((w) => BODY_PART_NOUNS.has(w))) {
    return 'body-part-first'
  }

  // Setting-first: leading locative preposition
  if (SETTING_PREPOSITIONS.has(w0)) return 'setting-first'

  return 'other'
}

export function distributionByShape(sentences: string[]): Record<OpenerShape, number> {
  const counts: Record<OpenerShape, number> = {
    'temporal-prepositional': 0,
    'generic-introduction': 0,
    'body-part-first': 0,
    'numeric-feature': 0,
    'setting-first': 0,
    'mistaken-identity': 0,
    'rhetorical-question': 0,
    other: 0,
  }
  for (const s of sentences) counts[classifyOpenerShape(s)]++
  return counts
}

export function maxShareByShape(sentences: string[]): { shape: OpenerShape; share: number } {
  if (sentences.length === 0) return { shape: 'other', share: 0 }
  const counts = distributionByShape(sentences)
  let topShape: OpenerShape = 'other'
  let topCount = -1
  for (const [shape, n] of Object.entries(counts) as [OpenerShape, number][]) {
    if (n > topCount) {
      topCount = n
      topShape = shape
    }
  }
  return { shape: topShape, share: topCount / sentences.length }
}
