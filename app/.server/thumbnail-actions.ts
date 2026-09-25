import { prisma } from '@/services/db'
import { getPrefixForModel, toObjectId } from '@/utils/converters'
import { hasItemPermission } from '@/services/permission-actions'
import { getPresignedUrl } from '@/services/s3'
import { StashlyError, StashlyErrorCode, toRouteError } from '@/utils/api.errors'

// ====================================================== //
// ================= Thumbnail locators ================= //
// ====================================================== //

/** Thumbnail stages that are persisted (stage 1 never leaves the browser). */
export type ThumbnailStage = 2 | 3

/** Where a stored thumbnail lives. Parsed from `Thumbnail.url`. */
export interface ThumbnailLocation {
  bucket: string
  key: string
  itemId: string
  stage: ThumbnailStage
}

/** Signed URLs are stable for this long, so re-renders hit the browser cache. */
const THUMBNAIL_SIGNING_WINDOW_MS = 60 * 60 * 1000
/**
 * Validity counted from the *rounded* signing date. It is twice the window, so
 * a URL rendered at the very end of a window still has at least an hour left.
 */
const THUMBNAIL_URL_EXPIRES_IN_S = 2 * 60 * 60
/** Browser cache lifetime. No longer than the minimum remaining validity. */
const THUMBNAIL_CACHE_CONTROL = 'private, max-age=3600'

const LOCATOR_PREFIX = 's3://'
const LEGACY_PUBLIC_HOST_SUFFIX = '.t3.tigrisfiles.io'
// S3 bucket naming rules: 3–63 chars, lowercase letters, digits, dots, hyphens.
const BUCKET_RE = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/
// `toObjectId` output: `<prefix>_<base64url>`.
const ITEM_ID_RE = /^[a-z]+_[A-Za-z0-9_-]+$/
// The only key shape a thumbnail may have. Anything else is refused.
const THUMBNAIL_KEY_RE = /^thumbnails\/([a-z]+_[A-Za-z0-9_-]+)\.webp$/

/**
 * Builds the value stored in `Thumbnail.url` for a persisted stage.
 *
 * This is a **locator, not a URL**: nothing can load it directly, so a read
 * path that forgets to sign it shows a broken image instead of a working
 * public link. Only the server builds it. Accepting a locator from the client
 * would let a caller have the server sign a read of any object in any bucket —
 * the credentials behind `getPresignedUrl` can read every user's bucket.
 *
 * @param bucket - Bucket the thumbnail was uploaded to.
 * @param itemId - Item the thumbnail belongs to.
 * @param stage - 2 (resize) or 3 (salient crop).
 *
 * @throws {StashlyError} `INVALID_INPUT` if the bucket or item id is malformed.
 *
 * @example
 * thumbnailLocator('stashly-jane-a1b2c3d4', 'itm_abc', 2)
 * // → 's3://stashly-jane-a1b2c3d4/thumbnails/itm_abc.webp?v=2'
 */
export function thumbnailLocator(
  bucket: string,
  itemId: string,
  stage: ThumbnailStage
): string {
  if (!BUCKET_RE.test(bucket) || !ITEM_ID_RE.test(itemId)) {
    throw new StashlyError(
      StashlyErrorCode.INVALID_INPUT,
      'Invalid thumbnail bucket or item id'
    )
  }
  return `${LOCATOR_PREFIX}${bucket}/thumbnails/${itemId}.webp?v=${stage}`
}

/**
 * Parses a stored `Thumbnail.url` into its bucket, key, item and stage.
 *
 * Accepts two forms:
 * - `s3://{bucket}/thumbnails/{itemId}.webp?v={stage}` — written from now on.
 * - `https://{bucket}.t3.tigrisfiles.io/thumbnails/{itemId}.webp?v={stage}` —
 *   the legacy public URL, so existing rows keep working with no migration.
 *
 * Returns `null` for anything else, including stage-0 `#hex` placeholders, keys
 * outside `thumbnails/<itemId>.webp`, and path tricks. When `expectedItemId` is
 * given, a locator for a *different* item is refused too, so one item's row
 * can't be used to sign another item's thumbnail.
 *
 * @example
 * parseThumbnailLocator('s3://stashly-jane-a1b2c3d4/thumbnails/itm_abc.webp?v=3')
 * // → { bucket: 'stashly-jane-a1b2c3d4', key: 'thumbnails/itm_abc.webp', itemId: 'itm_abc', stage: 3 }
 *
 * @example
 * parseThumbnailLocator('s3://other-bucket/private/tax.pdf') // → null
 */
