import '@dotenvx/dotenvx/config'
import { PrismaClient } from '../../app/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import {
  e2eIds,
  E2E_WORKERS,
  E2E_ITEM_A_NAME,
  E2E_ITEM_B_NAME,
  E2E_ITEM_C_NAME,
  E2E_ITEM_D_NAME,
  E2E_ITEM_E_NAME,
  E2E_ITEM_F_NAME,
  E2E_ITEM_G_NAME,
  OTHER_USER_ID,
  OTHER_USER_EMAIL,
  OTHER_DRIVE_ID,
  OTHER_PRIVATE_NAME,
  OTHER_SHARED_NAME,
  OTHER_REVOKED_NAME,
  E2E_PIN_ITEM_A_NAME,
  E2E_PIN_ITEM_B_NAME,
  E2E_PIN_ITEM_C_NAME,
} from './constants'
import { ensureE2eBucket } from './e2e-bucket'

/**
 * Signs a cookie value the same way better-auth / better-call does:
 *   signedValue = value + "." + base64(HMAC-SHA256(value, secret))
 *
 * NOTE: Do NOT encodeURIComponent — Playwright sends the value verbatim in
 * the Cookie header, so percent-encoding would break signature verification.
 */
async function signCookieValue(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))
  const base64Sig = Buffer.from(signature).toString('base64')
  return `${value}.${base64Sig}`
}

/** The session file worker `i` signs in with (`session.json` is worker 0's). */
export const sessionFile = (i: number) =>
  path.join(process.cwd(), 'tests/e2e/.auth', i === 0 ? 'session.json' : `session-${i}.json`)

type Prisma = PrismaClient

