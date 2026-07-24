import '@dotenvx/dotenvx/config'
import { randomBytes } from 'node:crypto'
import { PrismaClient } from '../app/prisma/client.js'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter } as any)

const TARGET_EMAIL = 'bwvq073@outlook.com'

// Stashly-style id: `ntf_<20-char url-safe base64>`
function notificationId() {
  return `ntf_${randomBytes(16).toString('base64url')}`
}

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

// message / type (severity) / kind (subject glyph) / status / how long ago —
// spread across the day-buckets (Today, Yesterday, This week, Earlier) the
// panel groups by, and across kinds so every glyph is exercised.
const SEED = [
  { message: 'Alon shared "Team Roadmap" with you.', type: 'info', kind: 'share', status: 'unread', ago: 4 * 60 * 1000 },
  { message: '34 items were added to your "Q4 Campaign" collection.', type: 'success', kind: 'collection', status: 'unread', ago: 3 * HOUR },
  { message: "You're using 92% of your storage quota.", type: 'warning', kind: 'storage', status: 'unread', ago: 1 * DAY + 2 * HOUR },
  { message: 'Upload failed for "design-assets.zip". Try again.', type: 'error', kind: 'upload', status: 'unread', ago: 1 * DAY + 5 * HOUR },
  { message: 'Maya joined the Marketing workspace.', type: 'success', kind: 'member', status: 'read', ago: 3 * DAY },
  { message: 'Your "Q3-report.pdf" finished processing.', type: 'info', kind: 'file', status: 'read', ago: 11 * DAY },
] as const

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: TARGET_EMAIL },
    select: { id: true, email: true },
  })

  if (!user) {
    console.error(`✗ No user found with email ${TARGET_EMAIL}`)
    process.exitCode = 1
    return
  }

  // Clear any prior demo rows so re-runs stay idempotent and old kind-less
  // notifications don't linger with the fallback glyph.
  const cleared = await prisma.notification.deleteMany({
    where: { userId: user.id },
  })
  if (cleared.count > 0) console.log(`• Cleared ${cleared.count} existing notification(s)`)

  const now = Date.now()
  const rows = SEED.map((s) => ({
    id: notificationId(),
    userId: user.id,
    message: s.message,
    type: s.type,
    kind: s.kind,
    status: s.status,
    createdAt: new Date(now - s.ago),
    updatedAt: new Date(now - s.ago),
  }))

  const result = await prisma.notification.createMany({ data: rows })

  console.log(`✓ Seeded ${result.count} notifications for ${user.email}`)
  console.table(
    rows.map((r) => ({
      type: r.type,
      kind: r.kind,
      status: r.status,
      when: r.createdAt.toISOString(),
      message: r.message,
    }))
  )
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
