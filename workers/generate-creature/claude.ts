// ABOUT: Claude Haiku API client for Victorian naturalist field notes, pull-quotes, and tier-change notices
// ABOUT: Multimodal field-notes call + text-only pull-quote and tier-change follow-ups

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-haiku-4-5-20251001'

export async function generateFieldNotes(
  prompt: string,
  apiKey: string,
  imageBase64: string,
  imageMimeType: string,
): Promise<string> {
  const validMimeType = imageMimeType as 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp'

  const res = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: validMimeType,
                data: imageBase64,
              },
            },
            { type: 'text', text: prompt },
          ],
        },
      ],
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Claude API failed (${res.status}): ${body.slice(0, 300)}`)
  }

  const data = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>
  }

  const text = data.content?.find((c) => c.type === 'text')?.text ?? ''
  if (!text) throw new Error('Empty response from Claude')

  // Strip any markdown headers the model might add despite instructions
  return text.replace(/^#+\s+.*\n+/gm, '').trim()
}

/**
 * Text-only pull-quote follow-up — takes the field notes already produced and
 * returns one evocative self-contained line for the Gazette feed. Failure
 * surfaces to the caller (workers/generate-creature/index.ts) which writes
 * pull_quote = null and continues; discovery never blocks on this step.
 */
export async function generatePullQuote(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 80,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Claude pull-quote call failed (${res.status}): ${body.slice(0, 300)}`)
  }

  const data = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>
  }

  const text = data.content?.find((c) => c.type === 'text')?.text ?? ''
  if (!text) throw new Error('Empty pull-quote response from Claude')

  // Strip markdown, surrounding straight or curly quotes, and stray whitespace.
  // The model occasionally wraps its line in quotes despite instructions.
  return text
    .replace(/^#+\s+.*\n+/gm, '')
    .trim()
    .replace(/^["“'‘](.*)["”'’]$/s, '$1')
    .trim()
}

/**
 * Text-only tier-change notice follow-up — produces the Society's Gazette line
 * announcing that a specimen has crossed a rarity-tier boundary. Same soft-fail
 * contract as `generatePullQuote`: failure surfaces to the caller, which writes
 * tier_change_body = NULL and lets `TierChangeDispatch` render a hand-written
 * fallback.
 */
export async function generateTierChangeBody(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 120,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Claude tier-change call failed (${res.status}): ${body.slice(0, 300)}`)
  }

  const data = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>
  }

  const text = data.content?.find((c) => c.type === 'text')?.text ?? ''
  if (!text) throw new Error('Empty tier-change response from Claude')

  // Same cleanup as pull-quote — strip stray markdown, leading/trailing quotes.
  return text
    .replace(/^#+\s+.*\n+/gm, '')
    .trim()
    .replace(/^["“'‘](.*)["”'’]$/s, '$1')
    .trim()
}
