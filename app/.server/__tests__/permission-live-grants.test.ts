import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '@/services/db'
import { Prisma, type PermissionRole } from '@/prisma/client'
import {
  assertItemAccess,
  assertItemsAccess,
  expirePermissionForUser,
  grantItemPermissionForUser,
  hasItemPermission,
  hasLinkPermission,
  itemAccessSql,
  itemAccessWhere,
  listItemPermissionsForUser,
  revokeItemPermissionForUser,
} from '@/services/permission-actions'
import {
  createThumbnail,
  getThumbnailSource,
  presignThumbnailUpload,
  updateThumbnail,
} from '@/services/thumbnail-actions'
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

/** The fixture items `itemAccessSql` lets `who` act on with `role`. */
async function sqlAccess(who: string, role: PermissionRole) {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT i."id" FROM "Item" i
    WHERE i."id" IN (${Prisma.join(Object.values(items))}) AND ${itemAccessSql(who, role)}`
  return rows.map((r) => r.id).sort()
}

/** The same, through the Prisma filter it mirrors. */
async function whereAccess(who: string, role: PermissionRole) {
  const rows = await prisma.item.findMany({
    where: { id: { in: Object.values(items) }, ...itemAccessWhere(who, role) },
    select: { id: true },
  })
  return rows.map((r) => r.id).sort()
}

describe('itemAccessSql grants exactly what itemAccessWhere grants', () => {
  it.each(['read', 'write', 'owner'] as const)('for the %s role', async (role) => {
    // The grantee holds a write grant on each item: live, expired, deleted.
    expect(await sqlAccess(userId, role)).toEqual(await whereAccess(userId, role))
    expect(await sqlAccess(ownerId, role)).toEqual(await whereAccess(ownerId, role))
  })

  it('counts only the live grant, up to the role it carries; the owner gets every item', async () => {
    expect(await sqlAccess(userId, 'read')).toEqual([items.live])
    expect(await sqlAccess(userId, 'write')).toEqual([items.live])
    expect(await sqlAccess(userId, 'owner')).toEqual([])
    expect(await sqlAccess(ownerId, 'owner')).toEqual(Object.values(items).sort())
  })
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

  // The fixture items have no File row, so once past the read check the presign
  // and the PATCH stop at 404 ("no file to attach a thumbnail to"), before any
  // signing or write: 404 here means access was granted, 403 that it was not.
  it('the thumbnail calls pass the read check', async () => {
    expect(await status(() => presignThumbnailUpload(userId, items.live))).toBe(404)
    expect(await status(() => updateThumbnail(userId, items.live, 2))).toBe(404)
    expect(await status(() => getThumbnailSource(userId, items.live))).toBe('ok')
    expect(await status(() => createThumbnail(userId, items.live, '#000000'))).toBe('ok')
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

  it('the thumbnail calls answer 403', async () => {
    expect(await status(() => presignThumbnailUpload(userId, items[kind]))).toBe(403)
    expect(await status(() => updateThumbnail(userId, items[kind], 2))).toBe(403)
    expect(await status(() => getThumbnailSource(userId, items[kind]))).toBe(403)
    // Until item 87 it took no user: anyone wrote a row on any item.
    expect(await status(() => createThumbnail(userId, items[kind], '#000000'))).toBe(403)
    expect(await prisma.thumbnail.count({ where: { itemId: items[kind] } })).toBe(0)
  })

  it('a missing item is refused like a forbidden one', async () => {
    expect(await status(() => createThumbnail(userId, uid('Item'), '#000000'))).toBe(403)
  })

  it('the owner is unaffected', async () => {
    expect(await hasItemPermission(ownerId, items[kind], 'write')).toBe(true)
    expect(await status(() => presignThumbnailUpload(ownerId, items[kind]))).toBe(404)
    expect(await status(() => getThumbnailSource(ownerId, items[kind]))).toBe('ok')
  })
})

/**
 * `/api/permissions` called the bare helpers with no caller, so any signed-in
 * user could list an item's grants (full user rows) and grant themselves write
 * on it (tech-debt item 61). The caller-checked actions need read to list and
 * write to manage; an expired grant counts as none.
 */
describe('managing an item’s permissions checks the caller', () => {
  const expiredPermissionId = () =>
    prisma.permission
      .findFirstOrThrow({ where: { itemId: items.expired }, select: { id: true } })
      .then((p) => p.id)

  it('a user without a live grant can neither list nor manage', async () => {
    const itemId = items.expired
    expect(await status(() => listItemPermissionsForUser(userId, itemId))).toBe(403)
    expect(await status(() => grantItemPermissionForUser(userId, userId, itemId, 'write'))).toBe(403)
    expect(await status(() => revokeItemPermissionForUser(userId, ownerId, itemId))).toBe(403)
    const permissionId = await expiredPermissionId()
    expect(await status(() => expirePermissionForUser(userId, permissionId, new Date()))).toBe(403)
  })

  it('a writer cannot hand out the owner role', async () => {
    expect(await status(() => grantItemPermissionForUser(userId, userId, items.live, 'owner'))).toBe(403)
  })

  it('a missing permission answers 404', async () => {
    expect(await status(() => expirePermissionForUser(ownerId, uid('Permission'), new Date()))).toBe(404)
  })

  it('a reader gets the list, with only the user fields the share dialog shows', async () => {
    const permissions = await listItemPermissionsForUser(userId, items.live)
    expect(permissions).toHaveLength(1)
    expect(Object.keys(permissions[0].users[0]).sort()).toEqual(['email', 'id', 'image', 'name'])
  })

  it('the owner lists any of their items', async () => {
    expect(await listItemPermissionsForUser(ownerId, items.expired)).toHaveLength(1)
  })
})

/**
 * Handing out `owner` needs `owner`, so taking it away must too: a writer
 * could revoke or expire a co-owner's grant (tech-debt item 86).
 */
describe('only an owner can revoke or expire an owner-role grant', () => {
  let coOwnerId: string
  let readerId: string
  let ownerGrantId: string
  let readGrantId: string

  beforeAll(async () => {
    ;[coOwnerId, readerId] = [uid('User'), uid('User')]
    await prisma.user.createMany({
      data: [coOwnerId, readerId].map((id, i) => ({
        id,
        name: `Owner grant ${i}`,
        email: `ownergrant-${id}@test.local`,
        emailVerified: true,
      })),
    })
    ;[ownerGrantId, readGrantId] = [uid('Permission'), uid('Permission')]
    await prisma.permission.createMany({
      data: [
        { id: ownerGrantId, itemId: items.live, roles: 'owner' },
        { id: readGrantId, itemId: items.live, roles: 'read' },
      ],
    })
    await prisma.permission.update({ where: { id: ownerGrantId }, data: { users: { connect: { id: coOwnerId } } } })
    await prisma.permission.update({ where: { id: readGrantId }, data: { users: { connect: { id: readerId } } } })
  })

  afterAll(async () => {
    await prisma.permission.deleteMany({ where: { id: { in: [ownerGrantId, readGrantId] } } })
    await prisma.user.deleteMany({ where: { id: { in: [coOwnerId, readerId] } } })
  })

  it('a writer gets 403 and the co-owner keeps the grant', async () => {
    expect(await status(() => revokeItemPermissionForUser(userId, coOwnerId, items.live))).toBe(403)
    expect(await status(() => expirePermissionForUser(userId, ownerGrantId, new Date()))).toBe(403)
    const grant = await prisma.permission.findUniqueOrThrow({
      where: { id: ownerGrantId },
      select: { expiresAt: true, users: { select: { id: true } } },
    })
    expect(grant).toEqual({ expiresAt: null, users: [{ id: coOwnerId }] })
  })

  it('a writer still expires and revokes a read grant', async () => {
    const later = new Date(Date.now() + 3_600_000)
    expect(await status(() => expirePermissionForUser(userId, readGrantId, later))).toBe('ok')
    expect(await status(() => revokeItemPermissionForUser(userId, readerId, items.live))).toBe('ok')
  })

  it('the item’s owner revokes the co-owner', async () => {
    expect(await status(() => revokeItemPermissionForUser(ownerId, coOwnerId, items.live))).toBe('ok')
  })
})
