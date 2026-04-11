// ABOUT: Prompt builders for Gemini (illustration) and Claude (field notes)
// ABOUT: Both prompts are derived entirely from the CreatureDNA

import type { CreatureDNA } from '@/types/creature'

const BODY_DESC: Record<string, string> = {
  ovoid: 'an ovoid, egg-shaped',
  elongated: 'an elongated, worm-like',
  spherical: 'a round, spherical',
  bell: 'a bell-shaped, jellyfish-like',
  star: 'a star-shaped, radially symmetric',
  diamond: 'a diamond-shaped, angular',
}

const LIMB_DESC: Record<string, string> = {
  tentacle: 'flowing tentacles',
  jointed: 'jointed arthropod-like legs',
  branching: 'branching tree-like appendages',
  flowing: 'undulating flowing fins or frills',
  spike: 'sharp spike-like protrusions',
}

export function buildGeminiPrompt(dna: CreatureDNA): string {
  const features: string[] = []
  if (dna.hasShell) features.push('a protective shell or carapace')
  if (dna.hasCrown) features.push('a crown of sensory spines or fronds')
  if (dna.hasAntennae) features.push('long sensory antennae')
  if (dna.hasTail) features.push('an articulated segmented tail')
  const featureStr = features.length > 0 ? `, with ${features.join(', ')}` : ''

  const eyeDesc =
    dna.eyeCount === 0
      ? 'no visible eyes'
      : dna.eyeCount === 1
        ? `a single ${dna.eyeStyle} eye`
        : `${dna.eyeCount} ${dna.eyeStyle} eyes`

  const bodyDesc = BODY_DESC[dna.bodyShape] ?? 'an organic'
  const limbDesc = LIMB_DESC[dna.limbStyle] ?? `${dna.limbStyle} limbs`

  return `Victorian naturalist scientific illustration of a newly discovered organism called "${dna.genus} ${dna.species}" (Order: ${dna.order}, Family: ${dna.family}).

The creature has ${bodyDesc} body with ${dna.symmetry} symmetry. It has EXACTLY ${dna.limbCount} ${limbDesc} — not more, not fewer, exactly ${dna.limbCount}. It has ${eyeDesc}${featureStr}. Its surface has a ${dna.patternType} pattern. It is a ${dna.temperament} ${dna.habitat} organism, estimated size ${dna.estimatedSize}.

CRITICAL ANATOMY REQUIREMENT: The creature must have exactly ${dna.limbCount} limbs/appendages. Count them carefully. ${dna.eyeCount > 0 ? `It must have exactly ${dna.eyeCount} eye${dna.eyeCount !== 1 ? 's' : ''}.` : 'It has no eyes.'} Getting the exact count right is essential for scientific accuracy.

Style: Dense Victorian-era scientific engraving in sepia/brown ink on aged parchment. Thick confident outlines with multiple pen strokes. Dense cross-hatching and stipple dot shading to create volume and depth. The creature should look organic, fleshy, and alive — like a real biological specimen drawn by a master naturalist illustrator. Overlapping organic masses suggesting real 3D volume. No background — just the creature floating on the page like a plate from a natural history journal. IMPORTANT: Do NOT include any text, labels, annotations, captions, or lettering anywhere in the image. The image must contain only the creature illustration and nothing else.`
}

export function buildClaudePrompt(dna: CreatureDNA, hasImage: boolean): string {
  const features: string[] = []
  if (dna.hasShell) features.push('a protective carapace')
  if (dna.hasCrown) features.push('a crown of sensory fronds')
  if (dna.hasAntennae) features.push('delicate antennae')
  if (dna.hasTail) features.push('an articulated caudal appendage')
  const featureStr = features.length > 0 ? `, notable for ${features.join(', ')}` : ''

  const eyeDesc =
    dna.eyeCount === 0
      ? 'no visible eyes'
      : dna.eyeCount === 1
        ? `a single ${dna.eyeStyle} eye`
        : `${dna.eyeCount} ${dna.eyeStyle} eyes`

  const imageInstruction = hasImage
    ? `An illustration of the specimen is attached. Study it carefully and describe what you SEE in the illustration — its form, textures, posture, and any striking visual details. Ground your prose in the actual appearance shown, not just the trait data below.`
    : `No illustration is available. Use the trait data below to imagine the specimen vividly.`

  return `You are a Victorian naturalist writing a field journal entry about a newly discovered organism. Write exactly 2 paragraphs.

${imageInstruction}

The specimen is "${dna.genus} ${dna.species}" (Order: ${dna.order}, Family: ${dna.family}). It has a ${dna.bodyShape} body with ${dna.symmetry} symmetry, ${dna.limbCount} ${dna.limbStyle} appendages, ${eyeDesc}, and a ${dna.patternType} surface pattern${featureStr}. It is a ${dna.temperament} ${dna.habitat} organism of ${dna.estimatedSize} size.

Style guidance:
- Write in the voice of a Victorian naturalist — precise, wondering, elegant. Think Darwin's Beagle journals, Humboldt's personal narratives, the measured wonder of early Royal Society correspondence.
- First paragraph: the moment of discovery — where and how the specimen was found, first impressions, the thrill of encountering something unknown.
- Second paragraph: closer observation — anatomical details that fascinate, behaviour noted, speculation about the creature's place in the natural order.
- Tone: intellectual curiosity and quiet awe. Never frightening, grotesque, or sensational. This is the joy of scientific discovery.
- Do NOT reference any real people, real places, real institutions, or real species by name.
- Do NOT reference any real books, authors, or literary works.
- Do NOT include anything violent, disturbing, political, religious, or contemporary.
- Keep it to exactly 2 paragraphs, each 2-4 sentences. Total length under 150 words.
- Write only the journal entry text. No titles, headers, dates, labels, or framing of any kind. Do NOT start with "# " or any markdown. Begin directly with the first sentence of the journal entry.`
}
