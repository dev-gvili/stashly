import '@dotenvx/dotenvx/config'
import { PrismaClient } from '../../app/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import {
  TEST_USER_ID,
  TEST_USER_EMAIL,
  E2E_ITEM_A_ID,
  E2E_ITEM_B_ID,
  E2E_ITEM_C_ID,
  E2E_ITEM_D_ID,
  E2E_ITEM_E_ID,
  E2E_ITEM_F_ID,
  E2E_ITEM_G_ID,
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
  OTHER_PRIVATE_ID,
  OTHER_SHARED_ID,
  OTHER_REVOKED_ID,
  OTHER_PRIVATE_NAME,
  OTHER_SHARED_NAME,
  OTHER_REVOKED_NAME,
  E2E_ROOT_FOLDER_ID,
  E2E_DRIVE_ID,
  E2E_PIN_ITEM_A_ID,
  E2E_PIN_ITEM_B_ID,
  E2E_PIN_ITEM_C_ID,
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

    const E2E__ID = 'quo_e2e_test_000000'
    const E2E_ROOT_ID = 'root_e2e_test_000000'
    const E2E_SUB_ID = 'sub_e2e_test_000000'
    // 10 GB in bytes — plenty of  for E2E uploads
    const E2E_STORAGE_LIMIT = BigInt(10 * 1024 * 1024 * 1024)

    // Upsert test user — idempotent, safe to re-run.
    // subscriptionId, driveId, and rootId are required by the upload machine's
    // Zod config schema (z.string()), so we seed them with stable stub values.
    await prisma.user.upsert({
      where: { email: TEST_USER_EMAIL },
      create: {
        id: TEST_USER_ID,
        name: 'E2E Test User',
        email: TEST_USER_EMAIL,
        emailVerified: true,
        // No bucket here: `ensureE2eBucket` below creates a real one, the way
        // onboarding does. A hardcoded name had gone missing on S3 and made
        // every upload test time out.
        storagePlanId: freePlan.id,
        subscriptionId: E2E_SUB_ID,
        driveId: E2E_DRIVE_ID,
        rootId: E2E_ROOT_ID,
      },
      update: {
        subscriptionId: E2E_SUB_ID,
        driveId: E2E_DRIVE_ID,
        rootId: E2E_ROOT_ID,
      },
    })

    await ensureE2eBucket(prisma, TEST_USER_ID)

    // Upsert the test user's Drive — required so the  service can find
    // the user's  via `drive.ownerId`.
    await prisma.drive.upsert({
      where: { id: E2E_DRIVE_ID },
      create: { id: E2E_DRIVE_ID, ownerId: TEST_USER_ID },
      update: {},
    })

    // Upsert the test user's  — required by `find` which the upload
    // machine calls before starting each upload.
    await prisma.quota.upsert({
      where: { id: E2E__ID },
      create: {
        id: E2E__ID,
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
        id: `ses_e2e_test_fixed_id_00000`,
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

    // Item A: unfavorited (toggle-on test)
    // Item B: pre-favorited (toggle-off test)
    // Item C: pre-favorited (listing test)
    const itemBase = {
      ownerId: TEST_USER_ID,
      driveId: E2E_DRIVE_ID,
      parentId: E2E_ROOT_FOLDER_ID,
    }
    await prisma.item.upsert({
      where: { id: E2E_ITEM_A_ID },
      create: { id: E2E_ITEM_A_ID, name: E2E_ITEM_A_NAME, ...itemBase },
      update: { name: E2E_ITEM_A_NAME },
    })
    await prisma.item.upsert({
      where: { id: E2E_ITEM_B_ID },
      create: { id: E2E_ITEM_B_ID, name: E2E_ITEM_B_NAME, ...itemBase },
      update: { name: E2E_ITEM_B_NAME },
    })
    await prisma.item.upsert({
      where: { id: E2E_ITEM_C_ID },
      create: { id: E2E_ITEM_C_ID, name: E2E_ITEM_C_NAME, ...itemBase },
      update: { name: E2E_ITEM_C_NAME },
    })

    for (const [id, name] of [
      [E2E_ITEM_D_ID, E2E_ITEM_D_NAME],
      [E2E_ITEM_E_ID, E2E_ITEM_E_NAME],
      [E2E_ITEM_F_ID, E2E_ITEM_F_NAME],
      [E2E_ITEM_G_ID, E2E_ITEM_G_NAME],
    ] as const) {
      await prisma.item.upsert({
        where: { id },
        create: { id, name, ...itemBase },
        update: { name },
      })
    }

    // A second user owning three items: one never shared, one shared with the
    // E2E user for reading, one shared and then revoked. Favorites are only
    // allowed on — and only listed for — items the user can still read.
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
    for (const [id, name] of [
      [OTHER_PRIVATE_ID, OTHER_PRIVATE_NAME],
      [OTHER_SHARED_ID, OTHER_SHARED_NAME],
      [OTHER_REVOKED_ID, OTHER_REVOKED_NAME],
    ] as const) {
      await prisma.item.upsert({
        where: { id },
        create: { id, name, ownerId: OTHER_USER_ID, driveId: OTHER_DRIVE_ID, parentId: null },
        update: { name },
      })
    }
    await prisma.permission.deleteMany({
      where: { itemId: { in: [OTHER_SHARED_ID, OTHER_REVOKED_ID] } },
    })
    await prisma.permission.create({
      data: { id: 'perm_e2e_oth_shared', itemId: OTHER_SHARED_ID, roles: 'read', users: { connect: { id: TEST_USER_ID } } },
    })
    await prisma.permission.create({
      data: {
        id: 'perm_e2e_oth_revoked',
        itemId: OTHER_REVOKED_ID,
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
            E2E_ITEM_A_ID, E2E_ITEM_B_ID, E2E_ITEM_C_ID, E2E_ITEM_D_ID, E2E_ITEM_E_ID,
            E2E_ITEM_F_ID, E2E_ITEM_G_ID, OTHER_PRIVATE_ID, OTHER_SHARED_ID, OTHER_REVOKED_ID,
          ],
        },
      },
    })
    await prisma.favorite.createMany({
      data: [
        { id: 'fav_e2e_test_000_bbb', favoritedById: TEST_USER_ID, itemId: E2E_ITEM_B_ID },
        { id: 'fav_e2e_test_000_ccc', favoritedById: TEST_USER_ID, itemId: E2E_ITEM_C_ID },
        { id: 'fav_e2e_test_000_dd1', favoritedById: TEST_USER_ID, itemId: E2E_ITEM_D_ID },
        { id: 'fav_e2e_test_000_dd2', favoritedById: TEST_USER_ID, itemId: E2E_ITEM_D_ID },
        { id: 'fav_e2e_test_000_ggg', favoritedById: TEST_USER_ID, itemId: E2E_ITEM_G_ID },
        { id: 'fav_e2e_test_000_rvk', favoritedById: TEST_USER_ID, itemId: OTHER_REVOKED_ID },
      ],
    })

    // Seed pin test items.
    await prisma.item.upsert({
      where: { id: E2E_PIN_ITEM_A_ID },
      create: { id: E2E_PIN_ITEM_A_ID, name: E2E_PIN_ITEM_A_NAME, ...itemBase },
      update: { name: E2E_PIN_ITEM_A_NAME },
    })
    await prisma.item.upsert({
      where: { id: E2E_PIN_ITEM_B_ID },
      create: { id: E2E_PIN_ITEM_B_ID, name: E2E_PIN_ITEM_B_NAME, ...itemBase },
      update: { name: E2E_PIN_ITEM_B_NAME },
    })
    await prisma.item.upsert({
      where: { id: E2E_PIN_ITEM_C_ID },
      create: { id: E2E_PIN_ITEM_C_ID, name: E2E_PIN_ITEM_C_NAME, ...itemBase },
      update: { name: E2E_PIN_ITEM_C_NAME },
    })

    // Reset pins: A starts unpinned, B starts pre-pinned (the toggle-off test
    // unpins it), C starts pre-pinned and is never toggled (the list test).
    await prisma.pinItem.deleteMany({
      where: {
        pinnedById: TEST_USER_ID,
        itemId: { in: [E2E_PIN_ITEM_A_ID, E2E_PIN_ITEM_B_ID, E2E_PIN_ITEM_C_ID] },
      },
    })
    await prisma.pinItem.createMany({
      data: [
        { id: 'pin_e2e_test_000_bbb', pinnedById: TEST_USER_ID, itemId: E2E_PIN_ITEM_B_ID, position: 0 },
        { id: 'pin_e2e_test_000_ccc', pinnedById: TEST_USER_ID, itemId: E2E_PIN_ITEM_C_ID, position: 1 },
      ],
    })

    // Write Playwright storageState — better-auth reads `better-auth.session_token` cookie
    // and validates it as a signed cookie (HMAC-SHA256 with BETTER_AUTH_SECRET).
    // The cookie value must be token + "." + base64(HMAC-SHA256(token, secret)) — raw, not percent-encoded.
    const secret = process.env.BETTER_AUTH_SECRET
    const signedToken = await signCookieValue(token, secret)

    const authDir = path.join(process.cwd(), 'tests/e2e/.auth')
    await mkdir(authDir, { recursive: true })
    await writeFile(
      path.join(authDir, 'session.json'),
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
  } finally {
    await prisma.$disconnect()
  }
}
