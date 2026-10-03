import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '@/services/db'
import { getChildIdByName } from '@/services/item-actions'
import { getPrefixForModel, toObjectId } from '@/utils/converters'
import { wipeTestUsers } from './helpers/wipe-test-users'

/**
 * A relative Markdown link (`[spec](./spec.md)`) is resolved by name inside the
 * document's folder, so the name must lead to exactly one live file.
 *
 * - A trashed file keeps its `parentId`, so it still sat in the folder and the
 *   lookup (`findFirst` on parent and name only) could open it.
 * - Two live files with the name were a pick by `findFirst`'s missing order.
 *   No match is returned instead, the same "never guess" rule uploads follow.
 *
 * Needs a live database (CI provides one).
 */
const uid = (model: Parameters<typeof getPrefixForModel>[0]) => toObjectId(getPrefixForModel(model))

let ownerId: string
let driveId: string
let rootId: string

async function makeItem(name: string, parentId: string, status: 'normal' | 'trashed' = 'normal', type: 'file' | 'folder' = 'file') {
  const id = uid('Item')
  await prisma.item.create({
    data: { id, name, type, category: type === 'file' ? 'document' : 'unknown', status, ownerId, driveId, parentId, size: 0 },
  })
  return id
}

beforeAll(async () => {
  ownerId = uid('User')
  await prisma.user.create({ data: { id: ownerId, name: 'Child by name', email: `cbn-${ownerId}@test.local`, emailVerified: true } })
  driveId = uid('Drive')
  await prisma.drive.create({ data: { id: driveId, ownerId } })
  rootId = uid('Item')
  await prisma.item.create({
    data: { id: rootId, name: 'root', type: 'folder', category: 'unknown', status: 'normal', ownerId, driveId, parentId: null, size: 0 },
  })
})

afterAll(async () => {
  await wipeTestUsers([ownerId])
  await prisma.user.deleteMany({ where: { id: ownerId } })
})

describe('getChildIdByName', () => {
  it('resolves the live file and never the trashed one beside it', async () => {
    const folder = await makeItem('docs-a', rootId, 'normal', 'folder')
    await makeItem('spec.md', folder, 'trashed')
    const live = await makeItem('spec.md', folder)

    expect(await getChildIdByName(folder, 'spec.md')).toBe(live)
  })

  it('finds nothing when the only match is trashed', async () => {
    const folder = await makeItem('docs-b', rootId, 'normal', 'folder')
    await makeItem('gone.md', folder, 'trashed')

    expect(await getChildIdByName(folder, 'gone.md')).toBeNull()
  })

  it('refuses to pick between two live files with the name', async () => {
    const folder = await makeItem('docs-c', rootId, 'normal', 'folder')
    await makeItem('twin.md', folder)
    await makeItem('twin.md', folder)

    expect(await getChildIdByName(folder, 'twin.md')).toBeNull()
  })
})