export function parseThumbnailLocator(
  stored: string | null | undefined,
  expectedItemId?: string
): ThumbnailLocation | null {
  if (!stored || stored.startsWith('#')) return null

  let bucket: string
  let path: string
  let search: URLSearchParams

  if (stored.startsWith(LOCATOR_PREFIX)) {
    const rest = stored.slice(LOCATOR_PREFIX.length)
    const [pathPart, queryPart = ''] = rest.split('?', 2)
    const slash = pathPart.indexOf('/')
    if (slash <= 0) return null
    bucket = pathPart.slice(0, slash)
    path = pathPart.slice(slash + 1)
    search = new URLSearchParams(queryPart)
  } else {
    let url: URL
    try {
      url = new URL(stored)
    } catch {
      return null
    }
    if (url.protocol !== 'https:') return null
    if (!url.hostname.endsWith(LEGACY_PUBLIC_HOST_SUFFIX)) return null
    bucket = url.hostname.slice(0, -LEGACY_PUBLIC_HOST_SUFFIX.length)
    // `URL` has already resolved `..` segments; the key regex rejects the rest.
    path = url.pathname.slice(1)
    search = url.searchParams
  }

  if (!BUCKET_RE.test(bucket)) return null

  const keyMatch = THUMBNAIL_KEY_RE.exec(path)
  if (!keyMatch) return null
  const itemId = keyMatch[1]
  if (expectedItemId !== undefined && itemId !== expectedItemId) return null

  const v = search.get('v')
  const stage = v === '2' ? 2 : v === '3' ? 3 : null
  if (stage === null) return null

  return { bucket, key: path, itemId, stage }
}

/**
 * Rounds `now` down to the start of the current signing window, so every URL
 * signed within the window shares one `X-Amz-Date` and is byte-identical.
 */
function thumbnailSigningDate(now = Date.now()): Date {
  return new Date(
    Math.floor(now / THUMBNAIL_SIGNING_WINDOW_MS) * THUMBNAIL_SIGNING_WINDOW_MS
  )
}

/**
 * Signs one location into a short-lived GET URL the browser can load.
 *
 * The stage rides along in the signed `response-content-disposition`, so
 * stages 2 and 3 produce different URLs even though they overwrite the same
 * key. That does the job the old `?v={stage}` suffix did — which can't be used
 * on a signed URL, since a param outside the signature 403s.
 *
 * @example
 * const src = await signThumbnailLocation(location)
 */
export async function signThumbnailLocation(
  location: ThumbnailLocation
): Promise<string> {
  const signingDate = thumbnailSigningDate()
  const window = signingDate.getTime()
  if (window !== signedWindow) {
    signed.clear()
    signedWindow = window
  }

  const cacheKey = `${location.bucket}\0${location.key}\0${location.itemId}\0${location.stage}`
  const hit = signed.get(cacheKey)
  if (hit) return hit

  const url = await getPresignedUrl(
    location.bucket,
    'get',
    location.key,
    THUMBNAIL_URL_EXPIRES_IN_S,
    {
      responseContentDisposition: `inline; filename="${location.itemId}-s${location.stage}.webp"`,
      signingDate,
      responseCacheControl: THUMBNAIL_CACHE_CONTROL,
    }
  )
  if (signed.size >= SIGNED_CACHE_MAX) signed.clear()
  signed.set(cacheKey, url)
  return url
}

/**
 * Signed thumbnail URLs for the current window.
 *
 * Every input to the URL is fixed within a window — the signing date is
 * rounded to it — so a location signs to the same bytes every time, and
 * re-signing it is pure waste. That waste is what forced the first signed-
 * thumbnail release to be reverted: each finished upload revalidated the open
 * loaders, each loader re-signed every thumbnail on the page, and the signing
 * held Node's event loop long enough to starve the Postgres driver. With this
 * cache a location is signed once per window per server process; every
 * revalidation after that is a Map lookup.
 *
 * Cleared on window rollover (the old URLs still work until they expire, but
 * new renders should move to the new window's URL), and when it reaches
 * `SIGNED_CACHE_MAX` — a crude bound, but entries are ~600 bytes, so the cap
 * is ~30 MB at most.
 */
