// ABOUT: Gemini API client for Victorian naturalist illustration generation
// ABOUT: Multi-model fallback: image-specific models first, then flash models

export interface GeminiResult {
  imageBase64: string
  mimeType: string
}

export async function generateIllustration(
  prompt: string,
  apiKey: string,
): Promise<GeminiResult> {
  // List available models to find ones that support image generation
  const listRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
  )
  if (!listRes.ok) {
    throw new Error(`Gemini model list failed: ${listRes.status}`)
  }
  const listData = (await listRes.json()) as {
    models?: Array<{ name: string; supportedGenerationMethods?: string[] }>
  }

  const allModels = (listData.models ?? [])
    .filter(
      (m) =>
        m.supportedGenerationMethods?.includes('generateContent') &&
        (m.name.includes('image') || m.name.includes('flash')),
    )
    .map((m) => m.name.replace('models/', ''))

  // Prefer image-specific models; fall back to flash models
  const preferred = allModels.filter((n) => n.includes('image'))
  const fallbacks = allModels.filter((n) => !n.includes('image') && n.includes('flash'))
  const modelsToTry = [...preferred.slice(0, 3), ...fallbacks.slice(0, 2)]

  if (modelsToTry.length === 0) {
    throw new Error(`No image generation models available. Found: ${allModels.join(', ')}`)
  }

  const modelErrors: Record<string, string> = {}

  for (const model of modelsToTry) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generation_config: { response_modalities: ['IMAGE', 'TEXT'] },
      }),
    })

    if (!res.ok) {
      modelErrors[model] = (await res.text()).slice(0, 200)
      continue
    }

    const data = (await res.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ inlineData?: { mimeType: string; data: string } }> }
      }>
    }

    const parts = data.candidates?.[0]?.content?.parts ?? []
    const imagePart = parts.find((p) => p.inlineData)

    if (imagePart?.inlineData) {
      return {
        imageBase64: imagePart.inlineData.data,
        mimeType: imagePart.inlineData.mimeType || 'image/png',
      }
    }

    modelErrors[model] = 'No image part in response'
  }

  throw new Error(
    `All Gemini models failed. Tried: ${modelsToTry.join(', ')}. Errors: ${JSON.stringify(modelErrors)}`,
  )
}
