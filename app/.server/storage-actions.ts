import { Prisma } from '@/prisma/client'
import { prisma } from '@/services/db'
import { track } from '@/services/vinktar'
import { findQuotaByUserId, toQuotaStatus } from './quota-actions'
import { emptyBucket } from './s3'
import type { ItemCategory } from '@/prisma/enums'
import { createActivity } from './activity-actions'
import { signThumbnails } from './thumbnail-actions'
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

/**
 * How sure we are that the copies in a group really are the same bytes.
 *
 * Grouping is by name + size, which is only a *candidate* signal, so the verdict
 * comes from `File.hash`: identical non-null hashes prove `exact`, differing
 * hashes prove `conflict`, and a missing hash on any copy leaves the group at
 * `near` — never claim `exact` from a name match alone.
 */
export type DuplicateRisk = 'exact' | 'near' | 'conflict'

export interface DuplicateGroupCopy {
  id: string
  name: string
  size: bigint
  extension: string | null
  /** `File.hash`; null when the file was stored before hashing, or is a folder. */
  hash: string | null
  thumbnails: { url: string | null }[]
  /** Display path of the containing folder, root excluded: `Photos/2026/August`. */
  folderPath: string
  /** When the copy entered the stash. Drives the "keep original" rule. */
  addedAt: Date
  /** Last modification. Drives the "keep newest" rule — deliberately distinct. */
  modifiedAt: Date
}

export interface DuplicateGroupDetail {
  id: string
  name: string
  risk: DuplicateRisk
  copies: DuplicateGroupCopy[]
  /** Bytes freed if every copy but one goes to Trash. */
  reclaimableBytes: bigint
}

/** The six tints the overview's storage meter can draw. */
type StorageTone = 'images' | 'video' | 'audio' | 'documents' | 'code' | 'other'

/** Meter tone each `ItemCategory` rolls up into on the overview page. */
const CATEGORY_TONE: Record<ItemCategory, StorageTone> = {
  image: 'images',
  graphic: 'images',
  video: 'video',
  audio: 'audio',
  document: 'documents',
  spreadsheet: 'documents',
  presentation: 'documents',
  text: 'documents',
  pdf: 'documents',
  code: 'code',
  script: 'code',
  archive: 'other',
  binaries: 'other',
  unknown: 'other',
}

const TONE_LABEL: Record<StorageTone, string> = {
  images: 'Images',
  video: 'Video',
  documents: 'Documents',
  code: 'Code',
  other: 'Other',
  audio: 'Audio',
}

const TONE_ORDER: StorageTone[] = [
  'images',
  'video',
  'audio',
  'documents',
  'code',
  'other',
]

export interface StorageSummary {
  usedBytes: number
  totalBytes: number
  segments: { label: string; bytes: number; tone: StorageTone }[]
}

/**
 * Quota plus a five-way byte breakdown, sized for the overview page's meter.
 *
 * Deliberately lighter than `getStorageOverview` — no largest-item or
 * duplicate scans — and it returns `null` instead of throwing when the account
 * has no quota row, so the home loader can just leave the section out.
 *
 * @param userId - The owner whose active files are measured.
 *
 * @example
 * const storage = await getStorageSummary(session.user.id)
 * // { usedBytes: 4080218931, totalBytes: 17179869184, segments: [...] }
 */
