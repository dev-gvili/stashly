import '@dotenvx/dotenvx/config'
import { test, expect } from '@playwright/test'
import type { PrismaClient } from '../../app/prisma/client'

/**
 * A user whose bucket was deleted outside the app (dev-gvili, 15 Nov) gets a
 * new one when they sign in, and every row that named the old bucket moves to
 * it. Runs against real Tigris and the real database, no stand-ins: CI's e2e
 * job has the Tigris keys, the unit job doesn't (the database half is covered
 * by `app/.server/__tests__/user-bucket-repair.test.ts`).
 *
 * The sign-in itself is OAuth, which no test can complete against a real
 * provider, so the third test calls the app's own after-hook with the context
 * a successful `/callback/github` hands it, and reads the cookies it answers.
 */

// The app modules read their credentials when they load, after dotenv ran.
const app = async () => {
  const [{ prisma }, s3mod, storage, { auth }, cookies, sdk] = await Promise.all([
    import('../../app/.server/db'),
    import('../../app/.server/s3'),
    import('../../app/.server/storage-actions'),
    import('../../app/.server/auth'),
    import('better-auth/cookies'),
    import('@aws-sdk/client-s3'),
  ])
  return { prisma: prisma as unknown as PrismaClient, ...s3mod, ...storage, auth, ...cookies, sdk }
}

const RUN = Math.random().toString(36).slice(2, 8)
/** Bucket names start with the cleaned user name, so this run's are easy to list. */
const USER_NAME = `repaire2e${RUN}`
const id = (prefix: string) => `${prefix}_e2e${RUN}${Math.random().toString(36).slice(2, 10)}`

const userIds: string[] = []
const bucketsToDrop = new Set<string>()

async function bucketExists(name: string) {
  const { s3, sdk } = await app()
  return s3.send(new sdk.HeadBucketCommand({ Bucket: name })).then(
    () => true,
    () => false
  )
}

async function runBuckets() {
  const { s3, sdk } = await app()
  const { Buckets = [] } = await s3.send(new sdk.ListBucketsCommand({}))
  return Buckets.map((b) => b.Name!).filter((n) => n.startsWith(`stashly-${USER_NAME}-`))
}

/** A user with a real bucket, a drive named after it and one file with a thumbnail in it. */
async function seedUser() {
  const { prisma, createUserBucket } = await app()
  const userId = id('usr')
  const driveId = id('drv')
  const itemId = id('item')
  const now = new Date()
  const bucket = await createUserBucket({ id: userId, name: USER_NAME, email: `${userId}@test.local`, emailVerified: true, createdAt: now, updatedAt: now })
  bucketsToDrop.add(bucket)
  await prisma.user.create({ data: { id: userId, name: USER_NAME, email: `${userId}@test.local`, emailVerified: true, bucket } })
  userIds.push(userId)
  await prisma.drive.create({ data: { id: driveId, ownerId: userId, name: bucket } })
  await prisma.user.update({ where: { id: userId }, data: { driveId } })
  await prisma.item.create({
    data: { id: itemId, name: 'report.pdf', type: 'file', category: 'document', status: 'normal', ownerId: userId, driveId, size: 1 },
  })
  await prisma.file.create({ data: { id: id('file'), itemId, bucket, key: `item_root/${itemId}.pdf`, uploadPath: 'report.pdf' } })
  await prisma.thumbnail.create({ data: { id: id('thumb'), itemId, bucket, stage: 2 } })
  return { userId, driveId, itemId, bucket }
}

async function deleteBucketNow(name: string) {
  const { s3, sdk, emptyBucket } = await app()
  await emptyBucket(name)
  await s3.send(new sdk.DeleteBucketCommand({ Bucket: name }))
}

test.describe.configure({ mode: 'serial' })

test.afterAll(async () => {
  const { prisma } = await app()
  // Tigris can answer BucketNotEmpty just after a bucket was emptied (teardown).
  for (const bucket of bucketsToDrop) {
    for (let attempt = 0; attempt < 5; attempt++) {
      if (!(await bucketExists(bucket))) break
      await deleteBucketNow(bucket).catch(() => new Promise((r) => setTimeout(r, 3_000)))
    }
  }
  await prisma.thumbnail.deleteMany({ where: { item: { ownerId: { in: userIds } } } })
  await prisma.file.deleteMany({ where: { item: { ownerId: { in: userIds } } } })
  await prisma.item.deleteMany({ where: { ownerId: { in: userIds } } })
  await prisma.session.deleteMany({ where: { userId: { in: userIds } } })
  await prisma.user.updateMany({ where: { id: { in: userIds } }, data: { driveId: null } })
  await prisma.drive.deleteMany({ where: { ownerId: { in: userIds } } })
  await prisma.user.deleteMany({ where: { id: { in: userIds } } })
})

