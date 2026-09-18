/**
 * One-off: make every existing thumbnail private again.
 *
 * Thumbnails used to be uploaded with `ACL: 'public-read'` and read from an
 * unsigned `t3.tigrisfiles.io` URL. Reads are signed now, so those objects are
 * still anonymously readable for no reason. This script closes that:
 *
 *   1. `PutObjectAcl private` on every `thumbnails/*` object in each bucket.
 *   2. Turns the bucket's `allow_object_acl` flag off, so Tigris stops serving
 *      object ACLs at all — including one a client sets with an unsigned
 *      `x-amz-acl` header on a presigned PUT.
 *
 * **Run it only after the signed-read code is deployed.** Between the sweep and
 * the deploy, every thumbnail 403s.
 *
 * Dry run (default) only reports what it would touch:
 *   npx tsx --env-file=.env scripts/sweep-thumbnail-acls.ts
 * Apply:
 *   npx tsx --env-file=.env scripts/sweep-thumbnail-acls.ts --apply
 */
import {
  ListObjectsV2Command,
  PutObjectAclCommand,
  GetObjectAclCommand,
} from '@aws-sdk/client-s3'
import { prisma } from '@/services/db'
import { s3, isObjectAclEnabled, setObjectAclEnabled } from '@/services/s3'

const APPLY = process.argv.includes('--apply')

/** Every bucket that currently holds thumbnails, from the users table. */
async function bucketsToSweep(): Promise<string[]> {
  const users = await prisma.user.findMany({
    select: { bucket: true },
    where: { bucket: { not: '' } },
  })
  return [...new Set(users.map((u) => u.bucket).filter(Boolean))]
}

async function sweepBucket(bucket: string) {
  let token: string | undefined
  let total = 0
  let publicCount = 0
  let madePrivate = 0

  do {
    const page = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: 'thumbnails/',
        ContinuationToken: token,
      })
    )
    for (const object of page.Contents ?? []) {
      if (!object.Key) continue
      total++
      const acl = await s3.send(
        new GetObjectAclCommand({ Bucket: bucket, Key: object.Key })
      )
      const isPublic = (acl.Grants ?? []).some(
        (grant) =>
          grant.Grantee?.URI?.endsWith('/AllUsers') && grant.Permission === 'READ'
      )
      if (!isPublic) continue
      publicCount++
      if (APPLY) {
        await s3.send(
          new PutObjectAclCommand({
            Bucket: bucket,
            Key: object.Key,
            ACL: 'private',
          })
        )
        madePrivate++
      }
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined
  } while (token)

  const flagWasOn = await isObjectAclEnabled(bucket)
  if (APPLY && flagWasOn) await setObjectAclEnabled(bucket, false)

  console.log(
    JSON.stringify({
      bucket,
      thumbnails: total,
      publicBefore: publicCount,
      madePrivate,
      objectAclFlagBefore: flagWasOn,
      objectAclFlagAfter: APPLY ? false : flagWasOn,
    })
  )
}

async function main() {
  const buckets = await bucketsToSweep()
  console.log(APPLY ? '# APPLYING' : '# DRY RUN — pass --apply to make changes')
  console.log(`# ${buckets.length} bucket(s)`)
  for (const bucket of buckets) {
    try {
      await sweepBucket(bucket)
    } catch (error) {
      console.error(`FAILED ${bucket}:`, error)
    }
  }
  await prisma.$disconnect()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
