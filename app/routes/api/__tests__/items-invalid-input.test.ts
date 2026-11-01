import { beforeEach, describe, expect, it, vi } from 'vitest'

// The route's session comes from the context authMiddleware leaves; the auth
// module itself is mocked so importing the route needs no auth setup. A
// malformed body must be refused before any item action runs.
vi.mock('@/services/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))
// `createUploadedItem` is replaced so the upload cases can read what the route
// hands it; every other action keeps its real implementation.
vi.mock('@/services/item-actions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/item-actions')>()),
  createUploadedItem: vi.fn(async (data: { id: string; size: bigint }) => ({ id: data.id, size: data.size })),
  discardUploadedObject: vi.fn(async () => 'deleted'),
  getCardItems: vi.fn(async (_userId: string, ids: string[]) =>
    ids.map((id) => ({
      id,
      size: 1024n,
      inclusiveSize: 0n,
      createdAt: new Date('2026-11-01T00:00:00Z'),
      parent: { id: 'item_root', size: 2048n, inclusiveSize: 4096n, parent: null },
    }))
  ),
}))
// The stored object's HEAD is what the upload is charged for.
vi.mock('@/services/s3', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/s3')>()),
  headUploadedObject: vi.fn(),
}))

import { RouterContextProvider } from 'react-router'
import { sessionContext } from '@/services/middleware/context'
import { createUploadedItem, discardUploadedObject, getCardItems } from '@/services/item-actions'
import { headUploadedObject } from '@/services/s3'
import { StashlyError, StashlyErrorCode } from '@/utils/api.errors'
import { action } from '../items'

function post(form: [string, string][]) {
  const body = new FormData()
  for (const [key, value] of form) body.append(key, value)
  const context = new RouterContextProvider()
  context.set(sessionContext, { user: { id: 'usr_test' } } as never)
  return action({
    request: new Request('http://localhost/api/items', { method: 'POST', body }),
    params: {},
    context,
  } as never)
}

/** The status of the `data()` response the route threw, or of what it returned. */
async function statusOf(form: [string, string][]): Promise<number> {
  try {
    const result = await post(form)
    return (result as { init?: { status?: number } } | null)?.init?.status ?? 200
  } catch (thrown) {
    return (thrown as { init?: { status?: number } }).init?.status ?? 500
  }
}

describe('POST /api/items refuses a malformed body with 400, not 500', () => {
  it.each(['trash_items', 'restore_items', 'delete_items'])(
    '%s with selectedItems sent as repeated fields',
    async (intent) => {
      expect(
        await statusOf([
          ['intent', intent],
          ['selectedItems', 'item_a'],
          ['selectedItems', 'item_b'],
        ])
      ).toBe(400)
    }
  )

  it('an unknown intent', async () => {
    expect(await statusOf([['intent', 'set_anything']])).toBe(400)
  })

  it('rename_item without its new name', async () => {
    expect(await statusOf([['intent', 'rename_item'], ['itemId', 'item_a']])).toBe(400)
  })
})

/**
 * `create_upload_item` takes who and where from the session, never the form.
 * The size is charged from the stored object's HEAD: the form's `size` is the
 * client's claim, and a client declaring 0 stored any file for free. A negative
 * claim is still refused before anything runs.
 */