export async function getStorageSummary(
  userId: string
): Promise<StorageSummary | null> {
  const [quota, categoryGroups] = await Promise.all([
    prisma.quota.findFirst({
      where: { drive: { ownerId: userId } },
      select: { used: true, total: true },
    }),
    prisma.item.groupBy({
      by: ['category'],
      where: {
        ownerId: userId,
        type: 'file' as const,
        status: { not: 'trashed' as const },
      },
      _sum: { size: true },
    }),
  ])

  if (!quota || quota.total <= 0n) return null

  const byTone = new Map<StorageTone, number>()
  for (const group of categoryGroups) {
    const tone = CATEGORY_TONE[group.category]
    const bytes = Number(group._sum.size ?? 0n)
    if (bytes <= 0) continue
    byTone.set(tone, (byTone.get(tone) ?? 0) + bytes)
  }

  return {
    usedBytes: Number(quota.used),
    totalBytes: Number(quota.total),
    segments: TONE_ORDER.filter((tone) => byTone.has(tone)).map((tone) => ({
      label: TONE_LABEL[tone],
      bytes: byTone.get(tone)!,
      tone,
    })),
  }
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

/**
 * Resolves the display folder path for many items in a single recursive walk.
 *
 * `breadcrumbs()` answers this for one item; calling it per copy would be one
 * query per card. This is the same CTE widened to carry a `leaf` column, so
 * fifteen groups of five copies cost one round trip instead of seventy-five.
 *
 * The item's own name (depth 0) and the drive root (the only node with a null
 * `parentId`) are both dropped, so a copy in the root reads as the root's name
 * and `Downloads/...` starts with `Downloads` — which is what the "keep filed
 * copy" rule inspects.
 */
async function folderPathsFor(itemIds: string[]) {
  if (itemIds.length === 0) return new Map<string, string>()

  const rows = await prisma.$queryRaw<{ itemId: string; path: string | null }[]>`
    WITH RECURSIVE trail AS (
      SELECT i."id" AS leaf, i."id", i."name", i."parentId", 0 AS depth
      FROM "Item" i
      WHERE i."id" IN (${Prisma.join(itemIds)})
      UNION ALL
      SELECT t.leaf, p."id", p."name", p."parentId", t.depth + 1
      FROM "Item" p
      INNER JOIN trail t ON t."parentId" = p."id"
    )
    SELECT
      leaf AS "itemId",
      COALESCE(
        string_agg("name", '/' ORDER BY depth DESC)
          FILTER (WHERE depth > 0 AND "parentId" IS NOT NULL),
        max("name") FILTER (WHERE "parentId" IS NULL)
      ) AS path
    FROM trail
    GROUP BY leaf
  `

  return new Map(
    rows.flatMap((row) => (row.path ? [[row.itemId, row.path] as const] : []))
  )
}

/** Every copy in a group must carry the same non-null hash to claim `exact`. */
function riskFor(hashes: (string | null)[]): DuplicateRisk {
  if (hashes.some((hash) => !hash)) return 'near'
  return new Set(hashes).size === 1 ? 'exact' : 'conflict'
}

/**
 * The duplicate groups behind the storage page's `Resolve duplicates` action,
 * with everything the triage screen renders: folder path, thumbnails, and both
 * timestamps.
 *
 * Kept separate from `getStorageOverview` on purpose — the overview only draws
 * a name/count/wasted-bytes summary, and making every visit to the storage page
 * pay for thumbnails and ancestor walks would be a regression for a list nobody
 * asked to resolve yet.
 */
export async function getDuplicateGroups(
  userId: string
): Promise<DuplicateGroupDetail[]> {
  const activeFileWhere = {
    ownerId: userId,
    type: 'file' as const,
    status: { not: 'trashed' as const },
  }

  // Same name + same non-zero size = likely duplicate. Proof comes from the
  // hashes below; this only narrows the candidates.
  const groups = await prisma.item.groupBy({
    by: ['name', 'size'],
    where: { ...activeFileWhere, size: { gt: 0n } },
    _count: { id: true },
    having: { id: { _count: { gt: 1 } } },
    orderBy: { _sum: { size: 'desc' } },
    _sum: { size: true },
    take: 50,
  })

  if (groups.length === 0) return []

  const items = await signThumbnails(
    await prisma.item.findMany({
      where: {
        ...activeFileWhere,
        OR: groups.map((group) => ({ name: group.name, size: group.size })),
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        size: true,
        createdAt: true,
        updatedAt: true,
        file: { select: { hash: true, extension: true } },
        thumbnails: { select: { bucket: true, color: true, stage: true } },
      },
    })
  )

  const paths = await folderPathsFor(items.map((item) => item.id))

  const byKey = new Map<string, DuplicateGroupCopy[]>()
  for (const item of items) {
    const key = `${item.name}::${item.size}`
    const copies = byKey.get(key) ?? []
    copies.push({
      id: item.id,
      name: item.name,
      size: item.size,
      extension: item.file?.extension ?? null,
      hash: item.file?.hash ?? null,
      thumbnails: item.thumbnails,
      folderPath: paths.get(item.id) ?? '',
      addedAt: item.createdAt,
      modifiedAt: item.updatedAt,
    })
    byKey.set(key, copies)
  }

  return groups.flatMap((group) => {
    const copies = byKey.get(`${group.name}::${group.size}`) ?? []
    if (copies.length < 2) return []
    return [
      {
        id: copies[0].id,
        name: group.name,
        risk: riskFor(copies.map((copy) => copy.hash)),
        copies,
        reclaimableBytes: group.size * BigInt(copies.length - 1),
      },
    ]
  })
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

  const deletedItems = await prisma.$transaction(async (tx) => {
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
    const { count } = await tx.item.deleteMany({
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
    return count
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
  track(
    'bucket_emptied',
    {
      item_count: deletedItems,
      bytes_freed: quota ? Number(quota.used + quota.deleted) : null,
      had_bucket: Boolean(user?.bucket),
    },
    { userId }
  )
}