/** Seeds worker `i`'s user, drive, quota, session, bucket and test items. */
async function seedWorker(prisma: Prisma, i: number, freePlanId: string) {
  const ids = e2eIds(i)
  const {
    TEST_USER_ID,
    TEST_USER_EMAIL,
    E2E_DRIVE_ID,
    E2E_ROOT_FOLDER_ID,
    E2E_QUOTA_ID,
    E2E_SUB_ID,
    E2E_SESSION_ID,
    E2E_GALLERY_IMAGES,
    E2E_GALLERY_COLLECTION,
  } = ids
  // 10 GB in bytes — plenty of room for E2E uploads
  const E2E_STORAGE_LIMIT = BigInt(10 * 1024 * 1024 * 1024)

  // Upsert test user — idempotent, safe to re-run.
  // subscriptionId, driveId, and rootId are required by the upload machine's
  // Zod config schema (z.string()), so we seed them with stable stub values.
  await prisma.user.upsert({
    where: { email: TEST_USER_EMAIL },
    create: {
      id: TEST_USER_ID,
      name: i === 0 ? 'E2E Test User' : `E2E Test User ${i}`,
      email: TEST_USER_EMAIL,
      emailVerified: true,
      // No bucket here: `ensureE2eBucket` below creates a real one, the way
      // onboarding does. A hardcoded name had gone missing on S3 and made
      // every upload test time out.
      storagePlanId: freePlanId,
      subscriptionId: E2E_SUB_ID,
      driveId: E2E_DRIVE_ID,
      rootId: E2E_ROOT_FOLDER_ID,
    },
    update: {
      subscriptionId: E2E_SUB_ID,
      driveId: E2E_DRIVE_ID,
      rootId: E2E_ROOT_FOLDER_ID,
    },
  })

  const e2eBucket = await ensureE2eBucket(prisma, TEST_USER_ID)

  // The user's Drive — required so the quota service can find the user's
  // quota via `drive.ownerId`.
  await prisma.drive.upsert({
    where: { id: E2E_DRIVE_ID },
    create: { id: E2E_DRIVE_ID, ownerId: TEST_USER_ID },
    update: {},
  })

  // The user's quota — required by `find` which the upload machine calls
  // before starting each upload.
  await prisma.quota.upsert({
    where: { id: E2E_QUOTA_ID },
    create: {
      id: E2E_QUOTA_ID,
      driveId: E2E_DRIVE_ID,
      total: E2E_STORAGE_LIMIT,
      used: BigInt(0),
      deleted: BigInt(0),
    },
    update: { used: BigInt(0) },
  })

  // Fresh session every run
  await prisma.session.deleteMany({ where: { userId: TEST_USER_ID } })

  const token = crypto.randomUUID()
  await prisma.session.create({
    data: {
      id: E2E_SESSION_ID,
      token,
      userId: TEST_USER_ID,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  })

  // Seed test items for favorites E2E tests — upserted so re-runs are idempotent.
  // Root folder must exist as an Item record because children reference it via FK.
  await prisma.item.upsert({
    where: { id: E2E_ROOT_FOLDER_ID },
    create: {
      id: E2E_ROOT_FOLDER_ID,
      name: 'E2E Root',
      type: 'folder',
      ownerId: TEST_USER_ID,
      driveId: E2E_DRIVE_ID,
    },
    update: {},
  })

  const itemBase = {
    ownerId: TEST_USER_ID,
    driveId: E2E_DRIVE_ID,
    parentId: E2E_ROOT_FOLDER_ID,
  }
  for (const [id, name] of [
    [ids.E2E_ITEM_A_ID, E2E_ITEM_A_NAME],
    [ids.E2E_ITEM_B_ID, E2E_ITEM_B_NAME],
    [ids.E2E_ITEM_C_ID, E2E_ITEM_C_NAME],
    [ids.E2E_ITEM_D_ID, E2E_ITEM_D_NAME],
    [ids.E2E_ITEM_E_ID, E2E_ITEM_E_NAME],
    [ids.E2E_ITEM_F_ID, E2E_ITEM_F_NAME],
    [ids.E2E_ITEM_G_ID, E2E_ITEM_G_NAME],
  ] as const) {
    await prisma.item.upsert({
      where: { id },
      create: { id, name, ...itemBase },
      update: { name },
    })
  }

  // Three items of the other user for this worker: one never shared, one
  // shared with this worker's user for reading, one shared and then revoked.
  // Favorites are only allowed on — and only listed for — items the user can
  // still read.
  for (const [id, name] of [
    [ids.OTHER_PRIVATE_ID, OTHER_PRIVATE_NAME],
    [ids.OTHER_SHARED_ID, OTHER_SHARED_NAME],
    [ids.OTHER_REVOKED_ID, OTHER_REVOKED_NAME],
  ] as const) {
    await prisma.item.upsert({
      where: { id },
      create: { id, name, ownerId: OTHER_USER_ID, driveId: OTHER_DRIVE_ID, parentId: null },
      update: { name },
    })
  }
  await prisma.permission.deleteMany({
    where: { itemId: { in: [ids.OTHER_SHARED_ID, ids.OTHER_REVOKED_ID] } },
  })
  await prisma.permission.create({
    data: { id: ids.PERM_SHARED_ID, itemId: ids.OTHER_SHARED_ID, roles: 'read', users: { connect: { id: TEST_USER_ID } } },
  })
  await prisma.permission.create({
    data: {
      id: ids.PERM_REVOKED_ID,
      itemId: ids.OTHER_REVOKED_ID,
      roles: 'read',
      deletedAt: new Date(),
      users: { connect: { id: TEST_USER_ID } },
    },
  })

  // Reset favorites. A, E and F start unfavorited; B, C and G favorited; D
  // carries two rows (a duplicate, which Unfavorite must still clear); and
  // the revoked item keeps the row from before its share was revoked.
  await prisma.favorite.deleteMany({
    where: {
      favoritedById: TEST_USER_ID,
      itemId: {
        in: [
          ids.E2E_ITEM_A_ID, ids.E2E_ITEM_B_ID, ids.E2E_ITEM_C_ID, ids.E2E_ITEM_D_ID, ids.E2E_ITEM_E_ID,
          ids.E2E_ITEM_F_ID, ids.E2E_ITEM_G_ID, ids.OTHER_PRIVATE_ID, ids.OTHER_SHARED_ID, ids.OTHER_REVOKED_ID,
        ],
      },
    },
  })
  const fav = ids.FAV_ID_PREFIX
  await prisma.favorite.createMany({
    data: [
      { id: `${fav}bbb`, favoritedById: TEST_USER_ID, itemId: ids.E2E_ITEM_B_ID },
      { id: `${fav}ccc`, favoritedById: TEST_USER_ID, itemId: ids.E2E_ITEM_C_ID },
      { id: `${fav}dd1`, favoritedById: TEST_USER_ID, itemId: ids.E2E_ITEM_D_ID },
      { id: `${fav}dd2`, favoritedById: TEST_USER_ID, itemId: ids.E2E_ITEM_D_ID },
      { id: `${fav}ggg`, favoritedById: TEST_USER_ID, itemId: ids.E2E_ITEM_G_ID },
      { id: `${fav}rvk`, favoritedById: TEST_USER_ID, itemId: ids.OTHER_REVOKED_ID },
    ],
  })

  // Seed pin test items.
  for (const [id, name] of [
    [ids.E2E_PIN_ITEM_A_ID, E2E_PIN_ITEM_A_NAME],
    [ids.E2E_PIN_ITEM_B_ID, E2E_PIN_ITEM_B_NAME],
    [ids.E2E_PIN_ITEM_C_ID, E2E_PIN_ITEM_C_NAME],
  ] as const) {
    await prisma.item.upsert({
      where: { id },
      create: { id, name, ...itemBase },
      update: { name },
    })
  }

  // Reset pins: A starts unpinned, B starts pre-pinned (the toggle-off test
  // unpins it), C starts pre-pinned and is never toggled (the list test).
  await prisma.pinItem.deleteMany({
    where: {
      pinnedById: TEST_USER_ID,
      itemId: { in: [ids.E2E_PIN_ITEM_A_ID, ids.E2E_PIN_ITEM_B_ID, ids.E2E_PIN_ITEM_C_ID] },
    },
  })
  const pin = ids.PIN_ID_PREFIX
  await prisma.pinItem.createMany({
    data: [
      { id: `${pin}bbb`, pinnedById: TEST_USER_ID, itemId: ids.E2E_PIN_ITEM_B_ID, position: 0 },
      { id: `${pin}ccc`, pinnedById: TEST_USER_ID, itemId: ids.E2E_PIN_ITEM_C_ID, position: 1 },
    ],
  })

  // Seed the Images gallery: three active images with fixed dates, a stage-2
  // thumbnail each, and no pins. Status and dates reset every run, so a test
  // that trashed or pinned one starts clean next time.
  for (const img of E2E_GALLERY_IMAGES) {
    const createdAt = new Date(Date.now() - img.daysAgo * 86_400_000)
    await prisma.item.upsert({
      where: { id: img.id },
      create: {
        id: img.id,
        name: img.name,
        type: 'file',
        category: 'image',
        size: 2_000_000,
        createdAt,
        ...itemBase,
      },
      update: { name: img.name, status: 'normal', createdAt, category: 'image' },
    })
    await prisma.thumbnail.upsert({
      where: { itemId_view_size: { itemId: img.id, view: 'grid', size: 'medium' } },
      create: {
        id: `thumb_${img.id}`,
        itemId: img.id,
        view: 'grid',
        size: 'medium',
        stage: 2,
        bucket: 'e2e-gallery',
        // Real uploads store one 512×512 grid thumbnail; the real size lives
        // on the Image facet below. The tests check tiles follow the facet.
        width: 512,
        height: 512,
      },
      update: { stage: 2, bucket: 'e2e-gallery', width: 512, height: 512 },
    })
    await prisma.image.upsert({
      where: { itemId: img.id },
      create: { id: `img_${img.id}`, itemId: img.id, width: img.width, height: img.height },
      update: { width: img.width, height: img.height },
    })
  }
  await prisma.pinItem.deleteMany({
    where: { pinnedById: TEST_USER_ID, itemId: { in: E2E_GALLERY_IMAGES.map((img) => img.id) } },
  })
  // Real objects behind the gallery images, so Download has bytes to fetch.
  // The teardown empties and deletes the bucket.
  {
    const { s3 } = await import('../../app/.server/s3')
    const { PutObjectCommand } = await import('@aws-sdk/client-s3')
    for (const img of E2E_GALLERY_IMAGES) {
      const key = `e2e-gallery/${img.id}.png`
      await s3.send(
        new PutObjectCommand({
          Bucket: e2eBucket,
          Key: key,
          Body: Buffer.from(`e2e gallery bytes for ${img.name}`),
          ContentType: 'image/png',
        })
      )
      await prisma.file.upsert({
        where: { itemId: img.id },
        create: { id: `file_${img.id}`, itemId: img.id, bucket: e2eBucket, key, uploadPath: img.name, mimeType: 'image/png', extension: 'png' },
        update: { bucket: e2eBucket, key },
      })
    }
  }
  // A collection the gallery's "Add to collection" can target, emptied each run.
  await prisma.item.upsert({
    where: { id: E2E_GALLERY_COLLECTION.id },
    create: { id: E2E_GALLERY_COLLECTION.id, name: E2E_GALLERY_COLLECTION.name, type: 'collection', ownerId: TEST_USER_ID, driveId: E2E_DRIVE_ID, parentId: null },
    update: { name: E2E_GALLERY_COLLECTION.name, status: 'normal' },
  })
  await prisma.collectionMember.deleteMany({ where: { collectionId: E2E_GALLERY_COLLECTION.id } })

  // Write Playwright storageState — better-auth reads `better-auth.session_token` cookie
  // and validates it as a signed cookie (HMAC-SHA256 with BETTER_AUTH_SECRET).
  // The cookie value must be token + "." + base64(HMAC-SHA256(token, secret)) — raw, not percent-encoded.
  const signedToken = await signCookieValue(token, process.env.BETTER_AUTH_SECRET!)
  await mkdir(path.dirname(sessionFile(i)), { recursive: true })
  await writeFile(
    sessionFile(i),
    JSON.stringify(
      {
        cookies: [
          {
            name: 'better-auth.session_token',
            value: signedToken,
            domain: 'localhost',
            path: '/',
            httpOnly: true,
            secure: false,
            sameSite: 'Lax',
          },
        ],
        origins: [],
      },
      null,
      2,
    ),
  )
}

export default async function globalSetup() {
  if (!process.env.DATABASE_URL) throw new Error('[E2E] DATABASE_URL is not set — check your .env file')
  if (!process.env.BETTER_AUTH_SECRET) throw new Error('[E2E] BETTER_AUTH_SECRET is not set — check your .env file')

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
  const prisma = new PrismaClient({ adapter })

  try {
    // Ensure a free storage plan exists — layout loader requires it
    const freePlan = await prisma.storagePlan.findFirst({ where: { type: 'free' } })
    if (!freePlan) {
      throw new Error(
        '[E2E] No free storage plan found in database. Run `pnpm prisma migrate dev` and seed storage plans first.'
      )
    }

    // A second user, for access control: it owns each worker's three items,
    // shared with that worker's user or not. One for everyone, created before
    // the workers' seeds reference it.
    await prisma.user.upsert({
      where: { email: OTHER_USER_EMAIL },
      create: { id: OTHER_USER_ID, name: 'E2E Other User', email: OTHER_USER_EMAIL, emailVerified: true },
      update: {},
    })
    await prisma.drive.upsert({
      where: { id: OTHER_DRIVE_ID },
      create: { id: OTHER_DRIVE_ID, ownerId: OTHER_USER_ID },
      update: {},
    })

    // One user per worker, seeded side by side: the rows are disjoint, and the
    // bucket creation each one waits on is a network call.
    await Promise.all(
      Array.from({ length: E2E_WORKERS }, (_, i) => seedWorker(prisma, i, freePlan.id))
    )
  } finally {
    await prisma.$disconnect()
  }
}
