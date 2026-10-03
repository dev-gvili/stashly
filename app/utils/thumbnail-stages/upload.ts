/**
 * PUTs a stage's webp to S3 with a presigned URL.
 *
 * @param uploadUrl - The presigned PUT from `intent=presign`.
 * @param blob - The stage's webp.
 * @param itemId - For the log line only.
 * @param stage - For the log line only.
 * @returns Whether S3 accepted it. Never throws; the caller decides on a retry.
 *
 * @example
 * const ok = await putThumbnailToS3(presign.uploadUrl, resized.blob, itemId, 2)
 */
export async function putThumbnailToS3(
  uploadUrl: string,
  blob: Blob,
  itemId: string,
  stage: number
): Promise<boolean> {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    body: blob,
    // No `x-amz-acl` — the object stays private and is read through a signed
    // GET. Tigris applies that header even unsigned when a bucket allows
    // object ACLs, which would silently make the thumbnail world-readable.
    headers: { 'Content-Type': 'image/webp' },
  }).catch((err) => {
    console.error(`[stage ${stage} PUT] network error`, itemId, err)
    return null
  })
  if (!res || !res.ok) {
    console.error(`[stage ${stage} PUT] non-ok`, itemId, res?.status)
    return false
  }
  return true
}

/**
 * Picks the signed view URL for a stage out of the presign payload.
 *
 * Replaces the old `${publicUrl}?v=${stage}` concatenation: the server now
 * returns one signed URL per stage, with `v` signed *into* it. Appending a
 * param to a signed URL invalidates its signature and Tigris returns 403.
 *
 * @example
 * stageViewUrl(presign.viewUrls, 2) // → 'https://…/thumbnails/item_1.webp?v=2&X-Amz-…'
 */
export function stageViewUrl(
  viewUrls: Record<2 | 3, string>,
  stage: 2 | 3
): string {
  return viewUrls[stage]
}
