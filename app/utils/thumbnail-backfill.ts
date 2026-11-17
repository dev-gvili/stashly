/**
 * Pure predicates for on-the-fly thumbnail backfill.
 *
 * A backfill costs a full download of the original file, so the decision to
 * attempt one is made here — before any network work — from data the card
 * already has in hand. Kept free of React and DOM so it can be unit-tested.
 */
import { isTextRenderableFile } from '@/utils/text-thumbnail'

/**
 * Largest original we will download to build a thumbnail client-side.
 * Mirrors the server's cap in `thumbnail-actions.ts`; both must agree or the
 * client wastes a round trip discovering the server said no.
 */
export const BACKFILL_MAX_BYTES = 16 * 1024 * 1024

/**
 * How much of a video over {@link BACKFILL_MAX_BYTES} a thumbnail download
 * reads: its first 3 MiB. A frame decodes from the head of a Matroska/WebM or
 * a fast-start MP4 (measured 16 Nov: 31 of 31 real MKVs, 30 byte-identical to
 * the whole-file frame). Same size as the metadata backfill's head.
 */
export const THUMBNAIL_HEAD_BYTES = 3 * 1024 * 1024

/** How a thumbnail job reads the original: all of it, or a ranged head. */
export type ThumbnailSourceRange = { ranged: false } | { ranged: true; bytes: number }

/**
 * What to download for a thumbnail, or null when the file is refused: empty,
 * or over the cap and not a video (an image or PDF needs every byte).
 * The server calls this too, so client and server cannot disagree.
 *
 * @example
 * thumbnailSourceRange({ size: 40_000_000, mimeType: 'video/x-matroska' })
 * // → { ranged: true, bytes: 3145728 }
 */
export function thumbnailSourceRange(item: {
  size: number
  mimeType?: string | null
}): ThumbnailSourceRange | null {
  if (!(item.size > 0)) return null
  if (item.size <= BACKFILL_MAX_BYTES) return { ranged: false }
  if ((item.mimeType ?? '').startsWith('video/'))
    return { ranged: true, bytes: THUMBNAIL_HEAD_BYTES }
  return null
}

export interface BackfillCandidate {
  type: 'file' | 'folder' | 'collection' | string
  name: string
  size: number
  mimeType?: string | null
  /** Non-placeholder thumbnail URLs already on the item. */
  thumbnailUrls?: (string | null | undefined)[]
}

/** True when a URL is a real thumbnail rather than a legacy hex placeholder. */
export function isRealThumbnailUrl(url: string | null | undefined): url is string {
  return typeof url === 'string' && url.length > 0 && !url.startsWith('#')
}

/**
 * True when the client pipeline has a stage-2 producer for this file type.
 * Mirrors the branches in `generateStage2Resize` — images, video, PDF, and
 * anything text-renderable. Everything else (audio, archives, binaries) has
 * no producer, so attempting a backfill would only burn bandwidth.
 */
export function hasThumbnailProducer(
  file: { name: string; mimeType?: string | null }
): boolean {
  const type = file.mimeType ?? ''
  if (type.startsWith('image/')) return true
  if (type.startsWith('video/')) return true
  if (type === 'application/pdf') return true
  return isTextRenderableFile({ name: file.name, type })
}

/**
 * Whether an item is worth a backfill attempt: a stored file, no real
 * thumbnail yet, a type we can render, and small enough to be worth fetching (a video over
 * the cap is read by its head only).
 *
 * @example
 * canBackfillThumbnail({ type: 'file', name: 'db.ts', size: 1600, mimeType: 'text/plain' })
 * // → true
 */
export function canBackfillThumbnail(item: BackfillCandidate): boolean {
  if (item.type !== 'file') return false
  if (item.thumbnailUrls?.some(isRealThumbnailUrl)) return false
  if (!thumbnailSourceRange(item)) return false
  return hasThumbnailProducer(item)
}

/**
 * Whether an item is worth a thumbnail job from its uploaded file, still in
 * memory: a file, no real thumbnail yet, and a type we can render. No size cap
 * and no connection check — nothing is downloaded.
 *
 * @example
 * canThumbnailFromMemory({ type: 'file', name: 'big.png', size: 40_000_000, mimeType: 'image/png' })
 * // → true (a download job would refuse it at 16 MB)
 */
export function canThumbnailFromMemory(item: BackfillCandidate): boolean {
  if (item.type !== 'file') return false
  if (item.thumbnailUrls?.some(isRealThumbnailUrl)) return false
  return hasThumbnailProducer(item)
}

/**
 * True when the connection is too constrained to spend on cosmetic downloads.
 * Data Saver, or any 2g-class effective type, opts the whole feature out.
 */
export function isConnectionTooSlow(
  connection?: { saveData?: boolean; effectiveType?: string } | null
): boolean {
  if (!connection) return false
  if (connection.saveData) return true
  return connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g'
}
