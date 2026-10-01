/**
 * What the orphan sweep (scripts/sweep-s3-orphans.ts) does with one stored
 * object. Pure, so the rules are testable without S3 or a database.
 *
 * - `referenced` — a `File` row points at the key, or it is the thumbnail of an
 *   item that still exists. Kept.
 * - `too-young` — unreferenced, but newer than the age floor. Kept: an upload
 *   puts its bytes in S3 *before* the `Item`/`File` rows exist, so a fresh
 *   object with no row is usually an upload in flight, not an orphan.
 * - `orphan-file` / `orphan-thumbnail` — unreferenced and older than the floor.
 *   Deleted by `--apply`.
 */
export type ObjectVerdict = 'referenced' | 'too-young' | 'orphan-file' | 'orphan-thumbnail'

export interface StoredObject {
  key: string
  lastModified: Date
}

export interface References {
  /** Every `File.key` in the bucket. */
  fileKeys: ReadonlySet<string>
  /** Ids of items that still exist, for `thumbnails/{itemId}.webp` keys. */
  liveItemIds: ReadonlySet<string>
}

const THUMBNAIL_KEY = /^thumbnails\/(.+)\.webp$/

/** The item id a thumbnail key belongs to, or null for any other key. */
export function thumbnailItemId(key: string): string | null {
  return THUMBNAIL_KEY.exec(key)?.[1] ?? null
}

export function classifyObject(
  object: StoredObject,
  refs: References,
  now: Date,
  minAgeMs: number
): ObjectVerdict {
  const itemId = thumbnailItemId(object.key)
  const referenced = itemId ? refs.liveItemIds.has(itemId) : refs.fileKeys.has(object.key)
  if (referenced) return 'referenced'
  if (now.getTime() - object.lastModified.getTime() < minAgeMs) return 'too-young'
  return itemId ? 'orphan-thumbnail' : 'orphan-file'
}
