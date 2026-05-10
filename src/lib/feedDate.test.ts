// ABOUT: Tests for feedDate helpers (dateline copy, UTC-day grouping, field-notes excerpt)

import { describe, it, expect } from 'vitest'
import { dateline, groupByDay, excerptFromFieldNotes, timeOfDay } from './feedDate'

describe('dateline', () => {
  const now = new Date('2026-05-10T12:00:00Z')

  it('renders "Today" for the same UTC day', () => {
    expect(dateline(new Date('2026-05-10T00:01:00Z'), now)).toBe('Today, on the 10th of May')
    expect(dateline(new Date('2026-05-10T23:59:00Z'), now)).toBe('Today, on the 10th of May')
  })

  it('renders "Yesterday" for the previous UTC day', () => {
    expect(dateline(new Date('2026-05-09T15:00:00Z'), now)).toBe('Yesterday, on the 9th of May')
  })

  it('renders "On" for older dates', () => {
    expect(dateline(new Date('2026-05-01T10:00:00Z'), now)).toBe('On the 1st of May')
    expect(dateline(new Date('2026-04-15T10:00:00Z'), now)).toBe('On the 15th of April')
  })

  it('uses the correct ordinal suffix', () => {
    const ref = new Date('2026-05-31T00:00:00Z')
    expect(dateline(new Date('2026-05-01T00:00:00Z'), ref)).toBe('On the 1st of May')
    expect(dateline(new Date('2026-05-02T00:00:00Z'), ref)).toBe('On the 2nd of May')
    expect(dateline(new Date('2026-05-03T00:00:00Z'), ref)).toBe('On the 3rd of May')
    expect(dateline(new Date('2026-05-04T00:00:00Z'), ref)).toBe('On the 4th of May')
    expect(dateline(new Date('2026-05-11T00:00:00Z'), ref)).toBe('On the 11th of May')
    expect(dateline(new Date('2026-05-12T00:00:00Z'), ref)).toBe('On the 12th of May')
    expect(dateline(new Date('2026-05-13T00:00:00Z'), ref)).toBe('On the 13th of May')
    expect(dateline(new Date('2026-05-21T00:00:00Z'), ref)).toBe('On the 21st of May')
    expect(dateline(new Date('2026-05-22T00:00:00Z'), ref)).toBe('On the 22nd of May')
    expect(dateline(new Date('2026-05-23T00:00:00Z'), ref)).toBe('On the 23rd of May')
  })

  it('renders all 12 month names in full', () => {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ]
    months.forEach((name, i) => {
      const d = new Date(Date.UTC(2026, i, 5))
      expect(dateline(d, new Date(Date.UTC(2026, i, 28)))).toBe(`On the 5th of ${name}`)
    })
  })

  it('groups by UTC day, not local time (DST boundary safe)', () => {
    // 23:30 UTC is still "today" regardless of viewer's local timezone.
    const now = new Date('2026-03-29T01:00:00Z') // start of CET DST in 2026
    expect(dateline(new Date('2026-03-29T23:30:00Z'), now)).toBe('Today, on the 29th of March')
    expect(dateline(new Date('2026-03-28T23:30:00Z'), now)).toBe('Yesterday, on the 28th of March')
  })
})

