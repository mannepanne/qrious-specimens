// ABOUT: Claude Haiku API client for Victorian naturalist field notes
// ABOUT: Multimodal — sends generated illustration as base64 for grounded prose

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
