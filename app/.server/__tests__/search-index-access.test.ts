import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '@/services/db'
import { appendSearchPage, saveMediaMetadata, setSearchChunkVectors } from '@/services/search-actions'
import { getPrefixForModel, toObjectId } from '@/utils/converters'
import { SEARCH_VECTOR_DIM } from '@/utils/search-query'
import { wipeTestUsers } from './helpers/wipe-test-users'

/**
 * The three index writes the browser submits after an upload — media facets,
 * OCR pages and chunk vectors — need `write` on the item. Before this none took
 * a user, so any signed-in user could rewrite another user's EXIF, append text
 * to their index or overwrite chunk vectors by id (tech-debt item 32). Needs a
 * live database (CI provides one).
 */
const uid = (model: Parameters<typeof getPrefixForModel>[0]) => toObjectId(getPrefixForModel(model))
const FORBIDDEN = { errorCode: 'FORBIDDEN', status: 403 }
const vector = () => Array.from({ length: SEARCH_VECTOR_DIM }, () => 0.1)

let ownerId: string
let strangerId: string
let driveId: string

async function makeItem(name: string) {
  const id = uid('Item')
  await prisma.item.create({
    data: { id, name, type: 'folder', category: 'unknown', status: 'normal', ownerId, driveId, parentId: null, size: 0 },
  })
  return id
}

async function makeChunk(itemId: string) {
  const id = uid('SearchChunk')
  await prisma.searchChunk.create({ data: { id, itemId, ord: 0, content: 'original', charStart: 0, charEnd: 8 } })
  return id
}

async function grant(userId: string, itemId: string, role: 'read' | 'write') {
  await prisma.permission.create({
    data: { id: uid('Permission'), itemId, roles: role, users: { connect: { id: userId } } },
  })
}

const imageWidthOf = async (itemId: string) => (await prisma.image.findFirst({ where: { itemId } }))?.width ?? null
const chunkCountOf = (itemId: string) => prisma.searchChunk.count({ where: { itemId } })
const hasVector = async (chunkId: string) => {
  const [row] = await prisma.$queryRaw<{ has: boolean }[]>`
    SELECT vector IS NOT NULL AS has FROM "SearchChunk" WHERE id = ${chunkId}
  `
  return row.has
}

beforeAll(async () => {
  ownerId = uid('User')
  await prisma.user.create({ data: { id: ownerId, name: 'Index owner', email: `index-${ownerId}@test.local`, emailVerified: true } })
  driveId = uid('Drive')
  await prisma.drive.create({ data: { id: driveId, ownerId } })
  strangerId = uid('User')
  await prisma.user.create({ data: { id: strangerId, name: 'Index stranger', email: `index-${strangerId}@test.local`, emailVerified: true } })
})

afterAll(async () => {
  await prisma.permission.deleteMany({ where: { users: { some: { id: strangerId } } } })
  await wipeTestUsers([ownerId, strangerId])
  await prisma.user.deleteMany({ where: { id: { in: [ownerId, strangerId] } } })
})

describe('saveMediaMetadata requires write access', () => {
  const metadata = (itemId: string) => ({ itemId, imageWidth: 640, imageHeight: 480, documentText: 'Some body text.' })

  it('refuses a user with no access: 403, no facet, no chunks', async () => {
    const item = await makeItem('not-yours')
    await expect(saveMediaMetadata(strangerId, metadata(item))).rejects.toMatchObject(FORBIDDEN)
    expect(await imageWidthOf(item)).toBeNull()
    expect(await chunkCountOf(item)).toBe(0)
  })

  it('refuses a user with only read access', async () => {
    const item = await makeItem('read-only')
    await grant(strangerId, item, 'read')
    await expect(saveMediaMetadata(strangerId, metadata(item))).rejects.toMatchObject(FORBIDDEN)
    expect(await imageWidthOf(item)).toBeNull()
  })

  it('allows the owner and returns the chunks to embed', async () => {
    const item = await makeItem('own')
    const chunks = await saveMediaMetadata(ownerId, metadata(item))
    expect(await imageWidthOf(item)).toBe(640)
    expect(chunks).toHaveLength(1)
  })

  it('allows a user granted write access', async () => {
    const item = await makeItem('shared-write')
    await grant(strangerId, item, 'write')
    await saveMediaMetadata(strangerId, metadata(item))
    expect(await imageWidthOf(item)).toBe(640)
  })
})

