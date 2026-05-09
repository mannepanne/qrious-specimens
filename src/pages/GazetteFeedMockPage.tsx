// ABOUT: Visual mock of the proposed Gazette feed treatment (Direction A + B, v3)
// ABOUT: Hardcoded sample data above the fold; live pre-flight section reads field_notes from the catalogue RPC. Route: /gazette-mock

import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AppHeader } from '@/components/AppHeader/AppHeader'
import { supabase } from '@/lib/supabase'
import type { CatalogueEntry } from '@/hooks/useCatalogue'

type EventType = 'discovery' | 'first_discovery' | 'badge_earned' | 'census'

interface MockEntry {
  id: string
  event_type: EventType
  display_name?: string
  species_name?: string
  species_image?: string
  /** Claude-generated evocative pull-quote — used on every dispatch. */
  pull_quote?: string
  /**
   * Rarity label for ordinary discoveries: "Top 4%", "Top 24%", or "Provisional"
   * when the catalogue is too small for a meaningful percentile.
   * First-discoveries do not carry a rarity tag (the "First sighting" stamp
   * already conveys novelty).
   */
  rarity_label?: string
  badge_icon?: string
  badge_name?: string
  badge_tier?: 'bronze' | 'silver' | 'gold'
  /** Body of a weekly census notice — Claude-generated; binomials wrapped in *asterisks*. */
  census_body?: string
  /** Display label for the census, e.g. "week ending 3 May 2026". */
  census_period?: string
  /**
   * Mapping of binomial → qr_hash for species mentioned in the census body.
   * Stored alongside the body at generation time so links survive species
   * renames / deletions. Unmatched binomials fall back to plain italic.
   */
  census_links?: Record<string, string>
  iso_date: string
}

// ── Sample data ────────────────────────────────────────────────────────────
// Every dispatch carries a pull-quote (Claude-generated alongside field notes
// in production). The featured slot is decided per-day at render time:
// most-recent first_discovery, falling back to most-recent ordinary discovery.

