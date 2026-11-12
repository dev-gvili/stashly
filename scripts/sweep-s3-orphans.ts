/**
 * Removes S3 objects that nothing in the database references, and aborts
 * multipart uploads that were started and never finished.
 *
 * The production server runs this sweep itself every 6 hours
 * (`ensureOrphanSweep` in app/.server/s3-orphan-sweep.ts, tech-debt item 59),
 * which holds the logic and the rules. This script is the manual way in: a dry
 * run to see what it would do, or a run on demand, against any database (the
 * scheduled one is production only).
 *
 * Dry run (default) prints every key it would act on and changes nothing:
 *   npx tsx --env-file=.env scripts/sweep-s3-orphans.ts
 * Apply:
 *   npx tsx --env-file=.env scripts/sweep-s3-orphans.ts --apply
 * Age floor in hours (default 24):
 *   npx tsx --env-file=.env scripts/sweep-s3-orphans.ts --min-age-hours=48
 */
import { prisma } from '@/services/db'
import { sweepBucket, sweptBuckets } from '@/services/s3-orphan-sweep'

const APPLY = process.argv.includes('--apply')
const ageArg = process.argv.find((a) => a.startsWith('--min-age-hours='))
const MIN_AGE_HOURS = ageArg ? Number(ageArg.split('=')[1]) : 24
if (!Number.isFinite(MIN_AGE_HOURS) || MIN_AGE_HOURS < 1) {
  console.error('--min-age-hours must be a number >= 1')
  process.exit(1)
}

const hours = (ms: number) => Math.round(ms / 3600_000)

async function main() {
  const buckets = await sweptBuckets()
  const now = new Date()
  console.log(APPLY ? '# APPLYING' : '# DRY RUN — pass --apply to make changes')
  console.log(`# ${buckets.length} bucket(s), age floor ${MIN_AGE_HOURS} h`)
  let failedBuckets = 0
  for (const bucket of buckets) {
    console.log(`# ${bucket}`)
    try {
      const s = await sweepBucket(bucket, { apply: APPLY, now, minAgeMs: MIN_AGE_HOURS * 3600_000 })
      for (const o of s.orphans) {
        console.log(`  ${APPLY ? 'delete' : 'would delete'} ${o.kind} ${o.key} (${o.size} B, ${hours(o.ageMs)} h old)`)
      }
      for (const u of s.staleUploads) {
        console.log(`  ${APPLY ? 'abort' : 'would abort'} multipart ${u.key} (${hours(u.ageMs)} h old)`)
      }
      console.log(
        JSON.stringify({
          bucket,
          objects: s.objects,
          referenced: s.referenced,
          'too-young': s.tooYoung,
          'orphan-file': s.orphans.filter((o) => o.kind === 'orphan-file').length,
          'orphan-thumbnail': s.orphans.filter((o) => o.kind === 'orphan-thumbnail').length,
          orphanBytes: s.orphanBytes,
          staleMultipartUploads: s.staleUploads.length,
          youngMultipartUploads: s.youngUploads,
          ...(APPLY && { deleted: s.deleted, aborted: s.aborted, deleteFailures: s.deleteFailures, abortFailures: s.abortFailures }),
        })
      )
      if (APPLY && (s.deleteFailures.length || s.abortFailures.length)) failedBuckets++
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