const signed = new Map<string, string>()
let signedWindow = 0
const SIGNED_CACHE_MAX = 50_000

/**
 * Turns a stored `Thumbnail.url` into a URL the browser can load.
 *
 * - `null` / `undefined` → `null`
 * - `#hex` stage-0 placeholder → returned unchanged, since every consumer
 *   already filters those and expects to keep seeing them
 * - a valid locator (either form) → a signed GET URL
 * - anything else → `null`, with a warning
 *
 * **Authorization is the caller's job.** Call this only on rows a loader or
 * action has already scoped to what the viewer is allowed to see.
 *
 * @param stored - The raw `Thumbnail.url` value.
 * @param expectedItemId - Item the row belongs to, when the caller knows it.
 *
 * @example
 * const thumbnailUrl = await signThumbnailUrl(row.thumbnailUrl, row.id)
 */
export async function signThumbnailUrl(
  stored: string | null | undefined,
  expectedItemId?: string
): Promise<string | null> {
  if (stored == null) return null
  if (stored.startsWith('#')) return stored

  const location = parseThumbnailLocator(stored, expectedItemId)
  if (!location) {
    console.warn('[thumbnails] refusing to sign unrecognised url', {
      expectedItemId,
      stored: stored.slice(0, 120),
    })
    return null
  }
  return signThumbnailLocation(location)
}

/**
 * Signs every `thumbnails[].url` in a query result, at any depth, and returns
 * a copy with the same shape. Wrap a query result with it on the way out:
 *
 * Item payloads nest — a row carries `parent`, `children`, `copies`, and each
 * of those can carry its own thumbnails. Signing each nesting level by hand at
 * every read site is how one gets missed, so this walks the result instead.
 * The **nearest enclosing object's `id`** is used as the expected item id, so a
 * thumbnail row pointing at a different item is dropped rather than signed.
 *
 * Only plain objects and arrays are traversed. `Date`, `Buffer`, `Decimal` and
 * other class instances are passed through untouched, so a selected
 * `Thumbnail.content` blob survives.
 *
 * **Authorization is still the caller's job** — this signs what it is given.
 *
 * @example
 * const items = await signThumbnails(
 *   await prisma.item.findMany({
 *     select: { id: true, thumbnails: { select: { url: true } } },
 *   })
 * )
 *
 * @example
 * // Works on a single row, or any wrapper around rows
 * return signThumbnails({ items, nextCursor })
 */
export async function signThumbnails<T>(input: T): Promise<T> {
  return (await signWalk(input, undefined)) as T
}

/** Recursive worker for {@link signThumbnails}. */
async function signWalk(
  node: unknown,
  ownerId: string | undefined
): Promise<unknown> {
  if (Array.isArray(node)) {
    return Promise.all(node.map((entry) => signWalk(entry, ownerId)))
  }
  if (node === null || typeof node !== 'object') return node
  // Only plain objects are rebuilt. Anything with a custom prototype (Date,
  // Buffer, Prisma's Decimal) would lose its identity by being spread.
  const proto = Object.getPrototypeOf(node)
  if (proto !== Object.prototype && proto !== null) return node

  const obj = node as Record<string, unknown>
  const itemId = typeof obj.id === 'string' ? obj.id : ownerId
  const out: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(obj)) {
    if (key === 'thumbnails' && Array.isArray(value)) {
      out[key] = await Promise.all(
        value.map(async (thumb) => {
          if (!thumb || typeof thumb !== 'object' || !('url' in thumb)) {
            return thumb
          }
          const url = (thumb as { url?: string | null }).url
          return { ...thumb, url: await signThumbnailUrl(url, itemId) }
        })
      )
      continue
    }
    out[key] = await signWalk(value, itemId)
  }
  return out
}

/**
 * Presign payload for the thumbnail upload: the PUT target plus signed view
 * URLs for both persisted stages, so the client can paint each stage right
 * after its PUT without another round trip.
 *
 * The PUT carries no ACL — the object stays private and is only ever read
 * through `signThumbnailUrl`.
 *
 * @param bucket - Bucket to upload into (the uploader's own bucket).
 * @param itemId - Item the thumbnail belongs to.
 *
 * @example
 * return data(await presignThumbnailUpload(session.user.bucket, itemId))
 */