test('a deleted bucket is recreated and every row moves to the new one', async () => {
  test.setTimeout(60_000)
  const { prisma, ensureUserBucket, s3, sdk } = await app()
  const seeded = await seedUser()
  await deleteBucketNow(seeded.bucket)
  expect(await bucketExists(seeded.bucket)).toBe(false)

  const check = await ensureUserBucket({ id: seeded.userId, name: USER_NAME, email: 'x@test.local', bucket: seeded.bucket })

  expect(check).toMatchObject({ status: 'recreated', previous: seeded.bucket, rows: { users: 1, files: 1, thumbnails: 1, drives: 1 } })
  const fresh = (check as { bucket: string }).bucket
  bucketsToDrop.add(fresh)
  expect(fresh).not.toBe(seeded.bucket)
  expect(await bucketExists(fresh)).toBe(true)
  // The CORS rules browser uploads need come with it (createUserBucket).
  const cors = await s3.send(new sdk.GetBucketCorsCommand({ Bucket: fresh }))
  expect(cors.CORSRules?.length).toBeGreaterThan(0)

  expect((await prisma.user.findUniqueOrThrow({ where: { id: seeded.userId } })).bucket).toBe(fresh)
  expect((await prisma.drive.findUniqueOrThrow({ where: { id: seeded.driveId } })).name).toBe(fresh)
  expect((await prisma.file.findFirstOrThrow({ where: { itemId: seeded.itemId } })).bucket).toBe(fresh)
  expect((await prisma.thumbnail.findFirstOrThrow({ where: { itemId: seeded.itemId } })).bucket).toBe(fresh)

  // A healthy bucket now: the next check makes nothing.
  const before = await runBuckets()
  expect(await ensureUserBucket({ id: seeded.userId, name: USER_NAME, email: 'x@test.local', bucket: fresh })).toEqual({ status: 'ok', bucket: fresh })
  expect(await runBuckets()).toEqual(before)
})

test('a sign-in that lost the race drops its duplicate bucket and reports the winner', async () => {
  test.setTimeout(60_000)
  const { prisma, ensureUserBucket } = await app()
  const seeded = await seedUser()
  await deleteBucketNow(seeded.bucket)
  const first = await ensureUserBucket({ id: seeded.userId, name: USER_NAME, email: 'x@test.local', bucket: seeded.bucket })
  const winner = (first as { bucket: string }).bucket
  bucketsToDrop.add(winner)
  const before = await runBuckets()

  // A second process still holding the old session user: its HeadBucket 404s,
  // it creates a bucket, and the repoint finds the row already moved.
  const late = await ensureUserBucket({ id: seeded.userId, name: USER_NAME, email: 'x@test.local', bucket: seeded.bucket })

  expect(late).toEqual({ status: 'ok', bucket: winner })
  expect(await runBuckets()).toEqual(before)
  expect((await prisma.user.findUniqueOrThrow({ where: { id: seeded.userId } })).bucket).toBe(winner)
})

test('the sign-in hook writes the new bucket into the session cookie', async () => {
  test.setTimeout(60_000)
  const { prisma, auth, getCookieCache } = await app()
  const authContext = await auth.$context
  const hook = auth.options.hooks!.after! as unknown as (ctx: unknown) => Promise<{ headers: Headers }>
  /** The hook as a successful GitHub callback calls it, for a user created `ageMs` ago. */
  async function signIn(bucket: string, ageMs: number) {
    const userId = id('usr')
    const createdAt = new Date(Date.now() - ageMs)
    const user = await prisma.user.create({
      data: { id: userId, name: USER_NAME, email: `${userId}@test.local`, emailVerified: true, bucket, createdAt },
    })
    userIds.push(userId)
    const now = new Date()
    const session = await prisma.session.create({
      data: { id: id('ses'), userId, token: id('tok'), expiresAt: new Date(Date.now() + 3_600_000), createdAt: now, updatedAt: now },
    })
    const { headers } = await hook({
      path: '/callback/github',
      params: { id: 'github' },
      method: 'GET',
      headers: new Headers(),
      request: new Request('http://localhost/api/auth/callback/github'),
      context: { ...authContext, newSession: { session, user }, returned: undefined },
      returnHeaders: true,
    })
    return { userId, headers }
  }

  // An account made during this callback skips the check: onboarding just
  // made its bucket. (This one names a dead bucket on purpose.)
  const brandNew = await signIn(`stashly-${USER_NAME}-new${RUN}`, 0)
  expect((await prisma.user.findUniqueOrThrow({ where: { id: brandNew.userId } })).bucket).toBe(`stashly-${USER_NAME}-new${RUN}`)
  expect(brandNew.headers.getSetCookie().map((c) => c.split('=')[0])).toEqual(['last-account'])

  const dead = `stashly-${USER_NAME}-gone${RUN}`
  const { userId, headers } = await signIn(dead, 5 * 60_000)

  const row = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
  bucketsToDrop.add(row.bucket)
  expect(row.bucket).not.toBe(dead)
  expect(await bucketExists(row.bucket)).toBe(true)

  const setCookies = headers.getSetCookie()
  expect(setCookies.map((c) => c.split('=')[0])).toEqual(
    expect.arrayContaining(['last-account', 'better-auth.session_token', 'better-auth.session_data'])
  )
  const cookie = setCookies.map((c) => c.split(';')[0]).join('; ')
  const cached = await getCookieCache(new Headers({ cookie }), { secret: authContext.secret, strategy: 'jwe' })
  expect((cached?.user as { bucket?: string } | undefined)?.bucket).toBe(row.bucket)
})

test('a browser upload lands in the recreated bucket', async ({ page }) => {
  test.setTimeout(60_000)
  const { ensureUserBucket, getPresignedUrl, s3, sdk } = await app()
  const seeded = await seedUser()
  await deleteBucketNow(seeded.bucket)
  const check = await ensureUserBucket({ id: seeded.userId, name: USER_NAME, email: 'x@test.local', bucket: seeded.bucket })
  const fresh = (check as { bucket: string }).bucket
  bucketsToDrop.add(fresh)

  // A direct PUT from the app's origin, the way the upload machine sends parts.
  const key = `item_root/e2e-${RUN}.txt`
  const url = await getPresignedUrl(fresh, 'put', key, 300)
  await page.goto('/auth/sign-in')
  const status = await page.evaluate(
    async (putUrl) => (await fetch(putUrl, { method: 'PUT', body: 'repaired bucket works' })).status,
    url
  )

  expect(status).toBe(200)
  const head = await s3.send(new sdk.HeadObjectCommand({ Bucket: fresh, Key: key }))
  expect(head.ContentLength).toBe('repaired bucket works'.length)
})
