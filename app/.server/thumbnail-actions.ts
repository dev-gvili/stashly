import { prisma } from '@/services/db'
import { track } from '@/services/vinktar'
import { log } from '@/services/log'
import { getPrefixForModel, toObjectId } from '@/utils/converters'
import { itemAccessWhere } from '@/services/permission-actions'
import { requireMembership } from '@/services/workspace-actions'
import { getPresignedUrl } from '@/services/s3'
import { StashlyError, StashlyErrorCode, toRouteError } from '@/utils/api.errors'
import type { Prisma } from '@/prisma/client'
import { ItemCategory, ItemStatus, ItemType } from '@/prisma/enums'

// ===================================================== //
// ================= Thumbnail storage ================= //
// ===================================================== //

/** Thumbnail stages that are persisted (stage 1 never leaves the browser). */
export type ThumbnailStage = 2 | 3

/** Everything needed to sign a read of one stored thumbnail. */
export interface ThumbnailLocation {
  bucket: string
  key: string
  itemId: string
  stage: ThumbnailStage
}

/**
 * The `Thumbnail` columns a read path has to select for signing. `url` is not
 * among them: the payload's `url` is produced by signing, never stored.
 */
export interface StoredThumbnail {
  bucket?: string | null
  stage?: number | null
  color?: string | null
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

// S3 bucket naming rules: 3–63 chars, lowercase letters, digits, dots, hyphens.
const BUCKET_RE = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/
// `toObjectId` output: `<prefix>_<base64url>`.
const ITEM_ID_RE = /^[a-z]+_[A-Za-z0-9_-]+$/
// Stage-0 placeholder. The POST route stores a client-supplied value here, so
// nothing but a colour may come back out as an `<img src>`.
const HEX_COLOR_RE = /^#[0-9a-fA-F]{3,8}$/

/**
 * The one S3 key an item's thumbnail may have. Stages overwrite it in place,
 * so it is derived from the item id and never stored.
 *
 * @example
 * thumbnailKey('itm_abc') // → 'thumbnails/itm_abc.webp'
 */
export function thumbnailKey(itemId: string): string {
  return `thumbnails/${itemId}.webp`
}

/**
 * Where a stored thumbnail lives, from its row's columns — or `null` when the
 * row holds no persisted object (stage 0/1, or no bucket written yet).
 *
 * The bucket is written by the server from the item's file bucket, never taken
 * from a request, so the credentials behind `getPresignedUrl` — which reach
 * every user's bucket — can only be pointed at `thumbnails/<itemId>.webp` in
 * the bucket that owns the item. The format checks are a second line behind
 * that, so a corrupted row is refused rather than signed.
 *
 * @param row - The stored `bucket` and `stage`.
 * @param itemId - Item the row belongs to (the caller's, not the row's say-so).
 *
 * @example
 * thumbnailLocation({ bucket: 'stashly-jane-a1b2c3d4', stage: 3 }, 'itm_abc')
 * // → { bucket: 'stashly-jane-a1b2c3d4', key: 'thumbnails/itm_abc.webp', itemId: 'itm_abc', stage: 3 }
 *
 * @example
 * thumbnailLocation({ bucket: null, stage: 0 }, 'itm_abc') // → null
 */
export function thumbnailLocation(
  row: StoredThumbnail,
  itemId: string | undefined
): ThumbnailLocation | null {
  const { bucket, stage } = row
  if (!bucket || !itemId) return null
  if (stage !== 2 && stage !== 3) return null
  if (!BUCKET_RE.test(bucket) || !ITEM_ID_RE.test(itemId)) return null
  return { bucket, key: thumbnailKey(itemId), itemId, stage }
}

/**
 * The items `userId` may reach through the thumbnail calls: read access, as
 * `itemAccessWhere`, and an item in trash only for its owner, whose Trash page
 * still draws it. Without the status a grantee kept signing a trashed
 * original (tech-debt item 88).
 */
function thumbnailAccessWhere(userId: string): Prisma.ItemWhereInput {
  return {
    AND: [
      itemAccessWhere(userId, 'read'),
      { OR: [{ status: { not: ItemStatus.trashed } }, { ownerId: userId }] },
    ],
  }
}

/**
 * The bucket an item's thumbnail is written to: the bucket holding the item's
 * file. Resolved server-side so a collaborator backfilling a shared item writes
 * next to the owner's file instead of into their own bucket.
 *
 * Also the read check: the item is read through `itemAccessWhere`, so access
 * and the bucket come back in one statement, where `hasItemPermission` and
 * then this read took three (measured, tech-debt item 43).
 *
 * @throws `FORBIDDEN` (403) when `userId` can't read the item, or it doesn't exist.
 * @throws {StashlyError} `ITEM_NOT_FOUND` when the item has no file bucket.
 */
async function resolveThumbnailBucket(
  userId: string,
  itemId: string
): Promise<string> {
  const item = await prisma.item.findFirst({
    where: { id: itemId, ...thumbnailAccessWhere(userId) },
    select: { file: { select: { bucket: true } } },
  })
  if (!item) {
    throw toRouteError(
      StashlyErrorCode.FORBIDDEN,
      'You do not have access to this item'
    )
  }
  const bucket = item.file?.bucket
  if (!bucket || !BUCKET_RE.test(bucket) || !ITEM_ID_RE.test(itemId)) {
    throw new StashlyError(
      StashlyErrorCode.ITEM_NOT_FOUND,
      'Item has no file to attach a thumbnail to'
    )
  }
  return bucket
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
 * Turns one stored thumbnail row into the `url` the browser loads.
 *
 * - a persisted stage (2/3) with a bucket → a signed GET URL
 * - otherwise the stage-0 `#hex` placeholder colour, or `null` — every
 *   consumer already filters `#` values. Anything in `color` that is not a hex
 *   colour is dropped: it is client-supplied, and it lands in an `<img src>`
 * - a bucket that fails the format checks → `null`, with a warning
 *
 * **Authorization is the caller's job.** Call this only on rows a loader or
 * action has already scoped to what the viewer is allowed to see.
 *
 * @param row - The stored `bucket`, `stage` and `color`.
 * @param itemId - Item the row belongs to.
 *
 * @example
 * const thumbnailUrl = await signStoredThumbnail(row, row.id)
 */
export async function signStoredThumbnail(
  row: StoredThumbnail,
  itemId: string | undefined
): Promise<string | null> {
  const location = thumbnailLocation(row, itemId)
  if (location) return signThumbnailLocation(location)
  if (row.bucket) {
    log.warn('refused to sign an unrecognised thumbnail row', {
      item_id: itemId,
      bucket: row.bucket.slice(0, 80),
      stage: row.stage,
    })
    return null
  }
  return row.color && HEX_COLOR_RE.test(row.color) ? row.color : null
}

/** A thumbnail as the client receives it: `url` signed, storage columns gone. */
export type SignedThumbnail<E> = Omit<E, 'bucket' | 'color' | 'url'> & {
  url: string | null
}

/** Distributes over `X[] | null | undefined`, signing only the array member. */
type SignThumbnailList<V> =
  V extends ReadonlyArray<infer E> ? SignedThumbnail<E>[] : V

/**
 * The type {@link signThumbnails} returns: `T` with every `thumbnails` array,
 * at any depth, replaced by its signed shape. Class instances (`Date`,
 * `Uint8Array`, Prisma's `Decimal`) pass through, as they do at runtime.
 */
export type WithSignedThumbnails<T> = T extends
  | Date
  | Uint8Array
  | { toFixed: (...args: never[]) => unknown }
  ? T
  : T extends ReadonlyArray<infer U>
    ? WithSignedThumbnails<U>[]
    : T extends object
      ? {
          [K in keyof T]: K extends 'thumbnails'
            ? SignThumbnailList<T[K]>
            : WithSignedThumbnails<T[K]>
        }
      : T

/**
 * Signs every `thumbnails[]` row in a query result, at any depth, and returns
 * a copy with the same shape — each row gains a loadable `url` and loses its
 * `bucket`/`color` storage columns. Wrap a query result with it on the way out.
 * Select `bucket`, `stage` and `color` on every `thumbnails` relation; a row
 * without them signs to `null`.
 *
 * Item payloads nest — a row carries `parent`, `children`, `copies`, and each
 * of those can carry its own thumbnails. Signing each nesting level by hand at
 * every read site is how one gets missed, so this walks the result instead.
 * The **nearest enclosing object's `id`** is the item the key is built from,
 * so a row can only ever sign its own item's thumbnail.
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
 *     select: { id: true, thumbnails: { select: { bucket: true, stage: true, color: true } } },
 *   })
 * )
 *
 * @example
 * // Works on a single row, or any wrapper around rows
 * return signThumbnails({ items, nextCursor })
 */
export async function signThumbnails<T>(
  input: T
): Promise<WithSignedThumbnails<T>> {
  return (await signWalk(input, undefined)) as WithSignedThumbnails<T>
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
          if (!thumb || typeof thumb !== 'object') return thumb
          const { bucket, color, url: _stale, ...rest } = thumb as StoredThumbnail & {
            url?: unknown
          }
          const url = await signStoredThumbnail({ bucket, color, stage: rest.stage }, itemId)
          return { ...rest, url }
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
 * The object goes into the bucket holding the item's file — not the caller's
 * own — so a collaborator backfilling a shared item writes next to the owner's
 * file. That is a write into another user's bucket, so it requires read access
 * to the item, the same bar {@link updateThumbnail} sets. The PUT carries no
 * ACL — the object stays private and is only ever read signed.
 *
 * @param userId - Viewer requesting the upload.
 * @param itemId - Item the thumbnail belongs to.
 *
 * @throws {StashlyError} `FORBIDDEN` when the viewer can't read the item.
 *
 * @example
 * return data(await presignThumbnailUpload(session.user.id, itemId))
 */
export async function presignThumbnailUpload(
  userId: string,
  itemId: string
): Promise<{ uploadUrl: string; viewUrls: Record<ThumbnailStage, string> }> {
  const bucket = await resolveThumbnailBucket(userId, itemId)
  const stage2: ThumbnailLocation = {
    bucket,
    key: thumbnailKey(itemId),
    itemId,
    stage: 2,
  }

  const [uploadUrl, view2, view3] = await Promise.all([
    getPresignedUrl(bucket, 'put', stage2.key, 300),
    signThumbnailLocation(stage2),
    signThumbnailLocation({ ...stage2, stage: 3 }),
  ])
  return { uploadUrl, viewUrls: { 2: view2, 3: view3 } }
}

/**
 * Records `itemId`'s placeholder thumbnail row (its dominant colour) for
 * `userId`, or returns the one already there.
 *
 * Read access is enough, as for the stage writes (`updateThumbnail`): a viewer
 * may backfill a missing thumbnail.
 *
 * @throws `FORBIDDEN` (403) when `userId` can't read the item, or it doesn't
 *   exist, so the answer doesn't reveal which ids exist.
 */
export async function createThumbnail(
  userId: string,
  itemId: string,
  hexColor: string,
  view: string = 'grid',
  size: string = 'medium'
) {
  const item = await prisma.item.findFirst({
    where: { id: itemId, ...thumbnailAccessWhere(userId) },
    select: { id: true },
  })
  if (!item) {
    throw toRouteError(
      StashlyErrorCode.FORBIDDEN,
      'You do not have access to this item'
    )
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
        color: hexColor,
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
 * What is stored is **derived here**, never taken from the request: the bucket
 * comes from the item's file and the key from its id. A client-supplied value
 * would be a read primitive — the server signs whatever is stored, and its
 * credentials reach every user's bucket.
 *
 * Requires read access to the item. Read, not write, because backfill lets a
 * viewer of a shared item generate the thumbnail that was never produced at
 * upload time.
 *
 * @param userId - Viewer recording the thumbnail.
 * @param itemId - Item the thumbnail belongs to.
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
 * const url = await updateThumbnail(session.user.id, itemId, 2, 512, 384)
 */
export async function updateThumbnail(
  userId: string,
  itemId: string,
  stage: ThumbnailStage,
  width?: number,
  height?: number,
  view: string = 'grid',
  size: string = 'medium'
): Promise<string> {
  const bucket = await resolveThumbnailBucket(userId, itemId)
  await persistThumbnailStage(itemId, stage, bucket, width, height, view, size)
  track(
    'thumbnail_stage_saved',
    {
      item_id: itemId,
      stage,
      width: width ?? null,
      height: height ?? null,
      view,
      size,
    },
    { userId }
  )
  return signThumbnailLocation({
    bucket,
    key: thumbnailKey(itemId),
    itemId,
    stage,
  })
}

/**
 * Upserts the `Thumbnail` row for one (item, view, size) at a given stage.
 * `url` is written `null`: it is the retired locator column, and leaving an
 * old locator beside a newer `bucket`/`stage` would be two answers to one
 * question.
 */
async function persistThumbnailStage(
  itemId: string,
  stage: number,
  bucket: string,
  width?: number,
  height?: number,
  view: string = 'grid',
  size: string = 'medium'
) {
  const data = { stage, bucket, url: null, width, height }
  const result = await prisma.thumbnail.updateMany({
    where: { itemId, view: view as any, size: size as any },
    data,
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
        ...data,
      },
    })
  } catch (e: unknown) {
    // P2002 = a concurrent PATCH for the same (itemId,view,size) won the race.
    // Retry update — the winner's row now exists.
    if ((e as { code?: string })?.code === 'P2002') {
      return prisma.thumbnail.updateMany({
        where: { itemId, view: view as any, size: size as any },
        data,
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
  // The read check is in the `where` (`itemAccessWhere`): one statement, where
  // `hasItemPermission` first added two. No row means no access, or no item.
  const item = await prisma.item.findFirst({
    where: { id: itemId, ...thumbnailAccessWhere(userId) },
    select: {
      id: true,
      name: true,
      size: true,
      type: true,
      file: { select: { bucket: true, key: true, mimeType: true } },
      thumbnails: {
        where: { bucket: { not: null }, stage: { in: [2, 3] } },
        orderBy: { stage: 'desc' },
        select: { bucket: true, stage: true },
        take: 1,
      },
    },
  })

  if (!item) {
    throw toRouteError(
      StashlyErrorCode.FORBIDDEN,
      'You do not have access to this item'
    )
  }

  // The stage travels as its own field: a signed URL carries no `?v=`, so the
  // client can no longer read it off the URL.
  const size = Number(item.size)
  /** Records which way the backfill request went, then answers it. */
  const answer = <T extends ThumbnailSource>(source: T, reason?: string): T => {
    track(
      'thumbnail_source_requested',
      {
        item_id: itemId,
        status: source.status,
        reason: reason ?? null,
        size_bytes: size,
        mime_type: item.file?.mimeType ?? null,
      },
      { userId }
    )
    return source
  }

  const stored = item.thumbnails[0]
    ? thumbnailLocation(item.thumbnails[0], itemId)
    : null
  if (stored) {
    return answer({
      status: 'exists',
      url: await signThumbnailLocation(stored),
      stage: stored.stage,
    })
  }

  if (item.type !== 'file' || !item.file?.key)
    return answer({ status: 'unsupported' }, 'not_a_file')

  if (size <= 0 || size > BACKFILL_MAX_BYTES)
    return answer({ status: 'unsupported' }, size <= 0 ? 'empty' : 'too_large')

  const downloadUrl = await getPresignedUrl(
    item.file.bucket,
    'get',
    item.file.key,
    300
  )

  return answer({
    status: 'ready',
    downloadUrl,
    mimeType: item.file.mimeType,
    name: item.name,
    size,
  })
}

export async function getThumbnailByItemId(
  itemId: string,
  view: string = 'grid',
  size: string = 'medium'
) {
  return prisma.thumbnail.findFirst({
    where: { itemId, view: view as any, size: size as any },
    select: { stage: true, content: true, bucket: true, color: true },
  })
}

// ===================================================== //
// ====================== Gallery ====================== //
// ===================================================== //

/**
 * The gallery's media: `userId`'s own personal (non-workspace) image and video files that have a
 * stored thumbnail, newest first, each with its best stored thumbnail signed
 * for reading (`thumbnails[0].url`).
 *
 * Scoped to the owner, so it never reads another user's items whatever
 * `where` adds. With `workspaceId` it lists that workspace's media instead:
 * the items the user may read there (their own, or ones a grant gives them),
 * and only while they are a member.
 *
 * @param userId - The signed-in user.
 * @param where - Extra filters from the URL (`buildItemFilters`), ANDed in.
 * @param take - Page size.
 * @param workspaceId - The workspace being browsed, on the workspace gallery.
 * @throws `FORBIDDEN` (403) when `workspaceId` is given and the user is not a member.
 *
 * @example
 * const media = await getGalleryMedia(session.user.id, buildItemFilters(params), params.take)
 *
 * @example
 * const media = await getGalleryMedia(userId, {}, 200, params.workspaceId)
 */
export async function getGalleryMedia(
  userId: string,
  where: Prisma.ItemWhereInput,
  take?: number,
  workspaceId?: string
) {
  if (workspaceId) await requireMembership(userId, workspaceId)
  const items = await prisma.item.findMany({
    // One `AND`, never spreads: the URL filters arrive as `{ AND: [...] }`
    // and `itemAccessWhere` is one too, so spreading the scope after the
    // filters replaced them (and their default status) wholesale. Each clause
    // can only narrow, so no URL filter can widen the scope.
    where: {
      AND: [
        {
          type: ItemType.file,
          category: { in: [ItemCategory.image, ItemCategory.video] },
          thumbnails: { some: { bucket: { not: null } } },
          // The gallery never shows trash, whatever `?status=` asks.
          status: { not: ItemStatus.trashed },
        },
        // `buildFiltersFactory` answers `[]` when no filter is set.
        Array.isArray(where) ? {} : where,
        workspaceId
          ? { workspaceId, ...itemAccessWhere(userId, 'read') }
          : // `workspaceId: null`: a workspace item the user uploaded belongs
            // to that workspace's gallery, not their personal one.
            { ownerId: userId, workspaceId: null },
      ],
    },
    take,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: {
      id: true,
      name: true,
      type: true,
      parentId: true,
      size: true,
      createdAt: true,
      parent: { select: { name: true } },
      // Only the viewer's own pin, at most one row: enough for the tile's
      // pinned state without sending everyone's pins.
      pins: { where: { pinnedById: userId }, select: { id: true }, take: 1 },
      thumbnails: {
        orderBy: { stage: 'desc' },
        take: 1,
        where: { bucket: { not: null } },
        select: {
          height: true,
          width: true,
          bucket: true,
          color: true,
          size: true,
          id: true,
          stage: true,
        },
      },
      image: { select: { width: true, height: true } },
      video: {
        select: {
          width: true,
          height: true,
          duration: true,
          bitrate: true,
          codec: true,
        },
      },
    },
  })
  return signThumbnails(items)
}
