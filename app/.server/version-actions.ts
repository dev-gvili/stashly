import { prisma } from '@/services/db'
import { track } from '@/services/vinktar'
import { StashlyError, StashlyErrorCode, toRouteError } from '@/utils/api.errors'
import { getPrefixForModel, toObjectId } from '@/utils/converters'
import type { Prisma } from '@/prisma/client'
import { buildItemVersionFilters } from '@/utils/filters/itemVersion.filters'
import { searchFactory } from '@/utils/search'
import { createActivity } from './activity-actions'

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/**
 * Paginated, filterable search over ItemVersion records.
 *
 * @example
 * const page = await searchVersions({ itemId: 'item_123', take: 20, strategy: 'cursor' })
 */
export const searchVersions = searchFactory({
  dbDelegate: prisma.itemVersion,
  buildFilters: buildItemVersionFilters,
  defaultOrderBy: (): Prisma.ItemVersionOrderByWithRelationInput => ({ createdAt: 'desc' }),
})

/**
 * List all versions for a given item, ordered by creation time descending.
 */
export async function listVersions(itemId: string) {
  return prisma.itemVersion.findMany({
    where: { itemId },
    orderBy: { createdAt: 'desc' },
  })
}

/**
 * Get a single version by its ID. Throws if not found.
 */
export async function getVersion(versionId: string) {
  const version = await prisma.itemVersion.findUnique({
    where: { id: versionId },
  })
  if (!version) {
    throw toRouteError(StashlyErrorCode.NOT_FOUND, 'Version not found')
  }
  return version
}

/**
 * Create a new version snapshot for an item.
 */
export async function createVersion({
  itemId,
  label,
  version,
  size,
  content,
  userId,
}: {
  itemId: string
  userId: string
  label?: string | null
  version?: string | null
  size?: bigint | number | null
  content?: Uint8Array<ArrayBuffer> | null
}) {
  const ver = await prisma.itemVersion.create({
    data: {
      id: toObjectId(getPrefixForModel('ItemVersion')),
      item: { connect: { id: itemId } },
      label: label ?? null,
      version: version ?? null,
      size: size ?? null,
      content: content ?? null,
    },
  })
  createActivity({
    item: { connect: { id: itemId } },
    time: { create: { id: toObjectId(getPrefixForModel('ActivityTime')), observedAt: new Date() } },
    action: {
      create: {
        id: toObjectId(getPrefixForModel('ItemAction')),
        version: { create: { id: toObjectId(getPrefixForModel('VersionAction')), newVersion: ver.id } },
      },
    },
  }).catch(() => {})
  track(
    'version_created',
    {
      version_id: ver.id,
      item_id: itemId,
      size_bytes: size == null ? null : Number(size),
      has_label: Boolean(label),
      has_content: content != null,
    },
    { userId }
  )
  return ver
}

/**
 * Restore a version: copies the version's content/size back onto the item record.
 * The item's `updatedAt` is touched via a no-op update.
 */
export async function restoreVersion({
  versionId,
  itemId,
  userId,
}: {
  versionId: string
  itemId: string
  userId: string
}) {
  const version = await prisma.itemVersion.findUnique({
    where: { id: versionId },
  })
  if (!version) {
    throw toRouteError(StashlyErrorCode.NOT_FOUND, 'Version not found')
  }
  if (version.itemId !== itemId) {
    throw toRouteError(
      StashlyErrorCode.FORBIDDEN,
      'Version does not belong to this item'
    )
  }

  const result = await prisma.$transaction(async (tx) => {
    // Snapshot the current item state as a new version before restoring
    const currentItem = await tx.item.findUnique({ where: { id: itemId } })
    if (!currentItem) {
      throw toRouteError(StashlyErrorCode.NOT_FOUND, 'Item not found')
    }

    // Touch the item's updatedAt to signal a restore event
    const restored = await tx.item.update({
      where: { id: itemId },
      data: { updatedAt: new Date() },
    })

    return { restored, version }
  })
  track(
    'version_restored',
    {
      version_id: versionId,
      item_id: itemId,
      size_bytes: version.size == null ? null : Number(version.size),
      version_age_hours: version.createdAt
        ? Math.round((Date.now() - version.createdAt.getTime()) / 3_600_000)
        : null,
    },
    { userId }
  )
  return result
}

/**
 * Delete a version by ID. The item owner (userId) must own the parent item.
 */
export async function deleteVersion({
  versionId,
  ownerId,
}: {
  versionId: string
  ownerId: string
}) {
  const version = await prisma.itemVersion.findUnique({
    where: { id: versionId },
    include: { item: { select: { ownerId: true } } },
  })
  if (!version) {
    throw toRouteError(StashlyErrorCode.NOT_FOUND, 'Version not found')
  }
  if (version.item?.ownerId !== ownerId) {
    throw toRouteError(
      StashlyErrorCode.FORBIDDEN,
      'You do not have permission to delete this version'
    )
  }
  const deleted = await prisma.itemVersion.delete({ where: { id: versionId } })
  track(
    'version_deleted',
    {
      version_id: versionId,
      item_id: version.itemId,
      size_bytes: version.size == null ? null : Number(version.size),
    },
    { userId: ownerId }
  )
  return deleted
}
