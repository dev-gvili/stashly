/**
 * Sets each file's `Item.size` to the size of its stored object (tech-debt
 * item 59).
 *
 * Before item 58 a filed row took the size its client claimed, so some rows
 * disagree with their object (the measurement's own `size-b1/b2/b3-1031.bin`:
 * 10 MB objects at size 0). This HEADs every `File`'s object and, for a row
 * whose size differs, writes the real size and moves the drive's quota by the
 * difference, in one transaction per row: `used` for a live file, `deleted`
 * for one in trash. The size triggers carry the change to the folders above.
 * A row whose object is missing or can't be read is reported and left alone.
 *
 * Dry run (default) lists every row it would change and writes nothing:
 *   npx tsx --env-file=.env scripts/backfill-file-sizes.ts
 * Apply:
 *   npx tsx --env-file=.env scripts/backfill-file-sizes.ts --apply
 */
import { HeadObjectCommand } from '@aws-sdk/client-s3'
import { prisma } from '@/services/db'
import { s3 } from '@/services/s3'

const APPLY = process.argv.includes('--apply')
const CONCURRENCY = 16

interface Row {
  itemId: string
  driveId: string
  status: string
  size: bigint
  bucket: string
  key: string
}

async function objectSize(bucket: string, key: string): Promise<{ size: bigint } | { error: string }> {
  try {
    const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
    return head.ContentLength == null ? { error: 'no ContentLength' } : { size: BigInt(head.ContentLength) }
  } catch (error: any) {
    return { error: error?.name ?? String(error) }
  }
}

async function main() {
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT i."id" AS "itemId", i."driveId", i."status"::text AS "status", i."size", f."bucket", f."key"
    FROM "File" f JOIN "Item" i ON i."id" = f."itemId"
    WHERE i."type" = 'file'
    ORDER BY i."id"`
  console.log(APPLY ? '# APPLYING' : '# DRY RUN — pass --apply to write')
  console.log(`# ${rows.length} file row(s)`)

  const tally = { checked: 0, matching: 0, mismatched: 0, sized: 0, bytesAdded: 0n, unreadable: 0, failed: 0 }
  const errors: Record<string, number> = {}
  const unreadableByBucket: Record<string, number> = {}

  const handle = async (row: Row) => {
    const head = await objectSize(row.bucket, row.key)
    tally.checked++
    if ('error' in head) {
      tally.unreadable++
      errors[head.error] = (errors[head.error] ?? 0) + 1
      unreadableByBucket[row.bucket] = (unreadableByBucket[row.bucket] ?? 0) + 1
      return
    }
    const diff = head.size - row.size
    if (diff === 0n) {
      tally.matching++
      return
    }
    tally.mismatched++
    console.log(`  ${APPLY ? 'size' : 'would size'} ${row.itemId} (${row.status}) ${row.size} -> ${head.size} B (${diff > 0n ? '+' : ''}${diff})`)
    if (!APPLY) {
      tally.bytesAdded += diff
      return
    }
    try {
      await prisma.$transaction(async (tx) => {
        // Only if the size is still the one read, so a concurrent change wins.
        const updated = await tx.$executeRaw`
          UPDATE "Item" SET "size" = ${head.size} WHERE "id" = ${row.itemId} AND "size" = ${row.size}`
        if (updated !== 1) throw new Error('size changed meanwhile')
        if (row.status === 'trashed') {
          await tx.$executeRaw`
            UPDATE "Quota" SET "deleted" = GREATEST(0, "deleted" + ${diff}) WHERE "driveId" = ${row.driveId}`
        } else {
          await tx.$executeRaw`
            UPDATE "Quota" SET "used" = GREATEST(0, "used" + ${diff}) WHERE "driveId" = ${row.driveId}`
        }
      })
      tally.sized++
      tally.bytesAdded += diff
    } catch (error) {
      tally.failed++
      console.error(`  FAILED ${row.itemId}:`, error instanceof Error ? error.message : error)
    }
  }

  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    await Promise.all(rows.slice(i, i + CONCURRENCY).map(handle))
  }

  console.log(JSON.stringify({ ...tally, bytesAdded: tally.bytesAdded.toString(), unreadableBy: errors, unreadableByBucket }))
  await prisma.$disconnect()
  if (tally.failed > 0) process.exit(1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
