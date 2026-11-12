import {
  AbortMultipartUploadCommand,
  ListMultipartUploadsCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3'
import { prisma } from '@/services/db'
import { log } from '@/services/log'
import { deleteObjects, s3, type FailedDelete } from '@/services/s3'
import { classifyObject, thumbnailItemId, type StoredObject } from '@/utils/s3-orphans'

// ---------------------------------------------------------------------------
// The orphan sweep: removes S3 objects nothing in the database references and
// aborts multipart uploads that were started and never finished. The rules
// are in app/utils/s3-orphans.ts: a file is referenced while a `File` row has
// its key, a `thumbnails/{itemId}.webp` while its item exists, and nothing
// younger than the age floor is touched (an upload writes its bytes before
// its rows exist).
//
// Why scheduled (tech-debt item 59): an upload completed and never filed is
// charged to no one, since the charge comes with the row. Its bytes stayed in
// the bucket until someone ran scripts/sweep-s3-orphans.ts by hand. The
// production server now runs the sweep itself (`ensureOrphanSweep`), with the
// script kept for dry runs and runs on demand. Deleting such an object needs
// no refund: no quota was charged for it.
//
// Production only. The dev database names real buckets and other sessions
// delete rows in it during tests; an automatic sweep there would act on what
// that leaves, so dev keeps the manual dry run. Two machines may sweep at the
// same time: deletes and aborts are idempotent, and the later abort of the
// same upload is logged as a failure, nothing worse.
// ---------------------------------------------------------------------------

export const ORPHAN_SWEEP_MIN_AGE_MS = 24 * 3600_000
export const ORPHAN_SWEEP_INTERVAL_MS = 6 * 3600_000
/** The first run waits this long after boot, plus up to as much again. */
const ORPHAN_SWEEP_FIRST_DELAY_MS = 10 * 60_000

export interface OrphanSweepOptions {
  apply: boolean
  now?: Date
  minAgeMs?: number
}

export interface SweptObject {
  key: string
  size: number
  kind: 'orphan-file' | 'orphan-thumbnail'
  ageMs: number
}

export interface BucketSweep {
  bucket: string
  objects: number
  referenced: number
  tooYoung: number
  orphans: SweptObject[]
  orphanBytes: number
  staleUploads: { key: string; uploadId: string; ageMs: number }[]
  youngUploads: number
  deleted: number
  aborted: number
  deleteFailures: FailedDelete[]
  abortFailures: { key: string; uploadId: string; message: string }[]
}

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

/** Sweeps one bucket; with `apply: false` it only reports. */
export async function sweepBucket(bucket: string, options: OrphanSweepOptions): Promise<BucketSweep> {
  const now = options.now ?? new Date()
  const minAgeMs = options.minAgeMs ?? ORPHAN_SWEEP_MIN_AGE_MS
  const objects = await listObjects(bucket)
  const fileKeys = new Set(
    (await prisma.file.findMany({ where: { bucket }, select: { key: true } })).map((f) => f.key)
  )
  const thumbnailIds = objects.map((o) => thumbnailItemId(o.key)).filter((id): id is string => id !== null)
  const liveItemIds = await liveItemIdsAmong(thumbnailIds)

  let referenced = 0
  let tooYoung = 0
  const orphans: SweptObject[] = []
  for (const o of objects) {
    const verdict = classifyObject(o, { fileKeys, liveItemIds }, now, minAgeMs)
    if (verdict === 'referenced') referenced++
    else if (verdict === 'too-young') tooYoung++
    else orphans.push({ key: o.key, size: o.size, kind: verdict, ageMs: now.getTime() - o.lastModified.getTime() })
  }

  const uploads = (await s3.send(new ListMultipartUploadsCommand({ Bucket: bucket }))).Uploads ?? []
  const staleUploads = uploads.flatMap((u) =>
    u.Key && u.UploadId && u.Initiated && now.getTime() - u.Initiated.getTime() >= minAgeMs
      ? [{ key: u.Key, uploadId: u.UploadId, ageMs: now.getTime() - u.Initiated.getTime() }]
      : []
  )

  const result: BucketSweep = {
    bucket,
    objects: objects.length,
    referenced,
    tooYoung,
    orphans,
    orphanBytes: orphans.reduce((n, o) => n + o.size, 0),
    staleUploads,
    youngUploads: uploads.length - staleUploads.length,
    deleted: 0,
    aborted: 0,
    deleteFailures: [],
    abortFailures: [],
  }
  if (!options.apply) return result

  const deleted = await deleteObjects(bucket, orphans.map((o) => o.key))
  result.deleted = deleted.deleted
  result.deleteFailures = deleted.failed
  for (const u of staleUploads) {
    try {
      await s3.send(new AbortMultipartUploadCommand({ Bucket: bucket, Key: u.key, UploadId: u.uploadId }))
      result.aborted++
    } catch (error) {
      result.abortFailures.push({ ...u, message: error instanceof Error ? error.message : String(error) })
    }
  }
  return result
}

/** Every bucket a user row names. The schema default `'default-bucket'` means no bucket. */
export async function sweptBuckets(): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: { bucket: { notIn: ['', 'default-bucket'] } },
    select: { bucket: true },
  })
  return [...new Set(users.map((u) => u.bucket).filter((b): b is string => !!b))]
}

/** One scheduled pass over every bucket. A bucket that fails doesn't stop the rest. */
export async function runOrphanSweep(): Promise<void> {
  const now = new Date()
  for (const bucket of await sweptBuckets()) {
    try {
      const s = await sweepBucket(bucket, { apply: true, now })
      const fields = {
        bucket,
        objects: s.objects,
        deleted: s.deleted,
        bytes: s.orphanBytes,
        aborted: s.aborted,
        delete_failures: s.deleteFailures.length,
        abort_failures: s.abortFailures.length,
      }
      // Anything found is a leak worth looking at (an upload never filed, a
      // delete that missed its object): warn, so it reaches Vinktar as an issue.
      if (s.orphans.length || s.staleUploads.length) log.warn('orphan sweep removed unreferenced objects', fields)
      else log.info('orphan sweep found nothing', fields)
    } catch (error) {
      log.error('orphan sweep failed', { bucket, error })
    }
  }
}

const globalForOrphanSweep = globalThis as typeof globalThis & {
  __orphanSweepStarted?: boolean
}

/** Starts this process's sweep schedule once, in production only; later calls do nothing. */
export function ensureOrphanSweep() {
  if (process.env.VITEST || process.env.NODE_ENV !== 'production') return
  if (globalForOrphanSweep.__orphanSweepStarted) return
  globalForOrphanSweep.__orphanSweepStarted = true

  const tick = async () => {
    try {
      await runOrphanSweep()
    } catch (error) {
      log.error('orphan sweep failed', { error })
    }
    // unref: the schedule alone never keeps a process alive
    setTimeout(tick, ORPHAN_SWEEP_INTERVAL_MS).unref()
  }
  // Jittered, so machines started together don't sweep in step.
  setTimeout(tick, ORPHAN_SWEEP_FIRST_DELAY_MS * (1 + Math.random())).unref()
}
