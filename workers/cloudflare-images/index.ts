// ABOUT: Cloudflare Images upload helper — one POST, three named variants served by the CDN
// ABOUT: Idempotent via the custom image ID; duplicate-ID collisions resolve to success

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
  errors: { code?: number; message: string }[]
}

/** CF Images returns this error code when uploading with a custom ID that already exists. */
const DUPLICATE_ID_ERROR_CODE = 5409

/**
 * Returns true if a CF Images response indicates the upload failed because the custom
 * image ID already exists. Idempotency via `qr_hash` depends on this being treated as success.
 *
 * Primary check: stable numeric error code. Fallback: HTTP 409 status. Final fallback:
 * message string match (for forward-compat with CF wording changes).
 */
export function isDuplicateIdError(
  status: number,
  errors: { code?: number; message: string }[] | undefined,
): boolean {
  if (status === 409) return true
  if (!errors?.length) return false
  return errors.some(
    (e) => e.code === DUPLICATE_ID_ERROR_CODE || /already exists/i.test(e.message),
  )
}

/** Build the three delivery URLs for a given image ID. Same shape for fresh and pre-existing uploads. */
export function buildDeliveryUrls(deliveryHash: string, imageId: string): CloudflareImagesUploadResult {
  const base = `https://imagedelivery.net/${deliveryHash}/${imageId}`
  return {
    original: `${base}/qriousoriginal`,
    url512: `${base}/qrious512`,
    url256: `${base}/qrious256`,
  }
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
 *
 * Idempotency: `imageId` is used as the CF Images custom ID. A duplicate-ID collision
 * (e.g. concurrent scan of the same qr_hash) returns the predictable delivery URLs
 * rather than throwing — the bytes already live at the target ID. See ADR 2026-04-20.
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
  const ext = mimeType.includes('png') ? 'png' : 'jpg'
  formData.append('file', new Blob([imageBytes.buffer as ArrayBuffer], { type: mimeType }), `${imageId}.${ext}`)
  formData.append('id', imageId)

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiToken}` },
      body: formData,
    },
  )

  // Happy path
  if (res.ok) {
    const data = (await res.json()) as CloudflareImagesApiResponse
    if (data.success) {
      return buildDeliveryUrls(deliveryHash, data.result.id)
    }
    // 2xx but success=false (rare — CF returns non-2xx for real failures)
    if (isDuplicateIdError(res.status, data.errors)) {
      return buildDeliveryUrls(deliveryHash, imageId)
    }
    const msg = data.errors?.map((e) => e.message).join(', ') ?? 'Unknown error'
    throw new Error(`CF Images upload error: ${msg}`)
  }

  // Non-2xx — parse JSON to distinguish duplicate-ID (treat as success) from real errors
  const body = await res.text()
  let parsed: CloudflareImagesApiResponse | null = null
  try {
    parsed = JSON.parse(body) as CloudflareImagesApiResponse
  } catch {
    // Not JSON (e.g. HTML 5xx from the edge) — fall through to throw
  }
  if (isDuplicateIdError(res.status, parsed?.errors)) {
    return buildDeliveryUrls(deliveryHash, imageId)
  }
  throw new Error(`CF Images upload failed (${res.status}): ${body}`)
}
