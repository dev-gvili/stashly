import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Prisma } from '@/prisma/client'
import { prisma } from '@/services/db'
import { getRecentActivityForUser, type OverviewActivityKind } from '@/services/activity-actions'
import { getPrefixForModel, toObjectId } from '@/utils/converters'
import { wipeTestUsers } from './helpers/wipe-test-users'

/**
 * The overview feed is one raw statement: the newest rows are picked first, then
 * joined, and the activity kind is derived in SQL. One Prisma query sorted on the
 * related `ActivityTime` and ran every per-row join before `take` (694 ms for 12
 * rows on a user with 8,798 activities). These cases pin what the SQL must keep:
 * order, the tie order, every kind, and who may see what. Needs a live database
 * (CI provides one).
 */
const uid = (model: Parameters<typeof getPrefixForModel>[0]) => toObjectId(getPrefixForModel(model))

const users: string[] = []
const workspaces: string[] = []
const timeIds: string[] = []
const itemActionIds: string[] = []
const kindRows: Record<string, string[]> = {
  restoreAction: [],
  uploadAction: [],
  pinAction: [],
  collectionAction: [],
  favoriteAction: [],
  bucketAction: [],
}

type Seeded = { id: string; observedAt: Date; kind: OverviewActivityKind; timeId: string }

/** Nested ItemAction data for one kind, recording the kind row for cleanup. */
function actionFor(kind: OverviewActivityKind): Omit<Prisma.ItemActionCreateWithoutActivityInput, 'id'> {
  // Each kind table takes `id` plus at most a `kind`/`uploadId`; the switch below
  // pairs every table with its own data, so the loose type stays local.
  const one = (table: keyof typeof kindRows, model: Parameters<typeof getPrefixForModel>[0], data: object = {}): any => {
    const id = uid(model)
    kindRows[table].push(id)
    return { create: { id, ...data } }
  }
  switch (kind) {
    case 'restored':
      return { restore: one('restoreAction', 'RestoreAction') }
    case 'uploaded':
      return { upload: one('uploadAction', 'UploadAction', { uploadId: 'feed-test' }) }
    case 'pinned':
    case 'unpinned':
    case 'reordered':
      return { pin: one('pinAction', 'PinAction', { kind }) }
    case 'collection_item_added':
      return { collection: one('collectionAction', 'CollectionAction', { kind: 'item_added' }) }
    case 'collection_item_removed':
      return { collection: one('collectionAction', 'CollectionAction', { kind: 'item_removed' }) }
    case 'collection_emptied':
      return { collection: one('collectionAction', 'CollectionAction', { kind: 'emptied' }) }
    case 'favorited':
    case 'unfavorited':
      return { favorite: one('favoriteAction', 'FavoriteAction', { kind }) }
    case 'bucket_emptied':
      return { bucket: one('bucketAction', 'BucketAction', { kind: 'emptied' }) }
    default:
      throw new Error(`no seed for ${kind}`)
  }
}

async function seedActivity(itemId: string, observedAt: Date, kind: OverviewActivityKind): Promise<Seeded> {
  const timeId = uid('ActivityTime')
  timeIds.push(timeId)
  const id = uid('Activity')
  const base = { id, item: { connect: { id: itemId } }, time: { create: { id: timeId, observedAt } } }
  if (kind === 'viewed') {
    await prisma.activity.create({ data: { ...base, access: { create: { id: uid('AccessAction') } } } })
  } else {
    const actionId = uid('ItemAction')
    itemActionIds.push(actionId)
    await prisma.activity.create({ data: { ...base, action: { create: { id: actionId, ...actionFor(kind) } } } })
  }
  return { id, observedAt, kind, timeId }
}

async function seedUser(label: string, workspaceId?: string) {
  const userId = uid('User')
  users.push(userId)
  await prisma.user.create({ data: { id: userId, name: label, email: `feed-${userId}@test.local`, emailVerified: true } })
  const driveId = uid('Drive')
  await prisma.drive.create({ data: { id: driveId, ownerId: userId } })
  const itemId = await seedItem(userId, driveId, label, workspaceId)
  return { userId, driveId, itemId }
}

async function seedItem(ownerId: string, driveId: string, label: string, workspaceId?: string) {
  const itemId = uid('Item')
  await prisma.item.create({
    data: { id: itemId, name: `${label}.txt`, type: 'file', category: 'document', status: 'normal', ownerId, driveId, parentId: null, size: 0, workspaceId },
  })
  return itemId
}

const at = (minute: number) => new Date(Date.UTC(2026, 9, 31, 0, minute))
const newestFirst = (rows: Seeded[]) =>
  [...rows].sort((a, b) => b.observedAt.getTime() - a.observedAt.getTime() || (a.timeId < b.timeId ? 1 : -1))

let owner: Awaited<ReturnType<typeof seedUser>>
let other: Awaited<ReturnType<typeof seedUser>>
const seeded: Seeded[] = []

beforeAll(async () => {
  owner = await seedUser('feed-owner')
  other = await seedUser('feed-other')
  // Inserted out of time order, so a feed that followed insertion order fails.
  const kinds: OverviewActivityKind[] = ['restored', 'uploaded', 'viewed']
  const minutes = [7, 2, 14, 0, 11, 5, 9, 13, 1, 4, 12, 3, 10, 6, 8]
  for (const [i, minute] of minutes.entries()) seeded.push(await seedActivity(owner.itemId, at(minute), kinds[i % 3]))
  // Newer than all of the owner's, on an item the owner can't see.
  await seedActivity(other.itemId, at(30), 'restored')
})

