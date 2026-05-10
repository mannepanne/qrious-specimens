// ABOUT: Unit tests for the Claude Haiku client — focuses on generatePullQuote()
// ABOUT: response parsing (trim, strip stray quotes) and error propagation

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { generatePullQuote } from './claude'

describe('generatePullQuote', () => {
  let mockFetch: Mock

  beforeEach(() => {
    mockFetch = vi.fn()
    vi.stubGlobal('fetch', mockFetch)
  })

  it('returns a non-empty string for a typical Claude response', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ content: [{ type: 'text', text: 'A radial geometry of quiet certainty.' }] }),
        { status: 200 },
      ),
    )

    const result = await generatePullQuote('prompt here', 'fake-key')
    expect(result).toBe('A radial geometry of quiet certainty.')
  })

  it('trims surrounding whitespace and stray straight quote marks', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ content: [{ type: 'text', text: '  "A line distilled from the notes."  ' }] }),
        { status: 200 },
      ),
    )

    const result = await generatePullQuote('prompt', 'fake-key')
    expect(result).toBe('A line distilled from the notes.')
  })

  it('strips surrounding curly quote marks', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ content: [{ type: 'text', text: '“Its crest pulses in slow rhythm.”' }] }),
        { status: 200 },
      ),
    )

    const result = await generatePullQuote('prompt', 'fake-key')
    expect(result).toBe('Its crest pulses in slow rhythm.')
  })

  it('throws when the API returns a non-OK status, surfacing the status code to the caller', async () => {
    mockFetch.mockResolvedValueOnce(new Response('Service overloaded', { status: 529 }))

    await expect(generatePullQuote('prompt', 'fake-key')).rejects.toThrow(/529/)
  })

  it('throws when the response body has no text content', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ content: [] }), { status: 200 }),
    )

    await expect(generatePullQuote('prompt', 'fake-key')).rejects.toThrow(/empty/i)
  })

  it('propagates network errors thrown by fetch', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('fetch failed: ECONNREFUSED'))

    await expect(generatePullQuote('prompt', 'fake-key')).rejects.toThrow(/ECONNREFUSED/)
  })
})
