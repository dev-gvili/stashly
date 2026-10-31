import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '@/services/db'
import { getRecentActivityForUser } from '@/services/activity-actions'
import { getPrefixForModel, toObjectId } from '@/utils/converters'
import { wipeTestUsers } from './helpers/wipe-test-users'

/**
 * The overview feed picks the newest activity ids first, then loads the
 * nested select for those rows only. One query sorted on the related
 * `ActivityTime` and ran every per-row join before `take` (694 ms for 12 rows
 * on a user with 8,798 activities), so the split must keep the same rows,
 * order and kinds. Needs a live database (CI provides one).
 */
const uid = (model: Parameters<typeof getPrefixForModel>[0]) => toObjectId(getPrefixForModel(model))

let ownerId: string
let otherId: string
let fileId: string
let otherFileId: string
const timeIds: string[] = []
const itemActionIds: string[] = []
const restoreIds: string[] = []
const uploadIds: string[] = []

type Kind = 'restored' | 'uploaded' | 'viewed'

async function seedActivity(itemId: string, minute: number, kind: Kind) {
  const timeId = uid('ActivityTime')
  timeIds.push(timeId)
  const id = uid('Activity')
  const observedAt = new Date(Date.UTC(2026, 9, 31, 0, minute))
  if (kind === 'viewed') {
    await prisma.activity.create({
      data: { id, item: { connect: { id: itemId } }, time: { create: { id: timeId, observedAt } }, access: { create: { id: uid('AccessAction') } } },
    })
    return { id, observedAt, kind }
  }
  const actionId = uid('ItemAction')
  itemActionIds.push(actionId)
  const kindData =
    kind === 'restored'
      ? { restore: { create: { id: (restoreIds.push(uid('RestoreAction')), restoreIds.at(-1)!) } } }
      : { upload: { create: { id: (uploadIds.push(uid('UploadAction')), uploadIds.at(-1)!), uploadId: 'feed-test' } } }
  await prisma.activity.create({
    data: {
      id,
      item: { connect: { id: itemId } },
      time: { create: { id: timeId, observedAt } },
      action: { create: { id: actionId, ...kindData } },
    },
  })
  return { id, observedAt, kind }
}

async function seedUser(label: string) {
  const userId = uid('User')
  await prisma.user.create({ data: { id: userId, name: label, email: `feed-${userId}@test.local`, emailVerified: true } })
  const driveId = uid('Drive')
  await prisma.drive.create({ data: { id: driveId, ownerId: userId } })
  const itemId = uid('Item')
  await prisma.item.create({
    data: { id: itemId, name: `${label}.txt`, type: 'file', category: 'document', status: 'normal', ownerId: userId, driveId, parentId: null, size: 0 },
  })
  return { userId, itemId }
}

const seeded: { id: string; observedAt: Date; kind: Kind }[] = []

beforeAll(async () => {
  ;({ userId: ownerId, itemId: fileId } = await seedUser('feed-owner'))
  ;({ userId: otherId, itemId: otherFileId } = await seedUser('feed-other'))
  // Inserted out of time order, so a feed that followed insertion order fails.
  const kinds: Kind[] = ['restored', 'uploaded', 'viewed']
  const minutes = [7, 2, 14, 0, 11, 5, 9, 13, 1, 4, 12, 3, 10, 6, 8]
  for (const [i, minute] of minutes.entries()) seeded.push(await seedActivity(fileId, minute, kinds[i % 3]))
  // Newer than all of the owner's, on an item the owner can't see.
  await seedActivity(otherFileId, 30, 'restored')
})

afterAll(async () => {
  await wipeTestUsers([ownerId, otherId])
  // Activity rows cascade with their item; the rows they pointed at don't.
  await prisma.itemAction.deleteMany({ where: { id: { in: itemActionIds } } })
  await prisma.restoreAction.deleteMany({ where: { id: { in: restoreIds } } })
  await prisma.uploadAction.deleteMany({ where: { id: { in: uploadIds } } })
  await prisma.activityTime.deleteMany({ where: { id: { in: timeIds } } })
})

describe('getRecentActivityForUser', () => {
  it('returns the newest `limit` activities, newest first, with their kinds', async () => {
    const feed = await getRecentActivityForUser({ userId: ownerId, limit: 12 })
    const expected = [...seeded].sort((a, b) => b.observedAt.getTime() - a.observedAt.getTime()).slice(0, 12)

    expect(feed.map((row) => row.id)).toEqual(expected.map((row) => row.id))
    expect(feed.map((row) => row.kind)).toEqual(expected.map((row) => row.kind))
    expect(feed.map((row) => row.observedAt)).toEqual(expected.map((row) => row.observedAt))
    expect(feed.every((row) => row.item?.id === fileId)).toBe(true)
  })

  it('leaves out activity on items the user does not own', async () => {
    const feed = await getRecentActivityForUser({ userId: ownerId, limit: 50 })
    expect(feed).toHaveLength(seeded.length)
    expect(feed.some((row) => row.item?.id === otherFileId)).toBe(false)
  })

  it('returns nothing for a user with no activity', async () => {
    const { userId } = await seedUser('feed-empty')
    try {
      expect(await getRecentActivityForUser({ userId, limit: 12 })).toEqual([])
    } finally {
      await wipeTestUsers([userId])
    }
  })
})
