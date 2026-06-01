import { prisma } from '@/services/db'
import { findQuotaByUserId, toQuotaStatus } from './quota-actions'
import { emptyBucket } from './s3'
import type { ItemCategory } from '@/prisma/enums'
import { createActivity } from './activity-actions'
import { getPrefixForModel, toObjectId } from '@/utils/converters'

function recordBucketEmptied(rootId: string) {
  Promise.resolve()
    .then(() =>
      createActivity({
        item: { connect: { id: rootId } },
        time: {
          create: {
            id: toObjectId(getPrefixForModel('ActivityTime')),
            observedAt: new Date(),
          },
        },
        action: {
          create: {
            id: toObjectId(getPrefixForModel('ItemAction')),
            bucket: {
              create: {
                id: toObjectId(getPrefixForModel('BucketAction')),
                kind: 'emptied',
              },
            },
          },
        },
      })
    )
    .catch(() => {})
}

export interface CategoryBreakdown {
  category: ItemCategory
  size: bigint
  count: number
}

export interface LargestItem {
  id: string
  name: string
  size: bigint
  category: ItemCategory
  parentId: string | null
}

export interface DuplicateCandidate {
  name: string
  size: bigint
  count: number
  items: { id: string; parentId: string | null; createdAt: Date }[]
}

export async function getStorageOverview(userId: string) {
  const quota = await findQuotaByUserId(userId)

  const activeFileWhere = {
    ownerId: userId,
    type: 'file' as const,
    status: { not: 'trashed' as const },
  }

  const categoryGroups = await prisma.item.groupBy({
    by: ['category'],
    where: activeFileWhere,
    _sum: { size: true },
    _count: { id: true },
    orderBy: { _sum: { size: 'desc' } },
  })

  const breakdown: CategoryBreakdown[] = categoryGroups.map((g) => ({
    category: g.category,
    size: g._sum.size ?? 0n,
    count: g._count.id,
  }))

  const largestItems = await prisma.item.findMany({
    where: activeFileWhere,
    orderBy: { size: 'desc' },
    take: 10,
    select: {
      id: true,
      name: true,
      size: true,
      category: true,
      parentId: true,
    },
  })

  // Same name + same non-zero size = likely duplicate
  const duplicateGroups = await prisma.item.groupBy({
    by: ['name', 'size'],
    where: { ...activeFileWhere, size: { gt: 0n } },
    _count: { id: true },
    having: {
      id: { _count: { gt: 1 } },
    },
    orderBy: { _sum: { size: 'desc' } },
    _sum: { size: true },
    take: 15,
  })

  const duplicates: DuplicateCandidate[] = await Promise.all(
    duplicateGroups.map(async (group) => {
      const items = await prisma.item.findMany({
        where: {
          ...activeFileWhere,
          name: group.name,
          size: group.size,
        },
        select: { id: true, parentId: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      })
      return {
        name: group.name,
        size: group.size,
        count: group._count.id,
        items,
      }
    })
  )

  return { quota, breakdown, largestItems, duplicates }
}

export async function emptyUserBucket(userId: string) {
  const [quota, user] = await Promise.all([
    findQuotaByUserId(userId),
    prisma.user.findUnique({
      where: { id: userId },
      select: { rootId: true, bucket: true },
    }),
  ])
  const rootId = user?.rootId ?? null

  await prisma.$transaction(async (tx) => {
    // Flag the session so the size/count triggers skip cross-row UPDATEs that
    // target this user's own rows — those rows are also being DELETEd by the
    // same outer statement and would raise Postgres 27000. Triggers still
    // maintain rollups for OTHER users' rows (e.g. another user's collection
    // that contains items being deleted here). See migration
    // 20260526000000_user_wipe_trigger_bypass.
    //
    // Both flags are required; the consent timestamp is a safety belt against
    // a stale `SET stashly.delete_all_data_for_user` accidentally enabling the
    // bypass. set_config(..., true) scopes both to this transaction.
    await tx.$queryRaw`SELECT set_config('stashly.delete_all_data_for_user', ${userId}, true)`
    await tx.$queryRaw`SELECT set_config('stashly.delete_all_data_for_user_consent', ${new Date().toISOString()}, true)`

    // Preserve the user's root Item + its Folder facet — every uploaded file
    // and created folder lives under it, so removing the root would leave the
    // account unable to accept new uploads.
    const exceptRoot = rootId ? { itemId: { not: rootId } } : {}
    const exceptRootItem = rootId ? { id: { not: rootId } } : {}

    // Explicitly delete facet records first — Prisma 7's local executor doesn't
    // reliably trigger PG ON DELETE CASCADE, so we handle ordering manually.
    await tx.folder.deleteMany({
      where: { item: { ownerId: userId }, ...exceptRoot },
    })
    await tx.file.deleteMany({ where: { item: { ownerId: userId } } })
    await tx.image.deleteMany({ where: { item: { ownerId: userId } } })
    await tx.video.deleteMany({ where: { item: { ownerId: userId } } })
    await tx.audio.deleteMany({ where: { item: { ownerId: userId } } })
    await tx.item.deleteMany({
      where: { ownerId: userId, ...exceptRootItem },
    })

    // The wipe-bypass flags suppressed size/childCount maintenance on the
    // root (its `ownerId` matched), so its rollups still reflect the pre-wipe
    // tree. Reset them directly — no triggers fire on parents because the
    // root has no parent (parentId IS NULL).
    if (rootId) {
      await tx.item.update({
        where: { id: rootId },
        data: { size: 0n, inclusiveSize: 0n },
      })
      await tx.folder.update({
        where: { itemId: rootId },
        data: { childCount: 0, inclusiveChildCount: 0 },
      })
    }
  })

  // Zero quota usage now that DB is committed, so the user sees fresh numbers
  // even if S3 cleanup below fails partway.
  if (quota) {
    await prisma.quota.update({
      where: { id: quota.id },
      data: {
        used: 0n,
        deleted: 0n,
        status: toQuotaStatus({ used: 0n, total: quota.total }),
      },
    })
  }

  // Empty the S3 bucket last — it's not transactional, can be slow on large
  // buckets, and may partially fail. By this point the DB is already
  // consistent; any S3 objects left behind are orphans that no metadata
  // references and can be cleaned up by a retry or background job.
  if (user?.bucket) {
    await emptyBucket(user.bucket)
  }

  if (rootId) recordBucketEmptied(rootId)
}
