import { prisma } from '@/services/db'
import { findQuotaByUserId, toQuotaStatus } from './quota-actions'

export interface CategoryBreakdown {
  category: string
  size: bigint
  count: number
}

export interface LargestItem {
  id: string
  name: string
  size: bigint
  category: string
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
  const quota = await findQuotaByUserId(userId)

  // Explicitly delete facet records first — Prisma 7's local executor doesn't
  // reliably trigger PG ON DELETE CASCADE, so we handle ordering manually.
  await prisma.folder.deleteMany({ where: { item: { ownerId: userId } } })
  await prisma.file.deleteMany({ where: { item: { ownerId: userId } } })
  await prisma.image.deleteMany({ where: { item: { ownerId: userId } } })
  await prisma.video.deleteMany({ where: { item: { ownerId: userId } } })
  await prisma.audio.deleteMany({ where: { item: { ownerId: userId } } })
  await prisma.item.deleteMany({ where: { ownerId: userId } })

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

}