const MOCK: MockEntry[] = [
  // Today — 4th of May
  {
    id: '1',
    event_type: 'first_discovery',
    display_name: 'Lyra of Holloway',
    species_name: 'Aurelia somnifera',
    species_image: '/mock/specimen-1.jpg',
    pull_quote:
      'Its crest pulses in slow, deliberate rhythm — as though dreaming the world into being, a small lantern carried softly through the hollow of a stone.',
    iso_date: '2026-05-04T18:42:00Z',
  },
  {
    id: '2',
    event_type: 'first_discovery',
    display_name: 'Wren Ashby',
    species_name: 'Pteromys lacrimosus',
    species_image: '/mock/specimen-2.jpg',
    pull_quote:
      'A ridge of sensory bristles along the dorsal line, and eyes the colour of spilled ink — a creature that would rather be heard than seen.',
    iso_date: '2026-05-04T15:10:00Z',
  },
  {
    id: '3',
    event_type: 'discovery',
    display_name: 'Manne',
    species_name: 'Folium susurrans',
    species_image: '/mock/specimen-3.jpg',
    pull_quote:
      'Seemingly fashioned from autumn leaves and forgotten wishes, its hum is described — by those near enough to hear it — as melancholic.',
    rarity_label: 'Provisional',
    iso_date: '2026-05-04T11:23:00Z',
  },
  {
    id: '4',
    event_type: 'badge_earned',
    display_name: 'Wren Ashby',
    badge_icon: '🔬',
    badge_name: 'Keen Observer',
    badge_tier: 'silver',
    iso_date: '2026-05-04T09:55:00Z',
  },
  {
    id: '5',
    event_type: 'first_discovery',
    display_name: 'Manne',
    species_name: 'Cilia tenebrosa',
    species_image: '/mock/specimen-5.jpg',
    pull_quote:
      'It glides upon thermals at the dawn hour and returns, without fail, to the same lichen-clad perch by sundown — as if keeping a private appointment.',
    iso_date: '2026-05-04T07:30:00Z',
  },

  // Yesterday — 3rd of May (Sunday — the weekly Census Notice posts at end of day)
  {
    id: 'census-1',
    event_type: 'census',
    iso_date: '2026-05-03T21:00:00Z',
    census_period: 'week ending 3 May 2026',
    census_body:
      'Forty-seven new specimens were entered into the catalogue this week. *Manticora rubicunda*, once held to be among our great rarities, has now been observed by twenty-three correspondents and recedes to the company of the merely uncommon. The Society notes with interest the first appearance of *Lithops fortiana*, of which only a single specimen is yet known.',
    census_links: {
      'Manticora rubicunda': 'mock-manticora-rubicunda',
      'Lithops fortiana':    'mock-lithops-fortiana',
    },
  },
  {
    id: '6',
    event_type: 'first_discovery',
    display_name: 'Hattie Pemberton',
    species_name: 'Mandibula lyriformis',
    species_image: '/mock/specimen-4.jpg',
    pull_quote:
      'A creature of grave music — its mandibles tuned, it seems, to some lyre we cannot hear, struck with a delicacy that belies a carnivorous disposition.',
    iso_date: '2026-05-03T19:30:00Z',
  },
  {
    id: '7',
    event_type: 'first_discovery',
    display_name: 'Aldous Finch',
    species_name: 'Vermes radiantis',
    species_image: '/mock/specimen-6.jpg',
    pull_quote:
      'Its integument fluoresces beneath moonlight, a circumstance that serves both the patient naturalist and the predatory bat in equal measure.',
    iso_date: '2026-05-03T14:02:00Z',
  },
  {
    id: '8',
    event_type: 'discovery',
    display_name: 'Bea Coverdale',
    species_name: 'Concha occidentalis',
    species_image: '/mock/specimen-8.jpg',
    pull_quote:
      'A pleasing iridescence to the carapace, much in the manner of a midsummer beetle, found content upon the chimney stack through inclement weather.',
    rarity_label: 'Top 24%',
    iso_date: '2026-05-03T08:48:00Z',
  },
  {
    id: '9',
    event_type: 'badge_earned',
    display_name: 'Aldous Finch',
    badge_icon: '⭐',
    badge_name: 'Pioneer',
    badge_tier: 'silver',
    iso_date: '2026-05-03T08:50:00Z',
  },

  // 2nd of May — no first_discoveries; the featured slot falls back to the
  // most recent ordinary discovery of the day.
  {
    id: '10',
    event_type: 'discovery',
    display_name: 'Manne',
    species_name: 'Larva nocturnalis',
    species_image: '/mock/specimen-7.jpg',
    pull_quote:
      'Recorded in hand by lantern’s light: it retracts at the slightest disturbance, then unfolds with a curiosity quite its own — proboscis twice the length of body.',
    rarity_label: 'Top 4%',
    iso_date: '2026-05-02T22:15:00Z',
  },
  {
    id: '11',
    event_type: 'discovery',
    display_name: 'Cyril Marchwood',
    species_name: 'Concha occidentalis',
    species_image: '/mock/specimen-8.jpg',
    pull_quote:
      'A second specimen, smaller than the first, scuttling with surprising celerity along the garden wall — the carapace identically aflame with iridescence.',
    rarity_label: 'Top 24%',
    iso_date: '2026-05-02T16:40:00Z',
  },
]

// ── Helpers ────────────────────────────────────────────────────────────────

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0])
}

function dateline(iso: string): string {
  const d = new Date(iso)
  const today = new Date('2026-05-04T12:00:00Z')
  const diffDays = Math.floor((today.getTime() - d.getTime()) / 86_400_000)
  const long = `On the ${ordinal(d.getUTCDate())} of ${MONTHS[d.getUTCMonth()]}`
  if (diffDays === 0) return `Today, ${long.toLowerCase()}`
  if (diffDays === 1) return `Yesterday, ${long.toLowerCase()}`
  return long
}

function timeOfDay(iso: string): string {
  const d = new Date(iso)
  const h = d.getUTCHours()
  if (h < 5)  return 'before dawn'
  if (h < 9)  return 'at first light'
  if (h < 12) return 'in the morning'
  if (h < 15) return 'at midday'
  if (h < 18) return 'in the afternoon'
  if (h < 21) return 'at twilight'
  return 'after dark'
}

function groupByDay(entries: MockEntry[]): Array<{ key: string; entries: MockEntry[] }> {
  const groups = new Map<string, MockEntry[]>()
  for (const e of entries) {
    const k = e.iso_date.slice(0, 10)
    const arr = groups.get(k) ?? []
    arr.push(e)
    groups.set(k, arr)
  }
  return Array.from(groups.entries()).map(([key, entries]) => ({ key, entries }))
}

/**
 * Dispatch-of-the-day rule: per dateline group, pick exactly one entry to feature.
 * Most recent first_discovery wins; fall back to most recent ordinary discovery.
 * Badge_earned and census entries never qualify.
 */
