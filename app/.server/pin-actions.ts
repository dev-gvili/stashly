import type { Prisma } from '@/prisma/client'
import { prisma } from '@/services/db'
import { toObjectId, getPrefixForModel } from '@/utils/converters'

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
    select: { id: true, url: true, width: true, height: true, size: true, view: true },
  },
  favorites: {
    select: {
      id: true,
      favoritedBy: {
        select: { id: true, name: true, displayName: true, image: true },
      },
    },
  },
  tags: true,
} satisfies Prisma.ItemSelect

export async function pinItem(
  itemId: string,
  pinnedById: string,
  client: Prisma.TransactionClient = prisma
) {
  const existing = await client.pinItem.findUnique({
    where: { pinnedById_itemId: { pinnedById, itemId } },
  })
  if (existing) return existing
  return client.pinItem.create({
    data: {
      id: toObjectId(getPrefixForModel('PinItem')),
      itemId,
      pinnedById,
      position: 0,
    },
  })
}

export async function unpinItem(
  itemId: string,
  pinnedById: string,
  client: Prisma.TransactionClient = prisma
) {
  const row = await client.pinItem.findUnique({
    where: { pinnedById_itemId: { pinnedById, itemId } },
  })
  if (!row) return
  await client.pinItem.delete({ where: { id: row.id } })
}

export async function reorderPin(
  pinId: string,
  pinnedById: string,
  position: number,
  client: Prisma.TransactionClient = prisma
) {
  const result = await client.pinItem.updateMany({
    where: { id: pinId, pinnedById },
    data: { position },
  })
  if (result.count === 0) {
    throw new Error('Pin not found or not owned by user')
  }
}

export async function isPinned(
  itemId: string,
  pinnedById: string,
  client: Prisma.TransactionClient = prisma
): Promise<boolean> {
  const row = await client.pinItem.findUnique({
    where: { pinnedById_itemId: { pinnedById, itemId } },
    select: { id: true },
  })
  return row !== null
}

export async function getPinnedItems({
  userId,
  cursor,
  limit = 50,
}: {
  userId: string
  cursor?: string
  limit?: number
}) {
  const rows = await prisma.pinItem.findMany({
    where: { pinnedById: userId },
    orderBy: [{ position: 'asc' }, { createdAt: 'desc' }, { id: 'asc' }],
    take: limit + 1,
    cursor: cursor ? { id: cursor } : undefined,
    skip: cursor ? 1 : 0,
    select: {
      id: true,
      position: true,
      createdAt: true,
      item: { select: itemListSelect },
    },
  })

  const hasMore = rows.length > limit
  const sliced = hasMore ? rows.slice(0, limit) : rows
  const nextCursor = hasMore ? sliced[sliced.length - 1].id : null
  const items = sliced.map((r) => r.item)
  return { items, nextCursor, hasMore }
}
