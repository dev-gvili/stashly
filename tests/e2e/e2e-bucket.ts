/**
 * Makes sure the E2E user has a real S3 bucket before any test runs.
 *
 * The user used to be seeded with a hardcoded bucket name that no longer
 * existed, so every upload failed at `createMultipartUpload` with NoSuchBucket
 * and every upload test timed out waiting for a thumbnail, which read as a
 * pipeline bug. Real users get their bucket from onboarding; the seeded E2E
 * user never goes through it, so this does the same step onboarding does
 * (`createUserBucket`: a private bucket plus the CORS policy browser PUTs
 * need), once, and stores the name on the user row. Later runs find it with a
 * `HeadBucket` and create nothing.
 */
import { HeadBucketCommand } from '@aws-sdk/client-s3'
import type { PrismaClient } from '../../app/prisma/client'

/**
 * Returns the E2E user's bucket, creating it on the first run.
 *
 * @throws When the bucket can't be created, with the reason, so setup fails
 *   once and clearly instead of as one timeout per upload test.
 */
export async function ensureE2eBucket(
  prisma: PrismaClient,
  userId: string
): Promise<string> {
  // Imported here, not at the top: the S3 client reads its credentials from
  // the environment when the module loads, after dotenv has run.
  const { s3, createUserBucket } = await import('../../app/.server/s3')

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
  const exists = await s3
    .send(new HeadBucketCommand({ Bucket: user.bucket }))
    .then(() => true)
    .catch(() => false)
  if (exists) return user.bucket

  const bucket = await createUserBucket(user)
  await prisma.user.update({ where: { id: userId }, data: { bucket } })
  console.log(`[E2E] created bucket ${bucket} for the E2E user (was ${user.bucket})`)
  return bucket
}