function pickFeaturedId(entries: MockEntry[]): string | null {
  const firsts = entries.filter(e => e.event_type === 'first_discovery')
  if (firsts.length > 0) return firsts[0].id  // entries are already DESC by date
  const discoveries = entries.filter(e => e.event_type === 'discovery')
  if (discoveries.length > 0) return discoveries[0].id
  return null
}

/**
 * Inline-italicise *binomials* in census prose. If `links` provides a qr_hash
 * for the binomial, it becomes a Link to the species page (with origin: 'gazette'
 * so the back-link returns here); unmatched binomials render as plain italic.
 */
function renderCensusBody(text: string, links?: Record<string, string>): ReactNode[] {
  return text.split(/\*([^*]+)\*/g).map((part, i) => {
    if (i % 2 === 0) return <span key={i}>{part}</span>
    const target = links?.[part]
    const italic = <em className="italic">{part}</em>
    if (!target) return <span key={i}>{italic}</span>
    return (
      <Link
        key={i}
        to={`/species/${target}`}
        state={{ origin: 'gazette' }}
        className="underline decoration-muted-foreground/40 underline-offset-4 hover:decoration-foreground transition-colors"
      >
        {italic}
      </Link>
    )
  })
}

// ── Sub-components ─────────────────────────────────────────────────────────

const BADGE_TIER_RING: Record<NonNullable<MockEntry['badge_tier']>, string> = {
  bronze: 'ring-amber-700/30 bg-amber-50/40',
  silver: 'ring-slate-400/40  bg-slate-50/40',
  gold:   'ring-amber-500/40  bg-amber-50/60',
}

function Fleuron({ glyph = '✽' }: { glyph?: string }) {
  return (
    <div aria-hidden="true" className="flex items-center gap-3 text-muted-foreground/40 my-5">
      <span className="flex-1 h-px bg-border" />
      <span className="text-base leading-none">{glyph}</span>
      <span className="flex-1 h-px bg-border" />
    </div>
  )
}

function DatelineHeader({ iso }: { iso: string }) {
  return (
    <div className="flex items-center gap-3 mt-3 mb-4">
      <span className="flex-1 h-px bg-border" />
      <h3 className="font-serif italic text-sm text-muted-foreground tracking-wide">
        {dateline(iso)}
      </h3>
      <span className="flex-1 h-px bg-border" />
    </div>
  )
}

/**
 * Featured dispatch — horizontal layout, image takes ~45% on one side.
 * `mirrored` flips image to the left for visual rhythm across the feed.
 */
function FeaturedDispatch({ entry, mirrored }: { entry: MockEntry; mirrored: boolean }) {
  const imageBlock = entry.species_image && (
    <div className="sm:w-[45%] shrink-0 bg-accent/20 sm:border-x-0 border-y sm:border-y-0 border-border">
      <img
        src={entry.species_image}
        alt={`Illustration of ${entry.species_name}`}
        className="w-full h-48 sm:h-full object-contain"
        loading="lazy"
      />
    </div>
  )

  const textBlock = (
    <div className="flex-1 px-5 py-4 sm:py-5 flex flex-col gap-3 min-w-0">
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Dispatch of the day
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {timeOfDay(entry.iso_date)}
        </span>
      </div>

      <div>
        <h2 className="font-serif italic text-lg leading-tight">
          {entry.species_name}
        </h2>
        {entry.rarity_label && (
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground mt-1">
            {entry.rarity_label}
          </p>
        )}
      </div>

      {entry.pull_quote && (
        <blockquote className="font-serif text-[15px] italic leading-relaxed text-foreground/90 border-l-2 border-border pl-3">
          &ldquo;{entry.pull_quote}&rdquo;
        </blockquote>
      )}

      <div className="flex items-center justify-between mt-auto pt-1">
        <span className="font-mono text-[11px] text-muted-foreground">
          — recorded by{' '}
          <span className="font-medium text-foreground/80">{entry.display_name}</span>
        </span>
        <span aria-hidden="true" className="text-base text-muted-foreground/40">✽</span>
      </div>
    </div>
  )

  return (
    <article
      className={[
        'bg-card border border-border rounded-sm overflow-hidden',
        'flex flex-col sm:flex-row',
        mirrored ? 'sm:flex-row-reverse' : '',
      ].join(' ')}
    >
      {imageBlock}
      {textBlock}
    </article>
  )
}

/**
 * Compact dispatch — bigger thumb, italic pull-quote, signature line.
 * The whole card is the click target → species page (with origin: 'gazette').
 */