describe('appendSearchPage requires write access', () => {
  const page = (itemId: string) => ({ itemId, pageNum: 1, text: 'An OCR page.' })

  it('refuses a user with no access: 403, nothing appended', async () => {
    const item = await makeItem('not-yours')
    await expect(appendSearchPage(strangerId, page(item))).rejects.toMatchObject(FORBIDDEN)
    expect(await chunkCountOf(item)).toBe(0)
  })

  it('refuses a user with only read access', async () => {
    const item = await makeItem('read-only')
    await grant(strangerId, item, 'read')
    await expect(appendSearchPage(strangerId, page(item))).rejects.toMatchObject(FORBIDDEN)
    expect(await chunkCountOf(item)).toBe(0)
  })

  it('allows the owner and a write grantee', async () => {
    const own = await makeItem('own')
    expect(await appendSearchPage(ownerId, page(own))).toHaveLength(1)
    const shared = await makeItem('shared-write')
    await grant(strangerId, shared, 'write')
    expect(await appendSearchPage(strangerId, page(shared))).toHaveLength(1)
  })
})

describe('setSearchChunkVectors requires write access on every chunk item', () => {
  it('refuses a user with no access: 403, vector untouched', async () => {
    const chunk = await makeChunk(await makeItem('not-yours'))
    await expect(setSearchChunkVectors(strangerId, [{ chunkId: chunk, vector: vector() }])).rejects.toMatchObject(FORBIDDEN)
    expect(await hasVector(chunk)).toBe(false)
  })

  it('refuses a user with only read access', async () => {
    const item = await makeItem('read-only')
    await grant(strangerId, item, 'read')
    const chunk = await makeChunk(item)
    await expect(setSearchChunkVectors(strangerId, [{ chunkId: chunk, vector: vector() }])).rejects.toMatchObject(FORBIDDEN)
    expect(await hasVector(chunk)).toBe(false)
  })

  it('refuses a mixed batch whole: the allowed chunk is not written either', async () => {
    const shared = await makeItem('shared-write')
    await grant(strangerId, shared, 'write')
    const allowed = await makeChunk(shared)
    const refused = await makeChunk(await makeItem('not-yours'))
    await expect(
      setSearchChunkVectors(strangerId, [
        { chunkId: allowed, vector: vector() },
        { chunkId: refused, vector: vector() },
      ]),
    ).rejects.toMatchObject(FORBIDDEN)
    expect(await hasVector(allowed)).toBe(false)
    expect(await hasVector(refused)).toBe(false)
  })

  it('writes a batch spanning an owned item and a write-shared one', async () => {
    const shared = await makeItem('shared-write')
    await grant(strangerId, shared, 'write')
    const sharedChunk = await makeChunk(shared)
    const strangerDrive = uid('Drive')
    await prisma.drive.create({ data: { id: strangerDrive, ownerId: strangerId } })
    const ownItem = uid('Item')
    await prisma.item.create({
      data: { id: ownItem, name: 'stranger-own', type: 'folder', category: 'unknown', status: 'normal', ownerId: strangerId, driveId: strangerDrive, parentId: null, size: 0 },
    })
    const ownChunk = await makeChunk(ownItem)
    expect(
      await setSearchChunkVectors(strangerId, [
        { chunkId: sharedChunk, vector: vector() },
        { chunkId: ownChunk, vector: vector() },
      ]),
    ).toBe(2)
    expect(await hasVector(sharedChunk)).toBe(true)
    expect(await hasVector(ownChunk)).toBe(true)
  })

  it('ignores an unknown chunk id rather than refusing the batch', async () => {
    const own = await makeChunk(await makeItem('own'))
    expect(
      await setSearchChunkVectors(ownerId, [
        { chunkId: own, vector: vector() },
        { chunkId: uid('SearchChunk'), vector: vector() },
      ]),
    ).toBe(1)
  })
})