describe('create_upload_item', () => {
  const session = { id: 'usr_me', driveId: 'drv_mine', bucket: 'bucket-mine' }
  const upload = (overrides: Record<string, string> = {}): [string, string][] =>
    Object.entries({
      intent: 'create_upload_item',
      id: 'item_new',
      name: 'a.jpg',
      key: 'item_root/item_new/a.jpg',
      uploadPath: 'item_root/a.jpg',
      size: '1024',
      bucket: 'bucket-other',
      driveId: 'drv_other',
      parentId: 'item_root',
      ownerId: 'usr_other',
      uploadId: 'up_1',
      ...overrides,
    })

  async function respond(form: [string, string][]) {
    const body = new FormData()
    for (const [key, value] of form) body.append(key, value)
    const context = new RouterContextProvider()
    context.set(sessionContext, { user: session } as never)
    return action({
      request: new Request('http://localhost/api/items', { method: 'POST', body }),
      params: {},
      context,
    } as never)
  }

  async function send(form: [string, string][]) {
    try {
      const result = await respond(form)
      return (result as { init?: { status?: number } } | null)?.init?.status ?? 200
    } catch (thrown) {
      return (thrown as { init?: { status?: number } }).init?.status ?? 500
    }
  }

  beforeEach(() => {
    vi.mocked(createUploadedItem).mockClear()
    vi.mocked(discardUploadedObject).mockClear()
    vi.mocked(headUploadedObject).mockReset()
    vi.mocked(headUploadedObject).mockResolvedValue({ size: 1024n, etag: '"e"' })
  })

  it('files into the session user’s drive, bucket and name, whatever the form says', async () => {
    expect(await send(upload())).toBe(200)
    expect(createUploadedItem).toHaveBeenCalledWith(
      expect.objectContaining({ driveId: 'drv_mine', bucket: 'bucket-mine', ownerId: 'usr_me' })
    )
  })

  // The page inserts this row instead of reloading the folder (item 45). It is
  // the listing's card row, sent as JSON, so its BigInt sizes become numbers.
  it('answers with the card row the folder listing would show', async () => {
    const result = (await respond(upload())) as { data: { success: boolean; item: Record<string, unknown> } }
    expect(getCardItems).toHaveBeenCalledWith('usr_me', ['item_new'])
    expect(result.data.success).toBe(true)
    expect(result.data.item).toMatchObject({
      id: 'item_new',
      size: 1024,
      inclusiveSize: 0,
      parent: { size: 2048, inclusiveSize: 4096 },
    })
    expect(() => JSON.stringify(result.data)).not.toThrow()
  })

  // A partial row would render as a broken card; with none the page reloads.
  it('still reports success, with no row, when its card cannot be read', async () => {
    vi.mocked(getCardItems).mockRejectedValueOnce(new Error('read failed'))
    const result = (await respond(upload())) as { data: { success: boolean; item?: unknown } }
    expect(result.data.success).toBe(true)
    expect(result.data.item).toBeUndefined()
    expect(discardUploadedObject).not.toHaveBeenCalled()
  })

  it.each(['-1', '-1000000000'])('refuses a negative size (%s) with 400 and charges nothing', async (size) => {
    expect(await send(upload({ size }))).toBe(400)
    expect(createUploadedItem).not.toHaveBeenCalled()
  })

  it('accepts an empty file', async () => {
    vi.mocked(headUploadedObject).mockResolvedValue({ size: 0n, etag: '"e"' })
    expect(await send(upload({ size: '0' }))).toBe(200)
    expect(createUploadedItem).toHaveBeenCalledWith(expect.objectContaining({ size: 0n }))
  })

  it('charges the stored size when the form claims 0', async () => {
    vi.mocked(headUploadedObject).mockResolvedValue({ size: 5_000_000n, etag: '"abc"' })
    expect(await send(upload({ size: '0', etag: '"forged"' }))).toBe(200)
    expect(createUploadedItem).toHaveBeenCalledWith(
      expect.objectContaining({ size: 5_000_000n, etag: '"abc"' })
    )
  })

  it('charges the stored size when the form claims more', async () => {
    vi.mocked(headUploadedObject).mockResolvedValue({ size: 10n, etag: '"abc"' })
    expect(await send(upload({ size: '9999999999' }))).toBe(200)
    expect(createUploadedItem).toHaveBeenCalledWith(expect.objectContaining({ size: 10n }))
  })

  it('reads the object in the session user’s bucket, not the form’s', async () => {
    await send(upload())
    expect(headUploadedObject).toHaveBeenCalledWith('bucket-mine', 'item_root/item_new/a.jpg')
  })

  it('refuses an object that is not in storage, and deletes nothing', async () => {
    vi.mocked(headUploadedObject).mockResolvedValue(null)
    expect(await respond(upload())).toEqual({
      success: false,
      error: 'The uploaded file was not found in storage',
    })
    expect(createUploadedItem).not.toHaveBeenCalled()
    expect(discardUploadedObject).not.toHaveBeenCalled()
  })

  // No row points at the object yet, so a discard here would delete a good
  // upload over a storage blip, and nothing retries the row.
  it('refuses when storage cannot be read, and keeps the bytes', async () => {
    vi.mocked(headUploadedObject).mockRejectedValue(
      new StashlyError(StashlyErrorCode.SERVICE_UNAVAILABLE, 'Could not read the uploaded file from storage')
    )
    expect(await respond(upload())).toEqual({
      success: false,
      error: 'Could not read the uploaded file from storage',
    })
    expect(createUploadedItem).not.toHaveBeenCalled()
    expect(discardUploadedObject).not.toHaveBeenCalled()
  })
})