function CompactDispatch({ entry }: { entry: MockEntry }) {
  const isFirst = entry.event_type === 'first_discovery'

  return (
    <article className="flex gap-4 py-3.5">
      {entry.species_image && (
        <img
          src={entry.species_image}
          alt=""
          aria-hidden="true"
          className="w-20 h-20 shrink-0 rounded-sm object-contain bg-accent/20"
          loading="lazy"
        />
      )}

      <div className="flex-1 min-w-0">
        {isFirst && (
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-amber-700/80 mb-0.5 flex items-center gap-1">
            <span aria-hidden="true">⭐</span>
            <span>First sighting</span>
          </p>
        )}

        <p className="font-serif text-[15px] leading-snug">
          <span className="italic">{entry.species_name}</span>
        </p>

        {entry.pull_quote && (
          <p className="font-serif text-sm italic text-foreground/70 leading-snug mt-1 line-clamp-3">
            &ldquo;{entry.pull_quote}&rdquo;
          </p>
        )}

        <p className="font-mono text-[10px] text-muted-foreground mt-1.5">
          — {entry.display_name} · {timeOfDay(entry.iso_date)}
          {entry.rarity_label && (
            <>
              {' · '}
              <span className="uppercase tracking-[0.14em]">{entry.rarity_label}</span>
            </>
          )}
        </p>
      </div>
    </article>
  )
}

/**
 * Census dispatch — weekly notice from the rarity recalculation.
 * No image, framed top and bottom, body in serif italics with binomial markup.
 */
function CensusDispatch({ entry }: { entry: MockEntry }) {
  return (
    <article className="bg-card border border-border rounded-sm overflow-hidden">
      <div className="px-5 py-6 sm:px-6 sm:py-7 text-center space-y-4">
        <div aria-hidden="true" className="flex items-center gap-3 text-muted-foreground/40">
          <span className="flex-1 h-px bg-border" />
          <span className="text-sm leading-none">✽</span>
          <span className="flex-1 h-px bg-border" />
        </div>

        <div>
          <h3 className="font-serif text-base">Census Notice</h3>
          {entry.census_period && (
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground mt-1">
              {entry.census_period}
            </p>
          )}
        </div>

        {entry.census_body && (
          <p className="font-serif text-[15px] italic leading-relaxed text-foreground/85 text-left max-w-md mx-auto">
            {renderCensusBody(entry.census_body, entry.census_links)}
          </p>
        )}

        <div aria-hidden="true" className="flex items-center gap-3 text-muted-foreground/40">
          <span className="flex-1 h-px bg-border" />
          <span className="text-sm leading-none">✽</span>
          <span className="flex-1 h-px bg-border" />
        </div>
      </div>
    </article>
  )
}

