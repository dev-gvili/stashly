import { prisma } from '@/services/db'
import { getPrefixForModel, toObjectId } from '@/utils/converters'
import { hasItemPermission } from '@/services/permission-actions'
import { getPresignedUrl } from '@/services/s3'
import { StashlyError, StashlyErrorCode } from '@/utils/api.errors'

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

export async function updateThumbnail(
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
  | { status: 'exists'; url: string }
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
    throw new StashlyError(
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
    throw new StashlyError(StashlyErrorCode.ITEM_NOT_FOUND, 'Item not found')
  }

  const existing = item.thumbnails[0]?.url
  if (existing) return { status: 'exists', url: existing }

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
