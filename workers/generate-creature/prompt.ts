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

/**
 * Six opener-directives, rotated deterministically by `dna.seed`. A single-shot
 * prompt cannot see other entries in the corpus, so without an explicit shape
 * directive the model collapses to whichever opener-shape it finds most
 * natural — pure-prompt iteration cycles through different attractors but
 * never spreads across the corpus. Rotation by seed makes opener-shape another
 * deterministic projection of the DNA, alongside genus, body plan, and traits.
 * Same QR → same notes, preserving the discovery contract.
 */
const OPENER_DIRECTIVES = [
  'Begin with a specific anatomical detail — a feature, count, or arrangement that struck the eye first.',
  'Begin with the setting in which the specimen was found — the place, the conditions, the surrounding matter — before the specimen itself enters the sentence.',
  'Begin with a sensory clue that preceded the sighting — a glimmer, a sound, a movement, a change in the water or air.',
  'Begin with an anomaly — something you mistook for one thing before it revealed itself as another.',
  'Begin with the act of discovery — what you were doing, where you were, the moment something caught your attention.',
  'Begin with a question or contemplation — wonder at the form before describing it.',
] as const

export function pickOpenerDirective(seed: number): string {
  const index = Math.abs(Math.floor(seed)) % OPENER_DIRECTIVES.length
  return OPENER_DIRECTIVES[index]
}

/**
 * Six pull-quote lead-directives, rotated deterministically by `dna.seed`. Same
 * mechanism as the field-notes opener rotation (above): a single-shot prompt
 * cannot see the rest of the corpus, so without an explicit shape directive
 * the model converges on whichever opener-shape it finds most natural — soft
 * "vary your openers" prompts cycle the dominant attractor but don't spread
 * across the corpus. Empirically (trial-pull-quotes.ts trials 1–3, 2026-05-10)
 * the unseeded prompt parked at 38–63% numeric-feature leads ("Three eyes…",
 * "Four appendages…"). Rotation by seed makes lead-shape another deterministic
 * projection of the DNA — same QR → same pull-quote.
 */
const PULL_QUOTE_LEADS = [
  'Lead with the most striking colour, surface, or texture in the notes — sheen, dotting, mesh, lustre, or how light moves across the creature.',
  'Lead with motion, gesture, or behaviour — undulation, recoil, the way appendages curl or extend, the pace at which the creature moves.',
  'Lead with the setting where the specimen was found — the place, the depth, the surrounding matter or conditions — before the creature itself enters the line.',
  'Lead with a mistaken-identity reading — "I had taken it for…", "What at first appeared to be…" — letting the form correct your first impression.',
  'Lead with a small turn of phrase or aphorism about the form — symmetry, geometry, proportion, what the shape suggests about the creature\'s habits or kingdom.',
  'Lead with a sensory clue that preceded recognition — a sound, a faint light, a movement, a clicking, a glimmer in dark water.',
] as const

export function pickPullQuoteLead(seed: number): string {
  const index = Math.abs(Math.floor(seed)) % PULL_QUOTE_LEADS.length
  return PULL_QUOTE_LEADS[index]
}

/**
 * Pull-quote prompt — text-only follow-up to field-notes generation.
 *
 * Produces one evocative, self-contained line for the Gazette feed. The seed
 * argument is the same `dna.seed` used to rotate field-notes openers; passing
 * it here gives pull-quotes the same corpus-wide variety guarantee.
 *
 * The hard constraints kept absolute: self-contained line (no "the specimen"),
 * no rarity vocabulary (forward-compat with rarity-and-census.md), output the
 * line itself with no quotes/preamble.
 */
export function buildPullQuotePrompt(fieldNotes: string, seed: number): string {
  return `You are a Victorian naturalist preparing a single pull-quote for a journal feed. Below are field notes you have just written about a newly discovered specimen. Distil from them ONE evocative line — strict ceiling of 200 characters and 35 words, ideally between 120 and 180 characters — that will be read on its own, separated from the surrounding entry.

Field notes:
"""
${fieldNotes}
"""

Lead-directive for THIS pull-quote: ${pickPullQuoteLead(seed)} Open the line under that directive — let the directive shape the angle, drawing the words from the notes themselves. The lead-directive is the constraint that matters most; everything else in this prompt sits underneath it.

Other guidance:
- Match the Victorian naturalist voice already in the field notes — precise, wondering, elegant. No modern idiom, no breathless ad-copy, no exclamation points.
- Do not begin with a bare number-word ("Three…", "Four…", "Seven…", "Twelve…"). If a count is essential to the line, let the count fall into it a beat after the lead — "Stalked eyes, three of them, rotating in independent survey" rather than "Three stalked eyes…".
- Do not begin with temporal phrasings ("Upon…", "When…", "Whilst…") or demonstratives ("The specimen…", "This creature…", "The creature…").
- The line must be self-contained: do not say "the specimen", "this creature", "the animal", or otherwise reference context that is not present in the line itself.
- Do NOT use rarity vocabulary in any form — no "rare", "common", "extraordinary", "uncommon", "the rarest", "first of its kind", percentile language, or comparative-frequency language. The catalogue's rarity treatment is handled separately and must not collide with the pull-quote.
- One sentence is fine; two short sentences are fine; never more than two.

Output ONLY the pull-quote line itself, with no quotation marks, no preamble, no trailing commentary, no markdown, no labels. Begin directly with the first word of the line.`
}