/** Badge entry — real emoji icon, tier-tinted ring, smallcaps prose. */
function BadgeDispatch({ entry }: { entry: MockEntry }) {
  const tierRing = entry.badge_tier ? BADGE_TIER_RING[entry.badge_tier] : 'ring-border bg-card'
  return (
    <article className="flex items-center gap-3 py-3 px-1">
      <span
        aria-hidden="true"
        className={[
          'shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-xl',
          'ring-1', tierRing,
        ].join(' ')}
      >
        {entry.badge_icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-serif text-sm leading-snug">
          <span className="font-medium">{entry.display_name}</span>
          <span className="text-muted-foreground"> was awarded </span>
          <span className="italic">{entry.badge_name}</span>
        </p>
        {entry.badge_tier && (
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground mt-0.5">
            {entry.badge_tier} tier
          </p>
        )}
      </div>
    </article>
  )
}

// ── Pre-flight evidence test ───────────────────────────────────────────────
// Reads existing field_notes from the live catalogue and renders the first
// sentence of each in Field Dispatch pull-quote styling. Lets us judge whether
// the spec's null-fallback (first sentence of field_notes) is already good
// enough — in which case the entire pull-quote backend can be dropped.

function extractFirstSentence(notes: string): string {
  const cleaned = notes.replace(/^#+\s+.*\n+/gm, '').trim()
  const match = cleaned.match(/^[^.!?]+[.!?]/)
  let sentence = (match ? match[0] : cleaned).trim()
  if (sentence.length > 200) {
    const truncated = sentence.slice(0, 200)
    const lastSpace = truncated.lastIndexOf(' ')
    sentence = (lastSpace > 100 ? truncated.slice(0, lastSpace) : truncated) + '…'
  }
  return sentence
}

function FieldNotesPreflight() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['gazette-mock-preflight-field-notes'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_catalogue', {
        p_search: null,
        p_order_filter: null,
        p_habitat_filter: null,
        p_symmetry_filter: null,
        p_body_shape_filter: null,
        p_limb_style_filter: null,
        p_pattern_type_filter: null,
        p_rarity_filter: null,
        p_limit: 200,
        p_offset: 0,
      })
      if (error) throw error
      return (data ?? []) as unknown as CatalogueEntry[]
    },
    staleTime: 5 * 60 * 1000,
  })

  const entries = (data ?? []).filter(e => e.field_notes && e.field_notes.trim().length > 0)

  return (
    <section className="mt-12 pt-8 border-t border-border">
      <header className="mb-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">
          Pre-flight evidence test
        </p>
        <h2 className="font-serif text-lg leading-snug mb-2">
          Would the first sentence of field notes be enough?
        </h2>
        <p className="font-serif italic text-sm text-muted-foreground leading-relaxed">
          For each existing specimen below, the first sentence of its field notes is rendered
          in the styling of a Field Dispatch pull-quote. Read through and judge:
          {' '}≥ 80% lovely → drop the pull-quote backend entirely;
          {' '}≤ 30% lovely → build it as specced;
          {' '}mixed → try a smarter sentence picker before paying for a generated asset.
        </p>
      </header>

      {isLoading && (
        <p className="font-serif italic text-sm text-muted-foreground">Loading specimens…</p>
      )}
      {error && (
        <p className="font-serif italic text-sm text-destructive">
          Could not load specimens: {(error as Error).message}
        </p>
      )}

      {!isLoading && !error && (
        <>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-5">
            {entries.length} specimens with field notes
          </p>
          <ol className="space-y-6 list-none p-0">
            {entries.map((e, idx) => (
              <li key={e.qr_hash} className="border-l-2 border-border/60 pl-4">
                <p className="font-serif italic text-base leading-relaxed text-foreground/90">
                  {extractFirstSentence(e.field_notes!)}
                </p>
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground mt-1.5">
                  {String(idx + 1).padStart(2, '0')} · {e.genus} {e.species}
                </p>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

export function GazetteFeedMockPage() {
  const groups = groupByDay(MOCK)
  let featuredCount = 0  // tracks across the whole feed for alternation

  return (
    <main className="flex flex-col h-full">
      <AppHeader eyebrow="Field Dispatches · Mock" title="The Explorer's Gazette" />

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 pt-4 pb-12 max-w-2xl mx-auto">
          <p className="font-serif italic text-sm text-muted-foreground text-center mb-4">
            Mock-up of the proposed feed treatment, with rarity stamps and a weekly Census Notice. Sample data only · v3.
          </p>

          <section>
            {groups.map((group, gi) => {
              const featuredId = pickFeaturedId(group.entries)

              return (
                <div key={group.key}>
                  <DatelineHeader iso={group.entries[0].iso_date} />

                  {group.entries.map((entry, i) => {
                    const isFeatured = entry.id === featuredId
                    const isCensus = entry.event_type === 'census'

                    const prev = group.entries[i - 1]
                    const showSeparator =
                      i > 0 &&
                      !isFeatured &&
                      !isCensus &&
                      prev?.id !== featuredId &&
                      prev?.event_type !== 'census'

                    if (isCensus) {
                      return (
                        <div key={entry.id} className="my-3">
                          <CensusDispatch entry={entry} />
                        </div>
                      )
                    }

                    if (isFeatured) {
                      const mirrored = featuredCount % 2 === 1
                      featuredCount += 1
                      return (
                        <div key={entry.id}>
                          {i > 0 && prev?.event_type !== 'census' && <Fleuron />}
                          <FeaturedDispatch entry={entry} mirrored={mirrored} />
                          {i < group.entries.length - 1 && <Fleuron />}
                        </div>
                      )
                    }

                    if (entry.event_type === 'badge_earned') {
                      return (
                        <div key={entry.id}>
                          {showSeparator && <div className="border-t border-border/60" />}
                          <BadgeDispatch entry={entry} />
                        </div>
                      )
                    }

                    return (
                      <div key={entry.id}>
                        {showSeparator && <div className="border-t border-border/60" />}
                        <CompactDispatch entry={entry} />
                      </div>
                    )
                  })}

                  {gi < groups.length - 1 && <div className="h-3" />}
                </div>
              )
            })}
          </section>

          <FieldNotesPreflight />
        </div>
      </div>
    </main>
  )
}
