import { describe, expect, it, vi } from 'vitest'

// The route's session comes from the context authMiddleware leaves; the auth
// module itself is mocked so importing the route needs no auth setup. A
// malformed body must be refused before any item action runs.
vi.mock('@/services/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))
// `createUploadedItem` is replaced so the upload cases can read what the route
// hands it; every other action keeps its real implementation.
vi.mock('@/services/item-actions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/item-actions')>()),
  createUploadedItem: vi.fn(async (data: { id: string; size: bigint }) => ({ id: data.id, size: data.size })),
}))

import { RouterContextProvider } from 'react-router'
import { sessionContext } from '@/services/middleware/context'
import { createUploadedItem } from '@/services/item-actions'
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
 * The size is the client's claim and is charged to the quota, so a negative one
 * would give quota back; it is refused before any action runs.
 */
describe('create_upload_item', () => {
  const session = { id: 'usr_me', driveId: 'drv_mine', bucket: 'bucket-mine' }
  const upload = (overrides: Record<string, string> = {}): [string, string][] =>
    Object.entries({
      intent: 'create_upload_item',
      id: 'item_new',
      name: 'a.jpg',
      key: 'item_root/a.jpg',
      size: '1024',
      bucket: 'bucket-other',
      driveId: 'drv_other',
      parentId: 'item_root',
      ownerId: 'usr_other',
      uploadId: 'up_1',
      ...overrides,
    })

  async function send(form: [string, string][]) {
    const body = new FormData()
    for (const [key, value] of form) body.append(key, value)
    const context = new RouterContextProvider()
    context.set(sessionContext, { user: session } as never)
    try {
      const result = await action({
        request: new Request('http://localhost/api/items', { method: 'POST', body }),
        params: {},
        context,
      } as never)
      return (result as { init?: { status?: number } } | null)?.init?.status ?? 200
    } catch (thrown) {
      return (thrown as { init?: { status?: number } }).init?.status ?? 500
    }
  }

  it('files into the session user’s drive, bucket and name, whatever the form says', async () => {
    vi.mocked(createUploadedItem).mockClear()
    expect(await send(upload())).toBe(200)
    expect(createUploadedItem).toHaveBeenCalledWith(
      expect.objectContaining({ driveId: 'drv_mine', bucket: 'bucket-mine', ownerId: 'usr_me' })
    )
  })

  it.each(['-1', '-1000000000'])('refuses a negative size (%s) with 400 and charges nothing', async (size) => {
    vi.mocked(createUploadedItem).mockClear()
    expect(await send(upload({ size }))).toBe(400)
    expect(createUploadedItem).not.toHaveBeenCalled()
  })

  it('accepts an empty file', async () => {
    vi.mocked(createUploadedItem).mockClear()
    expect(await send(upload({ size: '0' }))).toBe(200)
    expect(createUploadedItem).toHaveBeenCalledWith(expect.objectContaining({ size: 0n }))
  })
})
