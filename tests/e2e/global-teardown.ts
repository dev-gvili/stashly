import '@dotenvx/dotenvx/config'
import { HeadBucketCommand } from '@aws-sdk/client-s3'
import { PrismaClient } from '../../app/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { OTHER_USER_EMAIL, TEST_USER_EMAIL } from './constants'

/** The `User.bucket` column's default, shared by every user without one. */
const PLACEHOLDER_BUCKET = 'default-bucket'

export default async function globalTeardown() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
  const prisma = new PrismaClient({ adapter })

  try {
    // Deleting the users drops their rows but not the bucket `e2e-bucket.ts`
    // created, and the next run creates a new one, so every run left one
    // bucket behind (tech-debt item 20). Delete it first, while the row still
    // names it. Only the E2E user's: the other seeded user keeps the schema's
    // placeholder, a name a real bucket could carry.
    const user = await prisma.user.findUnique({
      where: { email: TEST_USER_EMAIL },
      select: { bucket: true },
    })
    if (user && user.bucket !== PLACEHOLDER_BUCKET) await deleteE2eBucket(user.bucket)

    await prisma.user.deleteMany({
      where: { email: { in: [TEST_USER_EMAIL, OTHER_USER_EMAIL] } },
    })
  } finally {
    await prisma.$disconnect()
  }
}

/**
 * Empties and deletes the bucket, if it exists. A failed delete is reported,
 * not thrown: the tests have already run, and a leftover bucket must not turn
 * a green run red.
 */
async function deleteE2eBucket(bucket: string) {
  // Imported here, not at the top: the S3 client reads its credentials from
  // the environment when the module loads, after dotenv has run.
  const { s3, deleteBucket } = await import('../../app/.server/s3')

  const exists = await s3
    .send(new HeadBucketCommand({ Bucket: bucket }))
    .then(() => true)
    .catch(() => false)
  if (!exists) return
  try {
    await deleteBucket(bucket)
    console.log(`[E2E] deleted bucket ${bucket}`)
  } catch (error) {
    console.warn(`[E2E] could not delete bucket ${bucket}`, error)
  }
}