afterAll(async () => {
  await prisma.workspaceMember.deleteMany({ where: { workspaceId: { in: workspaces } } })
  await wipeTestUsers(users)
  await prisma.workspace.deleteMany({ where: { id: { in: workspaces } } })
  // Activity rows cascade with their item; the rows they pointed at don't.
  await prisma.itemAction.deleteMany({ where: { id: { in: itemActionIds } } })
  await prisma.restoreAction.deleteMany({ where: { id: { in: kindRows.restoreAction } } })
  await prisma.uploadAction.deleteMany({ where: { id: { in: kindRows.uploadAction } } })
  await prisma.pinAction.deleteMany({ where: { id: { in: kindRows.pinAction } } })
  await prisma.collectionAction.deleteMany({ where: { id: { in: kindRows.collectionAction } } })
  await prisma.favoriteAction.deleteMany({ where: { id: { in: kindRows.favoriteAction } } })
  await prisma.bucketAction.deleteMany({ where: { id: { in: kindRows.bucketAction } } })
  await prisma.activityTime.deleteMany({ where: { id: { in: timeIds } } })
})

describe('getRecentActivityForUser', () => {
  it('returns the newest `limit` activities, newest first, with their kinds', async () => {
    const feed = await getRecentActivityForUser({ userId: owner.userId, limit: 12 })
    const expected = newestFirst(seeded).slice(0, 12)

    expect(feed.map((row) => row.id)).toEqual(expected.map((row) => row.id))
    expect(feed.map((row) => row.kind)).toEqual(expected.map((row) => row.kind))
    expect(feed.map((row) => row.observedAt)).toEqual(expected.map((row) => row.observedAt))
    expect(feed[0].item).toEqual({ id: owner.itemId, name: 'feed-owner.txt', type: 'file', category: 'document', parentId: null, ownerId: owner.userId })
  })

  it('leaves out activity on items the user does not own', async () => {
    const feed = await getRecentActivityForUser({ userId: owner.userId, limit: 50 })
    expect(feed).toHaveLength(seeded.length)
    expect(feed.some((row) => row.item?.id === other.itemId)).toBe(false)
  })

  it('returns nothing for a user with no activity', async () => {
    const empty = await seedUser('feed-empty')
    expect(await getRecentActivityForUser({ userId: empty.userId, limit: 12 })).toEqual([])
  })

  it('orders activities that share a timestamp the same way on every call', async () => {
    const user = await seedUser('feed-ties')
    const tied: Seeded[] = []
    for (let i = 0; i < 6; i++) tied.push(await seedActivity(user.itemId, at(20), 'uploaded'))

    const first = await getRecentActivityForUser({ userId: user.userId, limit: 4 })
    expect(first.map((row) => row.id)).toEqual(newestFirst(tied).slice(0, 4).map((row) => row.id))
    for (let i = 0; i < 5; i++) {
      const again = await getRecentActivityForUser({ userId: user.userId, limit: 4 })
      expect(again.map((row) => row.id)).toEqual(first.map((row) => row.id))
    }
  })

  it('derives every kind that has its own action row', async () => {
    const user = await seedUser('feed-kinds')
    const kinds: OverviewActivityKind[] = [
      'pinned', 'unpinned', 'reordered',
      'collection_item_added', 'collection_item_removed', 'collection_emptied',
      'favorited', 'unfavorited', 'bucket_emptied', 'restored', 'uploaded', 'viewed',
    ]
    const rows: Seeded[] = []
    for (const [i, kind] of kinds.entries()) rows.push(await seedActivity(user.itemId, at(40 - i), kind))

    const feed = await getRecentActivityForUser({ userId: user.userId, limit: kinds.length })
    expect(feed.map((row) => row.kind)).toEqual(kinds)
  })

  it('keeps workspace items out of the personal feed and shows them by role in the workspace feed', async () => {
    const workspaceId = uid('Workspace')
    workspaces.push(workspaceId)
    await prisma.workspace.create({ data: { id: workspaceId, name: 'feed-ws' } })
    const admin = await seedUser('feed-ws-admin')
    const member = await seedUser('feed-ws-member')
    await prisma.workspaceMember.createMany({
      data: [
        { id: uid('WorkspaceMember'), memberId: admin.userId, workspaceId, role: 'admin' },
        { id: uid('WorkspaceMember'), memberId: member.userId, workspaceId, role: 'member' },
      ],
    })
    const adminItem = await seedItem(admin.userId, admin.driveId, 'ws-admin', workspaceId)
    const memberItem = await seedItem(member.userId, member.driveId, 'ws-member', workspaceId)
    const byAdmin = await seedActivity(adminItem, at(50), 'uploaded')
    const byMember = await seedActivity(memberItem, at(51), 'uploaded')

    // Personal feeds: the workspace activity never shows, only the seeded personal item's (none).
    expect(await getRecentActivityForUser({ userId: admin.userId, limit: 12 })).toEqual([])
    // An admin sees everything in the workspace; a member sees only their own items.
    const adminFeed = await getRecentActivityForUser({ userId: admin.userId, workspaceId, limit: 12 })
    expect(adminFeed.map((row) => row.id)).toEqual([byMember.id, byAdmin.id])
    const memberFeed = await getRecentActivityForUser({ userId: member.userId, workspaceId, limit: 12 })
    expect(memberFeed.map((row) => row.id)).toEqual([byMember.id])
  })
})
