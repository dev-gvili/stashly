import type { Prisma } from '@/prisma/client'
import { prisma } from '@/services/db'
import { toObjectId, getPrefixForModel } from '@/utils/converters'
import { signThumbnails } from './thumbnail-actions'

const itemListSelect = {
  id: true,
  name: true,
  type: true,
  size: true,
  inclusiveSize: true,
  category: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  ownerId: true,
  parentId: true,
  workspaceId: true,
  driveId: true,
  file: true,
  folder: true,
  thumbnails: {
    take: 1,
    where: { NOT: { url: { startsWith: '#' } } },
    select: { id: true, url: true, width: true, height: true, size: true, view: true, stage: true },
  },
  favorites: {
    select: {
      id: true,
      favoritedBy: {
        select: { id: true, name: true, displayName: true, image: true },
      },
    },
  },
  pins: { select: { id: true, pinnedById: true } },
  locked: {
    select: {
      id: true,
      lockedAt: true,
      expiresAt: true,
      lockedById: true,
      lockedBy: { select: { id: true, name: true, displayName: true, image: true, email: true } },
    },
  },
  tags: true,
} satisfies Prisma.ItemSelect

export async function lockItemForUser(
  itemId: string,
  lockedById: string,
  expiresAt?: Date,
  client: Prisma.TransactionClient = prisma
) {
  const existing = await client.lockedItem.findUnique({ where: { itemId } })
  if (existing) {
    if (existing.lockedById === lockedById) return existing
    throw new Error('Item is already locked by another user')
  }
  return client.lockedItem.create({
    data: {
      id: toObjectId(getPrefixForModel('LockedItem')),
      itemId,
      lockedById,
      expiresAt: expiresAt ?? null,
    },
  })
}

export async function unlockItemForUser(
  itemId: string,
  lockedById: string,
  client: Prisma.TransactionClient = prisma
) {
  const row = await client.lockedItem.findUnique({ where: { itemId } })
  if (!row || row.lockedById !== lockedById) return
  await client.lockedItem.delete({ where: { itemId } })
}

export async function isLockedByUser(
  itemId: string,
  lockedById: string,
  client: Prisma.TransactionClient = prisma
): Promise<boolean> {
  const row = await client.lockedItem.findUnique({
    where: { itemId },
    select: { lockedById: true },
  })
  return row !== null && row.lockedById === lockedById
}

export async function getLockedItems({
  userId,
  cursor,
  limit = 50,
}: {
  userId: string
  cursor?: string
  limit?: number
}) {
  const rows = await prisma.lockedItem.findMany({
    where: { lockedById: userId },
    orderBy: [{ lockedAt: 'desc' }, { id: 'asc' }],
    take: limit + 1,
    cursor: cursor ? { id: cursor } : undefined,
    skip: cursor ? 1 : 0,
    select: {
      id: true,
      lockedAt: true,
      expiresAt: true,
      item: { select: itemListSelect },
    },
  })

  const hasMore = rows.length > limit
  const sliced = hasMore ? rows.slice(0, limit) : rows
  const nextCursor = hasMore ? sliced[sliced.length - 1].id : null
  const items = await signThumbnails(sliced.map((r) => r.item))
  return { items, nextCursor, hasMore }
}
