import '@dotenvx/dotenvx/config'
import { DeleteBucketCommand, HeadBucketCommand } from '@aws-sdk/client-s3'
import { PrismaClient } from '../../app/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { OTHER_USER_EMAIL, e2eIds } from './constants'

/** Every worker's user, up to the 9 `e2eIds` can name: a leftover from a run with more workers goes too. */
const WORKER_EMAILS = Array.from({ length: 9 }, (_, i) => e2eIds(i).TEST_USER_EMAIL)

/** The `User.bucket` column's default, shared by every user without one. */
const PLACEHOLDER_BUCKET = 'default-bucket'
const DELETE_ATTEMPTS = 5
const DELETE_RETRY_MS = 3_000

export default async function globalTeardown() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
  const prisma = new PrismaClient({ adapter })

  try {
    // Deleting the users drops their rows but not the bucket `e2e-bucket.ts`
    // created, and the next run creates a new one, so every run left one
    // bucket behind (tech-debt item 20). Delete it first, while the row still
    // names it. Only the E2E user's: the other seeded user keeps the schema's
    // placeholder, a name a real bucket could carry.
    const users = await prisma.user.findMany({
      where: { email: { in: WORKER_EMAILS } },
      select: { bucket: true },
    })
    await Promise.all(
      users
        .filter((user) => user.bucket !== PLACEHOLDER_BUCKET)
        .map((user) => deleteE2eBucket(user.bucket))
    )

    // Empty the users' collections in a statement of their own first. Left to
    // the user cascade, deleting a collection and its members in one statement
    // makes the collection-sync trigger update a row that same statement is
    // deleting, and Postgres aborts it (27000; see `wipe-test-users.ts`). The
    // gallery spec's "Add to collection" leaves a member behind.
    await prisma.collectionMember.deleteMany({
      where: {
        collection: { owner: { email: { in: [...WORKER_EMAILS, OTHER_USER_EMAIL] } } },
      },
    })

    await prisma.user.deleteMany({
      where: { email: { in: [...WORKER_EMAILS, OTHER_USER_EMAIL] } },
    })
  } finally {
    await prisma.$disconnect()
  }
}

/**
 * Empties and deletes the bucket, if it exists, trying up to
 * `DELETE_ATTEMPTS` times. Tigris can answer `BucketNotEmpty` just after the
 * last object was deleted: the first CI run (`85f85b9`) failed that way, and
 * the same bucket listed 0 objects, 0 multipart uploads and 0 versions
 * minutes later. Each attempt empties the bucket again, then deletes it.
 * The delete is sent here rather than through `deleteBucket`, which logs every
 * failure at error level: an expected `BucketNotEmpty` that the next attempt
 * clears printed `[error] S3 bucket delete failed` in green CI runs.
 * Only the last attempt's failure is reported, and not thrown: the tests have
 * already run, and a leftover bucket must not turn a green run red.
 */
async function deleteE2eBucket(bucket: string) {
  // Imported here, not at the top: the S3 client reads its credentials from
  // the environment when the module loads, after dotenv has run.
  const { s3, emptyBucket } = await import('../../app/.server/s3')

  const exists = await s3
    .send(new HeadBucketCommand({ Bucket: bucket }))
    .then(() => true)
    .catch(() => false)
  if (!exists) return
  for (let attempt = 1; attempt <= DELETE_ATTEMPTS; attempt++) {
    try {
      await emptyBucket(bucket)
      await s3.send(new DeleteBucketCommand({ Bucket: bucket }))
      console.log(`[E2E] deleted bucket ${bucket} (attempt ${attempt})`)
      return
    } catch (error) {
      if (attempt === DELETE_ATTEMPTS) {
        console.warn(`[E2E] could not delete bucket ${bucket}`, error)
        return
      }
      await new Promise((resolve) => setTimeout(resolve, DELETE_RETRY_MS))
    }
  }
}
