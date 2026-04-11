// ABOUT: Gemini API client for Victorian naturalist illustration generation
// ABOUT: Tries preferred model directly; falls back to model list only if preferred is unavailable

export interface GeminiResult {
  imageBase64: string
  mimeType: string
}

// Known stable model for image generation — avoid fetching the model list on every request
const PREFERRED_MODEL = 'gemini-2.0-flash-preview-image-generation'

async function callGenerateContent(
  model: string,
  prompt: string,
  apiKey: string,
): Promise<Response> {
  return fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generation_config: { response_modalities: ['IMAGE', 'TEXT'] },
      }),
    },
  )
}

function extractImagePart(data: unknown): GeminiResult | null {
  const typed = data as {
    candidates?: Array<{
      content?: { parts?: Array<{ inlineData?: { mimeType: string; data: string } }> }
    }>
  }
  const parts = typed.candidates?.[0]?.content?.parts ?? []
  const imagePart = parts.find((p) => p.inlineData)
  if (!imagePart?.inlineData) return null
  return {
    imageBase64: imagePart.inlineData.data,
    mimeType: imagePart.inlineData.mimeType || 'image/png',
  }
}

export async function generateIllustration(
  prompt: string,
  apiKey: string,
): Promise<GeminiResult> {
  // Happy path: try preferred model directly — avoids a round-trip to the model list API
  const preferredRes = await callGenerateContent(PREFERRED_MODEL, prompt, apiKey)
  if (preferredRes.ok) {
    const data = await preferredRes.json()
    const result = extractImagePart(data)
    if (result) return result
  }

  const preferredError = preferredRes.ok
    ? 'No image part in response'
    : `${preferredRes.status}: ${(await preferredRes.text()).slice(0, 200)}`

  // Preferred model failed — fetch the model list to discover available alternatives
  const listRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
  )
  if (!listRes.ok) {
    throw new Error(`Gemini model list failed: ${listRes.status}`)
  }
  const listData = (await listRes.json()) as {
    models?: Array<{ name: string; supportedGenerationMethods?: string[] }>
  }

  const fallbackModels = (listData.models ?? [])
    .filter(
      (m) =>
        m.supportedGenerationMethods?.includes('generateContent') &&
        (m.name.includes('image') || m.name.includes('flash')),
    )
    .map((m) => m.name.replace('models/', ''))
    .filter((m) => m !== PREFERRED_MODEL) // already tried

  // Prefer image-specific models; accept flash as last resort
  const preferred = fallbackModels.filter((n) => n.includes('image'))
  const flashes = fallbackModels.filter((n) => !n.includes('image') && n.includes('flash'))
  const modelsToTry = [...preferred.slice(0, 3), ...flashes.slice(0, 2)]

  const modelErrors: Record<string, string> = { [PREFERRED_MODEL]: preferredError }

  for (const model of modelsToTry) {
    const res = await callGenerateContent(model, prompt, apiKey)
    if (!res.ok) {
      modelErrors[model] = `${res.status}: ${(await res.text()).slice(0, 200)}`
      continue
    }
    const data = await res.json()
    const result = extractImagePart(data)
    if (result) return result
    modelErrors[model] = 'No image part in response'
  }

  throw new Error(
    `All Gemini models failed. Tried: ${[PREFERRED_MODEL, ...modelsToTry].join(', ')}. Errors: ${JSON.stringify(modelErrors)}`,
  )
}
