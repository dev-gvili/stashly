/**
 * Removes S3 objects that nothing in the database references, and aborts
 * multipart uploads that were started and never finished.
 *
 * Until 2026-10-01 a permanent delete removed the rows but left the bytes and
 * thumbnails in the bucket; failed uploads leave bytes without rows too. This
 * clears what that left behind. Permanent delete now removes its own objects,
 * so after one pass this should find little; anything it does find is a leak
 * worth investigating.
 *
 * Rules (see app/utils/s3-orphans.ts): a file is referenced when a `File` row
 * has its key; a `thumbnails/{itemId}.webp` is referenced while its item
 * exists. Unreferenced objects younger than the age floor are kept — an upload
 * writes its bytes before its rows exist. Tigris has no lifecycle rule for
 * stale multipart uploads (PutBucketLifecycleConfiguration with
 * AbortIncompleteMultipartUpload answers 400 "Lifecycle only supports
 * expiration rule"), so this aborts them, under the same age floor.
 *
 * Dry run (default) prints every key it would act on and changes nothing:
 *   npx tsx --env-file=.env scripts/sweep-s3-orphans.ts
 * Apply:
 *   npx tsx --env-file=.env scripts/sweep-s3-orphans.ts --apply
 * Age floor in hours (default 24):
 *   npx tsx --env-file=.env scripts/sweep-s3-orphans.ts --min-age-hours=48
 */
import {
  AbortMultipartUploadCommand,
  ListMultipartUploadsCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3'
import { prisma } from '@/services/db'
import { deleteObjects, s3 } from '@/services/s3'
import { classifyObject, thumbnailItemId, type StoredObject } from '@/utils/s3-orphans'

const APPLY = process.argv.includes('--apply')
const ageArg = process.argv.find((a) => a.startsWith('--min-age-hours='))
const MIN_AGE_HOURS = ageArg ? Number(ageArg.split('=')[1]) : 24
if (!Number.isFinite(MIN_AGE_HOURS) || MIN_AGE_HOURS < 1) {
  console.error('--min-age-hours must be a number >= 1')
  process.exit(1)
}
const MIN_AGE_MS = MIN_AGE_HOURS * 3600_000

async function listObjects(bucket: string): Promise<(StoredObject & { size: number })[]> {
  const objects: (StoredObject & { size: number })[] = []
  let token: string | undefined
  do {
    const page = await s3.send(new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: token }))
    for (const o of page.Contents ?? []) {
      if (o.Key && o.LastModified) objects.push({ key: o.Key, lastModified: o.LastModified, size: o.Size ?? 0 })
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined
  } while (token)
  return objects
}

async function liveItemIdsAmong(ids: string[]): Promise<Set<string>> {
  const live = new Set<string>()
  for (let i = 0; i < ids.length; i += 1000) {
    const rows = await prisma.item.findMany({ where: { id: { in: ids.slice(i, i + 1000) } }, select: { id: true } })
    for (const r of rows) live.add(r.id)
  }
  return live
}

async function sweepBucket(bucket: string, now: Date) {
  const objects = await listObjects(bucket)
  const fileKeys = new Set(
    (await prisma.file.findMany({ where: { bucket }, select: { key: true } })).map((f) => f.key)
  )
  const thumbnailIds = objects.map((o) => thumbnailItemId(o.key)).filter((id): id is string => id !== null)
  const liveItemIds = await liveItemIdsAmong(thumbnailIds)

  const tally = { referenced: 0, 'too-young': 0, 'orphan-file': 0, 'orphan-thumbnail': 0 }
  const orphans: { key: string; size: number; kind: string; ageH: number }[] = []
  for (const o of objects) {
    const verdict = classifyObject(o, { fileKeys, liveItemIds }, now, MIN_AGE_MS)
    tally[verdict]++
    if (verdict === 'orphan-file' || verdict === 'orphan-thumbnail') {
      orphans.push({ key: o.key, size: o.size, kind: verdict, ageH: Math.round((now.getTime() - o.lastModified.getTime()) / 3600_000) })
    }
  }

  const uploads = (await s3.send(new ListMultipartUploadsCommand({ Bucket: bucket }))).Uploads ?? []
  const staleUploads = uploads.filter(
    (u) => u.Key && u.UploadId && u.Initiated && now.getTime() - u.Initiated.getTime() >= MIN_AGE_MS
  )

  for (const o of orphans) console.log(`  ${APPLY ? 'delete' : 'would delete'} ${o.kind} ${o.key} (${o.size} B, ${o.ageH} h old)`)
  for (const u of staleUploads) {
    const ageH = Math.round((now.getTime() - u.Initiated!.getTime()) / 3600_000)
    console.log(`  ${APPLY ? 'abort' : 'would abort'} multipart ${u.Key} (${ageH} h old)`)
  }

  let deleted = 0
  const deleteFailures: unknown[] = []
  let aborted = 0
  const abortFailures: unknown[] = []
  if (APPLY) {
    const result = await deleteObjects(bucket, orphans.map((o) => o.key))
    deleted = result.deleted
    deleteFailures.push(...result.failed)
    for (const u of staleUploads) {
      try {
        await s3.send(new AbortMultipartUploadCommand({ Bucket: bucket, Key: u.Key!, UploadId: u.UploadId! }))
        aborted++
      } catch (error) {
        abortFailures.push({ key: u.Key, uploadId: u.UploadId, error: error instanceof Error ? error.message : String(error) })
      }
    }
  }

  const summary = {
    bucket,
    objects: objects.length,
    ...tally,
    orphanBytes: orphans.reduce((n, o) => n + o.size, 0),
    staleMultipartUploads: staleUploads.length,
    youngMultipartUploads: uploads.length - staleUploads.length,
    ...(APPLY && { deleted, aborted, deleteFailures, abortFailures }),
  }
  console.log(JSON.stringify(summary))
  return summary
}

async function main() {
  const users = await prisma.user.findMany({ where: { bucket: { not: '' } }, select: { bucket: true } })
  const buckets = [...new Set(users.map((u) => u.bucket).filter(Boolean))] as string[]
  const now = new Date()
  console.log(APPLY ? '# APPLYING' : '# DRY RUN — pass --apply to make changes')
  console.log(`# ${buckets.length} bucket(s), age floor ${MIN_AGE_HOURS} h`)
  let failedBuckets = 0
  for (const bucket of buckets) {
    console.log(`# ${bucket}`)
    try {
      const s = await sweepBucket(bucket, now)
      if (APPLY && ((s.deleteFailures as unknown[]).length || (s.abortFailures as unknown[]).length)) failedBuckets++
    } catch (error) {
      failedBuckets++
      console.error(`FAILED ${bucket}:`, error)
    }
  }
  await prisma.$disconnect()
  // A bucket that could not be swept, or had keys left behind, is a failure.
  if (failedBuckets > 0) process.exit(1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
