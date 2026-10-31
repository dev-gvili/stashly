import type { Prisma } from '@/prisma/client'
import { prisma } from '@/services/db'
import { track } from '@/services/vinktar'
import { toObjectId, getPrefixForModel } from '@/utils/converters'
import { createActivity } from './activity-actions'
import { signThumbnails } from './thumbnail-actions'

function recordPinActivity(
  itemId: string,
  kind: 'pinned' | 'unpinned' | 'reordered'
) {
  Promise.resolve()
    .then(() =>
      createActivity({
        item: { connect: { id: itemId } },
        time: {
          create: {
            id: toObjectId(getPrefixForModel('ActivityTime')),
            observedAt: new Date(),
          },
        },
        action: {
          create: {
            id: toObjectId(getPrefixForModel('ItemAction')),
            pin: {
              create: {
                id: toObjectId(getPrefixForModel('PinAction')),
                kind,
              },
            },
          },
        },
      })
    )
    .catch(() => {})
}

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
    where: { bucket: { not: null } },
    select: {
      id: true,
      bucket: true,
      color: true,
      width: true,
      height: true,
      size: true,
      view: true,
      stage: true,
    },
  },
  favorites: {
    select: {
      id: true,
      favoritedBy: {
        select: { id: true, name: true, displayName: true, image: true },
      },
    },
  },
  pins: {
    select: {
      id: true,
      pinnedById: true,
      pinnedBy: {
        select: { id: true, name: true, displayName: true, image: true },
      },
    },
  },
  locked: {
    select: { id: true, lockedById: true, lockedAt: true },
  },
  parent: {
    select: {
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
      tags: true,
      file: true,
      folder: true,
      favorites: {
        select: {
          id: true,
          favoritedBy: {
            select: { id: true, name: true, displayName: true, image: true },
          },
        },
      },
      thumbnails: {
        select: {
          height: true,
          width: true,
          bucket: true,
          color: true,
          view: true,
          size: true,
          id: true,
          stage: true,
        },
      },
      locked: {
        select: { id: true, lockedById: true, lockedAt: true },
      },
      parent: { select: { id: true, name: true } },
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
  const created = await client.pinItem.create({
    data: {
      id: toObjectId(getPrefixForModel('PinItem')),
      itemId,
      pinnedById,
      position: 0,
    },
  })
  recordPinActivity(itemId, 'pinned')
  track('item_pinned', { item_id: itemId, pin_id: created.id }, {
    userId: pinnedById,
  })
  return created
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
  recordPinActivity(itemId, 'unpinned')
  track(
    'item_unpinned',
    {
      item_id: itemId,
      pin_id: row.id,
      pinned_hours: Math.round(
        (Date.now() - row.createdAt.getTime()) / 3_600_000
      ),
    },
    { userId: pinnedById }
  )
}

export async function reorderPin(
  pinId: string,
  pinnedById: string,
  position: number,
  client: Prisma.TransactionClient = prisma
) {
  const updated = await client.pinItem.findFirst({
    where: { id: pinId, pinnedById },
    select: { itemId: true },
  })
  const result = await client.pinItem.updateMany({
    where: { id: pinId, pinnedById },
    data: { position },
  })
  if (result.count === 0) {
    throw new Error('Pin not found or not owned by user')
  }
  if (updated) recordPinActivity(updated.itemId, 'reordered')
  track(
    'pin_reordered',
    { pin_id: pinId, item_id: updated?.itemId ?? null, position },
    { userId: pinnedById }
  )
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
      pinnedById: true,
      itemId: true,
      position: true,
      createdAt: true,
      item: { select: itemListSelect },
    },
  })

  const hasMore = rows.length > limit
  const sliced = hasMore ? rows.slice(0, limit) : rows
  const nextCursor = hasMore ? sliced[sliced.length - 1].id : null
  const items = await signThumbnails(sliced.map((r) => r.item))
  return { items, nextCursor, hasMore }
}
