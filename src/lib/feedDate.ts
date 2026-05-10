// ABOUT: Date helpers for the Field Dispatches Gazette feed
// ABOUT: Provides UTC-day grouping, dateline copy, and the field-notes excerpt fallback for null pull-quotes

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const

/** English ordinal suffix: 1st, 2nd, 3rd, 4th, …, 11th, 12th, 13th, …, 21st, 22nd, 23rd, … */
function ordinalSuffix(n: number): string {
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 13) return 'th'
  switch (n % 10) {
    case 1:  return 'st'
    case 2:  return 'nd'
    case 3:  return 'rd'
    default: return 'th'
  }
}

/** UTC-day key (`YYYY-MM-DD`) for grouping entries deterministically. */
function utcDayKey(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Render the dateline copy for a given UTC day, relative to `now`.
 *
 * - Today  → "Today, on the Nth of <month>"
 * - Yesterday → "Yesterday, on the Nth of <month>"
 * - Older  → "On the Nth of <month>"
 *
 * Year is suppressed (revisit if/when feed depth crosses year boundaries).
 */
export function dateline(date: Date, now: Date = new Date()): string {
  const dayKey   = utcDayKey(date)
  const todayKey = utcDayKey(now)

  const yesterday = new Date(now)
  yesterday.setUTCDate(yesterday.getUTCDate() - 1)
  const yesterdayKey = utcDayKey(yesterday)

  const dayOfMonth = date.getUTCDate()
  const month      = MONTH_NAMES[date.getUTCMonth()]
  const tail       = `the ${dayOfMonth}${ordinalSuffix(dayOfMonth)} of ${month}`

  if (dayKey === todayKey)     return `Today, on ${tail}`
  if (dayKey === yesterdayKey) return `Yesterday, on ${tail}`
  return `On ${tail}`
}

/**
 * Group feed entries by their `created_at` UTC day, preserving the order
 * within each group as it appears in the input. Returns one bucket per day,
 * in the order each day's first entry appears.
 */
export function groupByDay<T extends { created_at: string }>(
  entries: T[],
): Array<{ dateKey: string; entries: T[] }> {
  const buckets: Array<{ dateKey: string; entries: T[] }> = []
  const index = new Map<string, number>()

  for (const entry of entries) {
    const key = utcDayKey(new Date(entry.created_at))
    let bucketIndex = index.get(key)
    if (bucketIndex === undefined) {
      bucketIndex = buckets.length
      buckets.push({ dateKey: key, entries: [] })
      index.set(key, bucketIndex)
    }
    buckets[bucketIndex].entries.push(entry)
  }

  return buckets
}

/**
 * Render an evocative time-of-day phrase for a dispatch's signature line.
 * UTC-based for determinism — same phrase shown to every viewer regardless
 * of their local timezone.
 */
export function timeOfDay(date: Date): string {
  const h = date.getUTCHours()
  if (h < 5)  return 'before dawn'
  if (h < 9)  return 'at first light'
  if (h < 12) return 'in the morning'
  if (h < 15) return 'at midday'
  if (h < 18) return 'in the afternoon'
  if (h < 21) return 'at twilight'
  return 'after dark'
}

const EXCERPT_CAP = 200

/**
 * Render-time fallback when `pull_quote` is null: take the first sentence of
 * the field notes; if it exceeds the cap, truncate at a word boundary and
 * append a horizontal ellipsis. Whitespace is normalised; an empty input
 * returns an empty string (caller can branch on that if needed).
 */
export function excerptFromFieldNotes(fieldNotes: string | null | undefined): string {
  if (!fieldNotes) return ''

  const collapsed = fieldNotes.replace(/\s+/g, ' ').trim()
  if (!collapsed) return ''

  const sentenceMatch = collapsed.match(/^[^.!?]*[.!?]/)
  const firstSentence = sentenceMatch ? sentenceMatch[0].trim() : collapsed

  if (firstSentence.length <= EXCERPT_CAP) return firstSentence

  const slice = collapsed.slice(0, EXCERPT_CAP)
  const lastSpace = slice.lastIndexOf(' ')
  const cut = lastSpace > 0 ? slice.slice(0, lastSpace) : slice
  return `${cut.replace(/[.,;:!?]+$/, '')}…`
}