describe('groupByDay', () => {
  it('returns empty array for empty input', () => {
    expect(groupByDay([])).toEqual([])
  })

  it('groups entries sharing a UTC day into one bucket', () => {
    const entries = [
      { id: 'a', created_at: '2026-05-10T08:00:00Z' },
      { id: 'b', created_at: '2026-05-10T22:00:00Z' },
    ]
    const buckets = groupByDay(entries)
    expect(buckets).toHaveLength(1)
    expect(buckets[0].dateKey).toBe('2026-05-10')
    expect(buckets[0].entries.map(e => e.id)).toEqual(['a', 'b'])
  })

  it('produces one bucket per UTC day in input order', () => {
    const entries = [
      { id: 'a', created_at: '2026-05-10T12:00:00Z' },
      { id: 'b', created_at: '2026-05-09T12:00:00Z' },
      { id: 'c', created_at: '2026-05-10T08:00:00Z' },
      { id: 'd', created_at: '2026-05-08T12:00:00Z' },
    ]
    const buckets = groupByDay(entries)
    expect(buckets.map(b => b.dateKey)).toEqual(['2026-05-10', '2026-05-09', '2026-05-08'])
    expect(buckets[0].entries.map(e => e.id)).toEqual(['a', 'c'])
    expect(buckets[1].entries.map(e => e.id)).toEqual(['b'])
    expect(buckets[2].entries.map(e => e.id)).toEqual(['d'])
  })

  it('groups by UTC day even when entries straddle a local-day boundary', () => {
    // CET on 29 March 2026: clocks jump from 02:00 to 03:00. A timestamp at
    // 23:30 UTC is "00:30 CEST the next day" — but UTC grouping doesn't care.
    const entries = [
      { id: 'a', created_at: '2026-03-28T23:30:00Z' },
      { id: 'b', created_at: '2026-03-28T12:00:00Z' },
      { id: 'c', created_at: '2026-03-29T01:00:00Z' },
    ]
    const buckets = groupByDay(entries)
    expect(buckets).toHaveLength(2)
    expect(buckets[0].dateKey).toBe('2026-03-28')
    expect(buckets[0].entries.map(e => e.id)).toEqual(['a', 'b'])
    expect(buckets[1].dateKey).toBe('2026-03-29')
    expect(buckets[1].entries.map(e => e.id)).toEqual(['c'])
  })
})

describe('timeOfDay', () => {
  it.each([
    ['2026-05-10T02:00:00Z', 'before dawn'],
    ['2026-05-10T07:30:00Z', 'at first light'],
    ['2026-05-10T10:00:00Z', 'in the morning'],
    ['2026-05-10T13:00:00Z', 'at midday'],
    ['2026-05-10T16:00:00Z', 'in the afternoon'],
    ['2026-05-10T19:00:00Z', 'at twilight'],
    ['2026-05-10T22:30:00Z', 'after dark'],
  ])('%s → %s', (iso, expected) => {
    expect(timeOfDay(new Date(iso))).toBe(expected)
  })
})

describe('excerptFromFieldNotes', () => {
  it('returns empty string for null/empty input', () => {
    expect(excerptFromFieldNotes(null)).toBe('')
    expect(excerptFromFieldNotes(undefined)).toBe('')
    expect(excerptFromFieldNotes('')).toBe('')
    expect(excerptFromFieldNotes('   \n  ')).toBe('')
  })

  it('returns the first sentence when shorter than the cap', () => {
    const notes = 'A peculiar specimen, retrieved from the marshes. Its plumage shifted in the lantern light.'
    expect(excerptFromFieldNotes(notes)).toBe('A peculiar specimen, retrieved from the marshes.')
  })

  it('handles question and exclamation marks as sentence terminators', () => {
    expect(excerptFromFieldNotes('Could it really fly? The notes are inconclusive.'))
      .toBe('Could it really fly?')
    expect(excerptFromFieldNotes('Astonishing! It darted into the reeds before I could draw it.'))
      .toBe('Astonishing!')
  })

  it('returns the full notes when no sentence terminator and shorter than cap', () => {
    const notes = 'A short note with no terminator'
    expect(excerptFromFieldNotes(notes)).toBe('A short note with no terminator')
  })

  it('truncates at a word boundary with an ellipsis when the first sentence exceeds the cap', () => {
    const long =
      'The creature was extraordinary in every aspect of its bearing, from the shimmering ' +
      'iridescence of its dorsal scales through to the curious whorled musculature of its ' +
      'lower flanks, which I could not in good conscience render fully in graphite alone, ' +
      'and so I have resolved to return tomorrow with the watercolour kit.'
    const result = excerptFromFieldNotes(long)
    expect(result.endsWith('…')).toBe(true)
    expect(result.length).toBeLessThanOrEqual(201) // cap + ellipsis
    expect(result).not.toMatch(/\s…$/) // ellipsis is glued to a complete word, not preceded by whitespace
    expect(long.startsWith(result.replace(/…$/, ''))).toBe(true)
  })

  it('collapses internal whitespace before slicing', () => {
    const notes = 'A   short\n\nnote.'
    expect(excerptFromFieldNotes(notes)).toBe('A short note.')
  })
})
