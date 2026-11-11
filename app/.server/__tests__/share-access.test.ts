import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '@/services/db'
import {
  createEditLink,
  createEmbedLink,
  createUploadLink,
  createViewLink,
  expireShareLink,
  listShareLinksForItem,
  revokeAllShareLinksForItem,
  revokeShareLink,
  updateShareLinkScope,
  updateShareLinkSettings,
  updateShareLinkType,
} from '@/services/share-actions'
import { listItemInvitations } from '@/services/invitation-actions'
import { toErrorInfo } from '@/utils/api.errors'
import { getPrefixForModel, toObjectId } from '@/utils/converters'
import { wipeTestUsers } from './helpers/wipe-test-users'

/**
 * Managing an item's share links needs ownership or a live `write`/`owner`
 * permission. Until 2026-10-08 the share actions took no user at all, so any
 * signed-in user could create, re-scope or revoke links on anyone's item.
 *
 * Needs a live database (CI provides one).
 */
const uid = (model: Parameters<typeof getPrefixForModel>[0]) =>
  toObjectId(getPrefixForModel(model))

let ownerId: string
let strangerId: string
let writerId: string
let readerId: string
let expiredWriterId: string
let itemId: string
let linkId: string
let invitationId: string
const createdLinks: string[] = []

/** The HTTP status a rejected action carries, or `'ok'` if it resolved. */
async function outcome(run: () => Promise<unknown>): Promise<number | 'ok'> {
  try {
    await run()
    return 'ok'
  } catch (e) {
    return toErrorInfo(e).status ?? 500
  }
}

async function grant(userId: string, roles: 'read' | 'write', expiresAt?: Date) {
  await prisma.permission.create({
    data: {
      id: uid('Permission'),
      itemId,
      roles,
      expiresAt,
      users: { connect: { id: userId } },
    },
  })
}

beforeAll(async () => {
  ;[ownerId, strangerId, writerId, readerId, expiredWriterId] = [
    uid('User'),
    uid('User'),
    uid('User'),
    uid('User'),
    uid('User'),
  ]
  await prisma.user.createMany({
    data: [ownerId, strangerId, writerId, readerId, expiredWriterId].map((id, i) => ({
      id,
      name: `Share access ${i}`,
      email: `shareacc-${id}@test.local`,
      emailVerified: true,
    })),
  })
  const driveId = uid('Drive')
  await prisma.drive.create({ data: { id: driveId, ownerId } })
  itemId = uid('Item')
  await prisma.item.create({
    data: { id: itemId, name: 'shared.txt', type: 'file', category: 'unknown', status: 'normal', ownerId, driveId, size: 0 },
  })
  await grant(writerId, 'write')
  await grant(readerId, 'read')
  await grant(expiredWriterId, 'write', new Date(Date.now() - 60_000))

  const link = await createViewLink(ownerId, itemId, 'anonymous')
  linkId = link.id
  createdLinks.push(link.id)

  invitationId = uid('Invitation')
  await prisma.invitation.create({
    data: {
      id: invitationId,
      senderId: ownerId,
      itemId,
      message: 'private note',
      recipients: {
        create: { id: uid('InvitationRecipient'), email: `invitee-${invitationId}@test.local` },
      },
    },
  })
})

afterAll(async () => {
  await prisma.invitation.deleteMany({ where: { id: invitationId } })
  await prisma.permission.deleteMany({ where: { linkId: { in: createdLinks } } })
  await prisma.shareLink.deleteMany({ where: { id: { in: createdLinks } } })
  const others = [strangerId, writerId, readerId, expiredWriterId]
  await prisma.permission.deleteMany({ where: { users: { some: { id: { in: others } } } } })
  await wipeTestUsers([ownerId, ...others])
  await prisma.user.deleteMany({ where: { id: { in: [ownerId, ...others] } } })
})

describe('a user who cannot manage the item gets 403 and changes nothing', () => {
  const cases: [string, (actor: string) => Promise<unknown>][] = [
    ['list links', (a) => listShareLinksForItem(a, itemId)],
    // The invitations carry the sender's and every recipient's email, the
    // personal message and the item's file row.
    ['list invitations', (a) => listItemInvitations(a, itemId)],
    ['create a view link', (a) => createViewLink(a, itemId, 'anonymous')],
    ['create an edit link', (a) => createEditLink(a, itemId, 'users')],
    ['create an embed link', (a) => createEmbedLink(a, itemId)],
    ['create an upload link', (a) => createUploadLink(a, itemId, 'users')],
    ['re-scope a link', (a) => updateShareLinkScope(a, linkId, 'users')],
    ['retype a link', (a) => updateShareLinkType(a, linkId, 'edit')],
    ['expire a link', (a) => expireShareLink(a, linkId, new Date())],
    ['change link settings', (a) => updateShareLinkSettings(a, linkId, { password: 'x' })],
    ['revoke a link', (a) => revokeShareLink(a, linkId)],
    ['revoke every link', (a) => revokeAllShareLinksForItem(a, itemId)],
  ]

  for (const [who, actor] of [
    ['a stranger', () => strangerId],
    ['a read-only grantee', () => readerId],
    ['a grantee whose write permission expired', () => expiredWriterId],
  ] as const) {
    it.each(cases)(`${who} cannot %s`, async (_label, run) => {
      const before = await prisma.shareLink.findMany({ where: { permission: { some: { itemId } } } })
      expect(await outcome(() => run(actor()))).toBe(403)
      const after = await prisma.shareLink.findMany({ where: { permission: { some: { itemId } } } })
      expect(after).toEqual(before)
    })
  }
})

describe('the owner and a live write grantee can manage links', () => {
  it('the owner lists the item’s links', async () => {
    const links = await listShareLinksForItem(ownerId, itemId)
    expect(links.map((l) => l.id)).toContain(linkId)
  })

  it('the owner and a live write grantee list the item’s invitations', async () => {
    for (const actor of [ownerId, writerId]) {
      const invitations = await listItemInvitations(actor, itemId)
      expect(invitations.map((i) => i.id)).toEqual([invitationId])
    }
  })

  it('a live write grantee lists, re-scopes, and creates and revokes a link', async () => {
    expect((await listShareLinksForItem(writerId, itemId)).map((l) => l.id)).toContain(linkId)
    expect((await updateShareLinkScope(writerId, linkId, 'users')).scope).toBe('users')

    const extra = await createEditLink(writerId, itemId, 'users')
    createdLinks.push(extra.id)
    await revokeShareLink(writerId, extra.id)
    expect(await prisma.shareLink.findUnique({ where: { id: extra.id } })).toBeNull()
  })
})

describe('missing targets answer 404', () => {
  it('an unknown item', async () => {
    expect(await outcome(() => createViewLink(ownerId, uid('Item'), 'anonymous'))).toBe(404)
  })

  it('an unknown link', async () => {
    expect(await outcome(() => revokeShareLink(ownerId, uid('ShareLink')))).toBe(404)
  })
})
