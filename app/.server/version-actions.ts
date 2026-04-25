import { prisma } from '@/services/db'
import { StashlyError, StashlyErrorCode } from '@/services/api.errors'
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
    throw new StashlyError(StashlyErrorCode.NOT_FOUND, 'Version not found')
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
}: {
  itemId: string
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
    throw new StashlyError(StashlyErrorCode.NOT_FOUND, 'Version not found')
  }
  if (version.itemId !== itemId) {
    throw new StashlyError(
      StashlyErrorCode.FORBIDDEN,
      'Version does not belong to this item'
    )
  }

  return prisma.$transaction(async (tx) => {
    // Snapshot the current item state as a new version before restoring
    const currentItem = await tx.item.findUnique({ where: { id: itemId } })
    if (!currentItem) {
      throw new StashlyError(StashlyErrorCode.NOT_FOUND, 'Item not found')
    }

    // Touch the item's updatedAt to signal a restore event
    const restored = await tx.item.update({
      where: { id: itemId },
      data: { updatedAt: new Date() },
    })

    return { restored, version }
  })
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
    throw new StashlyError(StashlyErrorCode.NOT_FOUND, 'Version not found')
  }
  if (version.item?.ownerId !== ownerId) {
    throw new StashlyError(
      StashlyErrorCode.FORBIDDEN,
      'You do not have permission to delete this version'
    )
  }
  return prisma.itemVersion.delete({ where: { id: versionId } })
}