export async function presignThumbnailUpload(
  bucket: string,
  itemId: string
): Promise<{ uploadUrl: string; viewUrls: Record<ThumbnailStage, string> }> {
  // Round-trips through the parser so the key and bucket checks run on the
  // write path too, not only on reads.
  const stage2 = parseThumbnailLocator(thumbnailLocator(bucket, itemId, 2))
  if (!stage2) {
    throw new StashlyError(
      StashlyErrorCode.INVALID_INPUT,
      'Invalid thumbnail bucket or item id'
    )
  }

  const [uploadUrl, view2, view3] = await Promise.all([
    getPresignedUrl(bucket, 'put', stage2.key, 300),
    signThumbnailLocation(stage2),
    signThumbnailLocation({ ...stage2, stage: 3 }),
  ])
  return { uploadUrl, viewUrls: { 2: view2, 3: view3 } }
}

export async function createThumbnail(
  itemId: string,
  hexColor: string,
  view: string = 'grid',
  size: string = 'medium'
) {
  // First, validate that the item exists
  const item = await prisma.item.findUnique({
    where: { id: itemId },
    select: { id: true }
  })
  if (!item) {
    throw new Error(`Item with id ${itemId} not found`)
  }

  const existing = await prisma.thumbnail.findFirst({
    where: { itemId, view: view as any, size: size as any },
  })
  if (existing) return existing

  try {
    return await prisma.thumbnail.create({
      data: {
        id: toObjectId(getPrefixForModel('Thumbnail')),
        itemId,
        view: view as any,
        size: size as any,
        stage: 0,
        url: hexColor,
      },
    })
  } catch (e: unknown) {
    // P2002 = unique constraint violation (lost race) — return the winner's record
    if ((e as { code?: string })?.code === 'P2002') {
      return prisma.thumbnail.findFirstOrThrow({
        where: { itemId, view: view as any, size: size as any },
      })
    }
    throw e
  }
}

/**
 * Records a finished thumbnail stage and returns a signed URL for it.
 *
 * The stored value is **derived here**, never taken from the request: the
 * caller supplies the bucket it uploaded to, and this builds the locator. A
 * client-supplied value would be a read primitive — the server signs whatever
 * is stored, and its credentials reach every user's bucket.
 *
 * Requires read access to the item. Read, not write, because backfill lets a
 * viewer of a shared item generate the thumbnail that was never produced at
 * upload time.
 *
 * @param userId - Viewer recording the thumbnail.
 * @param itemId - Item the thumbnail belongs to.
 * @param bucket - Bucket the object was PUT into (the uploader's own bucket).
 * @param stage - 2 (resize) or 3 (salient crop).
 * @param width - Rendered width in pixels.
 * @param height - Rendered height in pixels.
 * @param view - Thumbnail variant, defaults to `'grid'`.
 * @param size - Thumbnail size bucket, defaults to `'medium'`.
 *
 * @throws {StashlyError} `FORBIDDEN` when the viewer can't read the item.
 *
 * @returns The signed URL to paint, echoed back to the client.
 *
 * @example
 * const url = await updateThumbnail(session.user.id, itemId, session.user.bucket, 2, 512, 384)
 */
export async function updateThumbnail(
  userId: string,
  itemId: string,
  bucket: string,
  stage: ThumbnailStage,
  width?: number,
  height?: number,
  view: string = 'grid',
  size: string = 'medium'
): Promise<string> {
  const canRead = await hasItemPermission(userId, itemId, 'read')
  if (!canRead) {
    throw toRouteError(
      StashlyErrorCode.FORBIDDEN,
      'You do not have access to this item'
    )
  }

  const url = thumbnailLocator(bucket, itemId, stage)
  await persistThumbnailStage(itemId, stage, url, width, height, view, size)
  return signThumbnailLocation({
    bucket,
    key: `thumbnails/${itemId}.webp`,
    itemId,
    stage,
  })
}