/**
 * Tier-change Gazette post prompt — text-only, single-shot. Fired by the worker
 * after `register_discovery` reports `tier_changed = true`, so the input
 * (binomial, old tier, new tier, new count) is always defined.
 *
 * Forward-direction tier crossings are the only ones currently emitted by
 * `register_discovery` (discovery_count is increment-only). The prompt is
 * written to handle both, plus a future regression case (common → notable
 * etc.) when account-deletion-driven tier regression lands as TD.
 *
 * The component renders the binomial as an inline italic underlined span by
 * searching the body for `species_name` verbatim — so the model is instructed
 * to spell the binomial exactly as given.
 */
export function buildTierChangeBodyPrompt(input: {
  binomial: string
  oldTier: 'extraordinary' | 'notable' | 'common'
  newTier: 'extraordinary' | 'notable' | 'common'
  newDiscoveryCount: number
}): string {
  const { binomial, oldTier, newTier, newDiscoveryCount } = input
  const tierLabel = { extraordinary: 'Extraordinary', notable: 'Notable', common: 'Common' } as const

  // Pick the Society's idiom by direction. Forward-direction (count went up)
  // is the only case currently emitted; reverse-direction is included for the
  // future regression code path.
  const tierOrder = { extraordinary: 0, notable: 1, common: 2 } as const
  const direction = tierOrder[newTier] > tierOrder[oldTier] ? 'descended' : 'ascended'
  const verb =
    direction === 'descended'
      ? newTier === 'common'
        ? 'lapsed into the Common'
        : 'settled into the Notable'
      : `elevated to the ${tierLabel[newTier]}`

  return `You are the Society's anonymous chronicler in QRious Specimens — a Victorian naturalist gazette of newly discovered fantastical creatures. A specimen has just moved from the ${tierLabel[oldTier]} tier to the ${tierLabel[newTier]} tier in the Society's census.

Specimen: ${binomial}
Discovery count (after this scan): ${newDiscoveryCount}

Write ONE short Gazette notice — exactly one sentence, two at most — announcing the change in the Society's voice. The notice will appear inline in the Field Dispatches feed under a "Society notice · ${tierLabel[newTier]}" eyebrow.

Hard constraints:
- The notice MUST contain the binomial exactly as written above: ${binomial}. Do not abbreviate (no "C. occidentalis"), do not pluralise, do not modify capitalisation. The frontend extracts the binomial from the body by string-matching this exact form.
- Use the Society's idiom for this transition: the specimen "has ${verb} tier". You may vary the surrounding clause, but the verb-phrase "${verb} tier" should appear in the line so the prose reads in-voice.
- Never speculate about WHY the tier changed (no "as the catalogue fills", "as more explorers discover", "with growing interest"). Treat the change as an observation, not a causal claim.
- The Society may reference the discovery count or the recent act of retrieval in the second clause if it suits the rhythm. Both are optional — the line works fine with just the binomial and the new tier.
- Victorian naturalist voice: measured, precise, quietly wondering. No modern idiom. No exclamation points. No breathless ad-copy.
- Strict ceiling: 240 characters, 40 words. Ideally between 100 and 180 characters.

Output ONLY the notice itself, with no quotation marks, no preamble, no markdown, no labels. Begin directly with the first word.`
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
- First paragraph opening: ${pickOpenerDirective(dna.seed)} Make the opening sentence specific to THIS specimen — let the directive shape the angle, but let the actual content come from what you see. Do not begin with a generic stock-Victorian flourish ("Upon...", "The creature presents...", "What I had first taken for..."); follow the directive instead.
- First paragraph body: after the opening, continue with first impressions — the immediate sense of the specimen, where it lay, what struck you about it.
- Second paragraph: closer observation — anatomical details that fascinate, behaviour noted, speculation about the creature's place in the natural order.
- Tone: intellectual curiosity and quiet awe. Never frightening, grotesque, or sensational. This is the joy of scientific discovery.
- Do NOT reference any real people, real places, real institutions, or real species by name.
- Do NOT reference any real books, authors, or literary works.
- Do NOT include anything violent, disturbing, political, religious, or contemporary.
- Keep it to exactly 2 paragraphs, each 2-4 sentences. Total length under 150 words.
- Write only the journal entry text. No titles, headers, dates, labels, or framing of any kind. Do NOT start with "# " or any markdown. Begin directly with the first sentence of the journal entry.`
}
