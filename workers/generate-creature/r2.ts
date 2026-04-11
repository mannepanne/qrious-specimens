// ABOUT: R2 upload helpers — stores original image and size variants
// ABOUT: TD-003: 512px and 256px variants store the original bytes; proper resizing deferred

/// <reference types="@cloudflare/workers-types" />

export interface R2Urls {
  original: string
  url512: string
  url256: string
}

/** Upload image to R2 at three paths and return their public URLs */
export async function uploadToR2(
  bucket: R2Bucket,
  publicBaseUrl: string,
  qrHash: string,
  imageBytes: Uint8Array,
  mimeType: string,
): Promise<R2Urls> {
  const ext = mimeType.includes('jpeg') || mimeType.includes('jpg') ? 'jpg' : 'png'

  const paths = {
    original: `species/original/${qrHash}.${ext}`,
    url512: `species/512/${qrHash}.${ext}`,
    url256: `species/256/${qrHash}.${ext}`,
  }

  // Upload all three variants (TD-003: 512 and 256 store original bytes;
  // proper pixel-level resizing is deferred — browsers CSS-constrain display size)
  await Promise.all([
    bucket.put(paths.original, imageBytes, { httpMetadata: { contentType: mimeType } }),
    bucket.put(paths.url512, imageBytes, { httpMetadata: { contentType: mimeType } }),
    bucket.put(paths.url256, imageBytes, { httpMetadata: { contentType: mimeType } }),
  ])

  const base = publicBaseUrl.replace(/\/$/, '')

  return {
    original: `${base}/${paths.original}`,
    url512: `${base}/${paths.url512}`,
    url256: `${base}/${paths.url256}`,
  }
}
