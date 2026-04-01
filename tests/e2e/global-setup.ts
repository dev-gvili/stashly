import '@dotenvx/dotenvx/config'
import { PrismaClient } from '../../app/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import { TEST_USER_ID, TEST_USER_EMAIL } from './constants'

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
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
  const prisma = new PrismaClient({ adapter })

  try {
    // Ensure a free storage plan exists — layout loader requires it
    const freePlan = await prisma.storagePlan.findFirst({ where: { type: 'free' } })
    if (!freePlan) {
      throw new Error(
        '[E2E] No free storage plan found in database. Run `pnpm prisma migrate dev` and seed storage plans first.'
      )
    }

    // Upsert test user — idempotent, safe to re-run
    await prisma.user.upsert({
      where: { email: TEST_USER_EMAIL },
      create: {
        id: TEST_USER_ID,
        name: 'E2E Test User',
        email: TEST_USER_EMAIL,
        emailVerified: true,
        bucket: 'e2e-bucket',
        storagePlanId: freePlan.id,
      },
      update: {},
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

    // Write Playwright storageState — better-auth reads `better-auth.session_token` cookie
    // and validates it as a signed cookie (HMAC-SHA256 with BETTER_AUTH_SECRET).
    // The cookie value must be token + "." + base64(HMAC-SHA256(token, secret)) — raw, not percent-encoded.
    const secret = process.env.BETTER_AUTH_SECRET!
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

    console.log('[E2E] Global setup complete — test user seeded, session written')
  } finally {
    await prisma.$disconnect()
  }
}
