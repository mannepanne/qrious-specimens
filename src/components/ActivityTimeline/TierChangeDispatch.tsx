// ABOUT: Tier-change dispatch — Society notice when a species crosses Extraordinary/Notable/Common boundary
// ABOUT: Renders worker-generated tier_change_body, with a hand-written fallback when the body is null

import type { FeedEntry } from '@/hooks/useCommunity'
import { timeOfDay } from '@/lib/feedDate'
import type { Rarity } from '@/lib/rarity'

interface Props {
  entry: FeedEntry
  onViewSpecies?: (qrHash: string) => void
}

const TIER_ACCENT: Record<Rarity, string> = {
  extraordinary: 'text-violet-700/80',
  notable:       'text-sky-700/80',
  common:        'text-stone-600/80',
}

const TIER_LABEL: Record<Rarity, string> = {
  extraordinary: 'Extraordinary',
  notable:       'Notable',
  common:        'Common',
}

/**
 * Hand-written fallback used when the Anthropic call failed and tier_change_body
 * is NULL. Uses only the binomial and the new tier — no discovery_count, no old
 * tier (we don't have either on the row). The Society's idiom is taken from the
 * spec examples ("elevated", "settled into", "lapsed into").
 */
function fallbackBody(species: string, newTier: Rarity): string {
  switch (newTier) {
    case 'extraordinary':
      return `${species} has been elevated to the Extraordinary tier.`
    case 'notable':
      return `${species} has settled into the Notable tier.`
    case 'common':
      return `${species} has lapsed into the Common tier.`
  }
}

/**
 * Render the prose with the binomial pulled out as an italic styled span. We
 * cannot trust the worker to wrap the binomial in markup, so we look for the
 * first occurrence of the species name in the body and split around it.
 * If the body does not contain the binomial verbatim, we render the whole
 * string italic — visually still right, just no inline link styling.
 */
function renderBodyWithBinomial(body: string, species: string | null): React.ReactNode {
  if (!species) return body
  const idx = body.indexOf(species)
  if (idx === -1) return body
  return (
    <>
      {body.slice(0, idx)}
      <span className="italic underline decoration-dotted underline-offset-2">{species}</span>
      {body.slice(idx + species.length)}
    </>
  )
}

function asRarity(value: string | null): Rarity {
  if (value === 'extraordinary' || value === 'notable' || value === 'common') return value
  return 'notable'
}

export function TierChangeDispatch({ entry, onViewSpecies }: Props) {
  const newTier = asRarity(entry.rarity)
  const species = entry.species_name
  const body = entry.tier_change_body ?? fallbackBody(species ?? 'This species', newTier)
  const isClickable = !!entry.qr_hash && !!onViewSpecies
  const date = new Date(entry.created_at)

  const article = (
    <article className="flex items-start gap-3 py-3 px-1">
      <span aria-hidden="true" className={['shrink-0 mt-1 text-lg', TIER_ACCENT[newTier]].join(' ')}>
        ✽
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-0.5">
          Society notice · {TIER_LABEL[newTier]}
        </p>
        <p className="font-serif text-[15px] italic leading-snug text-foreground/85">
          {renderBodyWithBinomial(body, species)}
        </p>
        <p className="font-mono text-[10px] text-muted-foreground mt-1.5">
          — the Society · {timeOfDay(date)}
        </p>
      </div>
    </article>
  )

  if (isClickable) {
    return (
      <button
        type="button"
        onClick={() => onViewSpecies!(entry.qr_hash!)}
        aria-label={`View ${species ?? 'species'} in catalogue`}
        className="block w-full text-left transition-colors hover:bg-accent/20 rounded-sm px-1"
      >
        {article}
      </button>
    )
  }

  return article
}