/** Upserts the `Thumbnail` row for one (item, view, size) at a given stage. */
async function persistThumbnailStage(
  itemId: string,
  stage: number,
  url: string,
  width?: number,
  height?: number,
  view: string = 'grid',
  size: string = 'medium'
) {
  const result = await prisma.thumbnail.updateMany({
    where: { itemId, view: view as any, size: size as any },
    data: { stage, url, width, height },
  })
  if (result.count > 0) return result

  // No row yet (stage 0 was removed from the pipeline) — insert the first stage.
  try {
    await prisma.thumbnail.create({
      data: {
        id: toObjectId(getPrefixForModel('Thumbnail')),
        itemId,
        view: view as any,
        size: size as any,
        stage,
        url,
        width,
        height,
      },
    })
  } catch (e: unknown) {
    // P2002 = a concurrent PATCH for the same (itemId,view,size) won the race.
    // Retry update — the winner's row now exists.
    if ((e as { code?: string })?.code === 'P2002') {
      return prisma.thumbnail.updateMany({
        where: { itemId, view: view as any, size: size as any },
        data: { stage, url, width, height },
      })
    }
    throw e
  }
  return result
}

/**
 * Result of asking the server for the bytes needed to build a missing thumbnail.
 *
 * `exists` short-circuits the client: another tab (or an earlier visit) already
 * backfilled this item, so the caller should paint that URL instead of
 * downloading the original all over again.
 */
export type ThumbnailSource =
  | {
      status: 'ready'
      downloadUrl: string
      mimeType: string | null
      name: string
      size: number
    }
  | { status: 'exists'; url: string; stage: ThumbnailStage }
  | { status: 'unsupported' }

/** Largest original we are willing to hand back for on-the-fly thumbnailing. */
export const BACKFILL_MAX_BYTES = 16 * 1024 * 1024

/**
 * Presigns a short-lived GET for an item's original file so the client can
 * generate a thumbnail for an item that never got one (a failed or skipped
 * upload-time run).
 *
 * Guards, in order: read permission → item is a file with storage → no real
 * thumbnail already → size is under {@link BACKFILL_MAX_BYTES}. The size cap
 * lives here and not only on the client so a stale tab can't talk the server
 * into presigning a 4 GB video.
 *
 * @param userId - Viewer requesting the backfill.
 * @param itemId - Item whose thumbnail is missing.
 *
 * @example
 * const source = await getThumbnailSource(session.user.id, 'itm_123')
 * if (source.status === 'ready') await fetch(source.downloadUrl)
 */
export async function getThumbnailSource(
  userId: string,
  itemId: string
): Promise<ThumbnailSource> {
  const canRead = await hasItemPermission(userId, itemId, 'read')
  if (!canRead) {
    throw toRouteError(
      StashlyErrorCode.FORBIDDEN,
      'You do not have access to this item'
    )
  }

  const item = await prisma.item.findUnique({
    where: { id: itemId },
    select: {
      id: true,
      name: true,
      size: true,
      type: true,
      file: { select: { bucket: true, key: true, mimeType: true } },
      thumbnails: {
        where: { url: { not: null }, NOT: { url: { startsWith: '#' } } },
        select: { url: true },
        take: 1,
      },
    },
  })

  if (!item) {
    throw toRouteError(StashlyErrorCode.ITEM_NOT_FOUND, 'Item not found')
  }

  // The stage travels as its own field: a signed URL carries no `?v=`, so the
  // client can no longer read it off the URL.
  const stored = parseThumbnailLocator(item.thumbnails[0]?.url, itemId)
  if (stored) {
    return {
      status: 'exists',
      url: await signThumbnailLocation(stored),
      stage: stored.stage,
    }
  }

  if (item.type !== 'file' || !item.file?.key) return { status: 'unsupported' }

  const size = Number(item.size)
  if (size <= 0 || size > BACKFILL_MAX_BYTES) return { status: 'unsupported' }

  const downloadUrl = await getPresignedUrl(
    item.file.bucket,
    'get',
    item.file.key,
    300
  )

  return {
    status: 'ready',
    downloadUrl,
    mimeType: item.file.mimeType,
    name: item.name,
    size,
  }
}

export async function getThumbnailByItemId(
  itemId: string,
  view: string = 'grid',
  size: string = 'medium'
) {
  return prisma.thumbnail.findFirst({
    where: { itemId, view: view as any, size: size as any },
    select: { stage: true, content: true, url: true },
  })
}
