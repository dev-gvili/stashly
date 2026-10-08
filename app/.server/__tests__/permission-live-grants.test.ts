import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '@/services/db'
import {
  assertItemAccess,
  assertItemsAccess,
  hasItemPermission,
  hasLinkPermission,
} from '@/services/permission-actions'
import { buildItemFilters } from '@/utils/filters/item.filters'
import { toErrorInfo } from '@/utils/api.errors'
import { getPrefixForModel, toObjectId } from '@/utils/converters'
import { wipeTestUsers } from './helpers/wipe-test-users'

/**
 * Only a live grant opens an item: a permission that is soft-deleted (a
 * canceled invitation) or past its `expiresAt` must not. Until 2026-10-08 the
 * access checks matched on user and role alone, so both still granted access
 * and still listed the item (tech-debt item 26, confirmed in a rolled-back
 * transaction before the fix).
 *
 * Needs a live database (CI provides one).
 */
const uid = (model: Parameters<typeof getPrefixForModel>[0]) =>
  toObjectId(getPrefixForModel(model))

let ownerId: string
let userId: string
const items: Record<'live' | 'expired' | 'deleted', string> = { live: '', expired: '', deleted: '' }
const links: Record<'live' | 'expired' | 'deleted', string> = { live: '', expired: '', deleted: '' }

const GRANTS = {
  live: {},
  expired: { expiresAt: new Date(Date.now() - 60_000) },
  deleted: { deletedAt: new Date() },
} as const

async function status(run: () => Promise<unknown>): Promise<number | 'ok'> {
  try {
    await run()
    return 'ok'
  } catch (e) {
    return toErrorInfo(e).status ?? 500
  }
}

beforeAll(async () => {
  ;[ownerId, userId] = [uid('User'), uid('User')]
  await prisma.user.createMany({
    data: [ownerId, userId].map((id, i) => ({
      id,
      name: `Live grants ${i}`,
      email: `livegrant-${id}@test.local`,
      emailVerified: true,
    })),
  })
  const driveId = uid('Drive')
  await prisma.drive.create({ data: { id: driveId, ownerId } })

  for (const kind of Object.keys(GRANTS) as (keyof typeof GRANTS)[]) {
    items[kind] = uid('Item')
    await prisma.item.create({
      data: { id: items[kind], name: `${kind}.txt`, type: 'file', category: 'unknown', status: 'normal', ownerId, driveId, size: 0 },
    })
    links[kind] = uid('ShareLink')
    await prisma.shareLink.create({ data: { id: links[kind], type: 'view', scope: 'users' } })
    await prisma.permission.create({
      data: {
        id: uid('Permission'),
        itemId: items[kind],
        linkId: links[kind],
        roles: 'write',
        users: { connect: { id: userId } },
        ...GRANTS[kind],
      },
    })
  }
})

afterAll(async () => {
  await prisma.permission.deleteMany({ where: { users: { some: { id: userId } } } })
  await prisma.shareLink.deleteMany({ where: { id: { in: Object.values(links) } } })
  await wipeTestUsers([ownerId, userId])
  await prisma.user.deleteMany({ where: { id: { in: [ownerId, userId] } } })
})

describe('a live grant still opens the item', () => {
  it('hasItemPermission, for read and for write', async () => {
    expect(await hasItemPermission(userId, items.live, 'read')).toBe(true)
    expect(await hasItemPermission(userId, items.live, 'write')).toBe(true)
  })

  it('assertItemAccess and assertItemsAccess', async () => {
    expect(await status(() => assertItemAccess(userId, items.live))).toBe('ok')
    expect(await status(() => assertItemsAccess(userId, [items.live], 'write'))).toBe('ok')
  })

  it('hasLinkPermission', async () => {
    expect(await hasLinkPermission(userId, links.live, 'write')).toBe(true)
  })

  it('the accessibleBy filter lists the item', async () => {
    const listed = await prisma.item.count({
      where: { id: items.live, ...buildItemFilters({ accessibleBy: userId } as never) },
    })
    expect(listed).toBe(1)
  })
})

describe.each(['expired', 'deleted'] as const)('a %s grant no longer counts', (kind) => {
  it('hasItemPermission is false', async () => {
    expect(await hasItemPermission(userId, items[kind], 'read')).toBe(false)
  })

  it('assertItemAccess and assertItemsAccess answer 403', async () => {
    expect(await status(() => assertItemAccess(userId, items[kind]))).toBe(403)
    expect(await status(() => assertItemsAccess(userId, [items[kind]], 'read'))).toBe(403)
  })

  it('hasLinkPermission is false', async () => {
    expect(await hasLinkPermission(userId, links[kind], 'write')).toBe(false)
  })

  it('the accessibleBy filter no longer lists the item', async () => {
    const listed = await prisma.item.count({
      where: { id: items[kind], ...buildItemFilters({ accessibleBy: userId } as never) },
    })
    expect(listed).toBe(0)
  })

  it('the owner is unaffected', async () => {
    expect(await hasItemPermission(ownerId, items[kind], 'write')).toBe(true)
  })
})
