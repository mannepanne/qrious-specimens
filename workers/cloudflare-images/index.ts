// ABOUT: Cloudflare Images upload helper — replaces the R2 three-variant upload
// ABOUT: Uploads once; variants (original, 512, 256) are served on-the-fly by CF Images CDN

interface CloudflareImagesUploadResult {
  original: string
  url512: string
  url256: string
}

interface CloudflareImagesApiResponse {
  result: {
    id: string
    variants: string[]
  }
  success: boolean
  errors: { message: string }[]
}

/**
 * Upload an image to Cloudflare Images and return delivery URLs for three named variants.
 *
 * Requires three named variants to be set up in the Cloudflare Images dashboard:
 *   - "qriousoriginal" — full-size, no resize
 *   - "qrious512"      — width 512px
 *   - "qrious256"      — width 256px
 *
 * The account hash for delivery URLs is separate from the account ID used for uploads.
 * Find it in CF dashboard → Images → Overview, in the example delivery URL.
 */
export async function uploadToCloudflareImages(
  accountId: string,
  apiToken: string,
  deliveryHash: string,
  imageId: string,
  imageBytes: Uint8Array,
  mimeType: string,
): Promise<CloudflareImagesUploadResult> {
  const formData = new FormData()
  formData.append('file', new Blob([imageBytes.buffer as ArrayBuffer], { type: mimeType }), `${imageId}.jpg`)
  // Use the qrHash as the CF Images custom ID so uploads are idempotent per species
  formData.append('id', imageId)

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiToken}` },
      body: formData,
    },
  )

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`CF Images upload failed (${res.status}): ${body}`)
  }

  const data = (await res.json()) as CloudflareImagesApiResponse
  if (!data.success) {
    const msg = data.errors?.map((e) => e.message).join(', ') ?? 'Unknown error'
    throw new Error(`CF Images upload error: ${msg}`)
  }

  const base = `https://imagedelivery.net/${deliveryHash}/${data.result.id}`
  return {
    original: `${base}/qriousoriginal`,
    url512:   `${base}/qrious512`,
    url256:   `${base}/qrious256`,
  }
}
