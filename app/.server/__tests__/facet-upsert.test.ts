import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import pg from 'pg'
import { prisma } from '@/services/db'
import {
  upsertAudioFacet,
  upsertImageFacet,
  upsertMarkdownFacet,
  upsertPdfFacet,
  upsertVideoFacet,
} from '@/services/item-actions'
import { getPrefixForModel, toObjectId } from '@/utils/converters'
import { wipeTestUsers } from './helpers/wipe-test-users'

/**
 * Each media facet is one row per item (`itemId` is unique), written by
 * `save_media_metadata`. The writers used to `findFirst` and then `update` or
 * `create`: two round-trips, and two saves for the same item could both find
 * nothing, so the second `create` hit the unique index and failed (tech-debt
 * item 40). Needs a live database (CI provides one).
 */
const uid = (model: Parameters<typeof getPrefixForModel>[0]) =>
  toObjectId(getPrefixForModel(model))

let ownerId: string
let driveId: string

async function makeItem(name: string) {
  const id = uid('Item')
  await prisma.item.create({
    data: {
      id,
      name,
      type: 'folder',
      category: 'unknown',
      status: 'normal',
      ownerId,
      driveId,
      parentId: null,
      size: 0,
    },
  })
  return id
}

/**
 * The SQL statements sent to Postgres while `fn` runs, on any connection.
 * `holdInsertsMs` sends each INSERT that much later, so concurrent reads all
 * answer before any write lands: the window a read-then-write loses in. Without
 * it the race only showed up in some runs.
 */
async function statementsDuring(
  fn: () => Promise<unknown>,
  { holdInsertsMs = 0 } = {}
) {
  const sent: string[] = []
  const proto = pg.Client.prototype as {
    query: (...args: unknown[]) => unknown
  }
  const query = proto.query
  proto.query = function (this: unknown, ...args: unknown[]) {
    const first = args[0] as string | { text?: string }
    const text = typeof first === 'string' ? first : (first?.text ?? '')
    sent.push(text)
    if (!holdInsertsMs || !/^\s*insert/i.test(text)) {
      return Reflect.apply(query, this, args)
    }
    // pg answers a callback call with `undefined` and a plain call with a promise.
    if (typeof args.at(-1) === 'function') {
      setTimeout(() => Reflect.apply(query, this, args), holdInsertsMs)
      return undefined
    }
    return new Promise((r) => setTimeout(r, holdInsertsMs)).then(() =>
      Reflect.apply(query, this, args)
    )
  }
  try {
    await fn()
  } finally {
    proto.query = query
  }
  return sent
}

/** Each writer, saving `n` into one numeric field, and how to read it back. */
const FACETS = [
  {
    model: 'Image',
    save: (itemId: string, n: number) => upsertImageFacet(itemId, { width: n }),
    rows: (itemId: string) => prisma.image.count({ where: { itemId } }),
    value: async (itemId: string) =>
      (await prisma.image.findUnique({ where: { itemId } }))?.width,
  },
  {
    model: 'Video',
    save: (itemId: string, n: number) => upsertVideoFacet(itemId, { width: n }),
    rows: (itemId: string) => prisma.video.count({ where: { itemId } }),
    value: async (itemId: string) =>
      (await prisma.video.findUnique({ where: { itemId } }))?.width,
  },
  {
    model: 'Audio',
    save: (itemId: string, n: number) =>
      upsertAudioFacet(itemId, { duration: n }),
    rows: (itemId: string) => prisma.audio.count({ where: { itemId } }),
    value: async (itemId: string) =>
      (await prisma.audio.findUnique({ where: { itemId } }))?.duration,
  },
  {
    model: 'Pdf',
    save: (itemId: string, n: number) =>
      upsertPdfFacet(itemId, { pageCount: n }),
    rows: (itemId: string) => prisma.pdf.count({ where: { itemId } }),
    value: async (itemId: string) =>
      (await prisma.pdf.findUnique({ where: { itemId } }))?.pageCount,
  },
  {
    model: 'Markdown',
    save: (itemId: string, n: number) =>
      upsertMarkdownFacet(itemId, { wordCount: n }),
    rows: (itemId: string) => prisma.markdown.count({ where: { itemId } }),
    value: async (itemId: string) =>
      (await prisma.markdown.findUnique({ where: { itemId } }))?.wordCount,
  },
]

beforeAll(async () => {
  ownerId = uid('User')
  await prisma.user.create({
    data: {
      id: ownerId,
      name: 'Facet owner',
      email: `facet-${ownerId}@test.local`,
      emailVerified: true,
    },
  })
  driveId = uid('Drive')
  await prisma.drive.create({ data: { id: driveId, ownerId } })
})

afterAll(async () => {
  await wipeTestUsers([ownerId])
  await prisma.user.deleteMany({ where: { id: ownerId } })
})

describe.each(FACETS)('upsert$model Facet', ({ model, save, rows, value }) => {
  it('creates the row in one statement', async () => {
    const item = await makeItem(`${model}-create`)
    const sent = await statementsDuring(() => save(item, 640))
    expect(sent).toHaveLength(1)
    expect(await rows(item)).toBe(1)
    expect(await value(item)).toBe(640)
  })

  it('updates the existing row in one statement', async () => {
    const item = await makeItem(`${model}-update`)
    await save(item, 640)
    const sent = await statementsDuring(() => save(item, 800))
    expect(sent).toHaveLength(1)
    expect(await rows(item)).toBe(1)
    expect(await value(item)).toBe(800)
  })

  it('lets first saves race: all succeed, one row', async () => {
    const item = await makeItem(`${model}-race`)
    // Eight open connections first: on a cold pool the saves queue behind
    // connects and run one after another, and nothing races.
    await Promise.all(
      Array.from(
        { length: 8 },
        () => prisma.$queryRaw`SELECT 1 FROM pg_sleep(0.05)`
      )
    )
    let results: PromiseSettledResult<unknown>[] = []
    await statementsDuring(
      async () => {
        const saves = Array.from({ length: 8 }, (_, i) => save(item, 640 + i))
        results = await Promise.allSettled(saves)
      },
      { holdInsertsMs: 50 }
    )
    expect(results.filter((r) => r.status === 'rejected')).toEqual([])
    expect(await rows(item)).toBe(1)
  })
})

describe('upsertImageFacet', () => {
  it('keeps the fields an update leaves out', async () => {
    const item = await makeItem('image-partial')
    await upsertImageFacet(item, { width: 640, cameraMake: 'Apple' })
    await upsertImageFacet(item, { width: 800 })
    const row = await prisma.image.findUnique({ where: { itemId: item } })
    expect(row).toMatchObject({ width: 800, cameraMake: 'Apple' })
  })
})
