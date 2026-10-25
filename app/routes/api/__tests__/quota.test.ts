import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The route's only I/O: the session lookup and the quota actions. Mocking them
// keeps the test off the database while exercising the real request parsing,
// which is where a forged body is accepted or refused.
vi.mock('@/services/auth', () => ({
  auth: {
    api: { getSession: vi.fn(async () => ({ user: { id: 'usr_test' } })) },
  },
}))

const QUOTA = {
  id: 'qta_test',
  driveId: 'drv_test',
  used: 100n,
  deleted: 0n,
  total: 1000n,
  remaining: 900n,
  status: 'normal' as const,
}

vi.mock('@/services/quota-actions', () => ({
  findQuota: vi.fn(async () => QUOTA),
  verifyFreeQuota: vi.fn(() => true),
  checkFreeQuota: vi.fn((itemId: string) => ({ itemId, result: 'allowed' })),
  onItemsUploaded: vi.fn(async () => QUOTA),
  updateTotalQuota: vi.fn(async () => QUOTA),
  onItemsTrashed: vi.fn(async () => QUOTA),
  onItemsDeleted: vi.fn(async () => QUOTA),
  onItemsRestored: vi.fn(async () => QUOTA),
  onItemsCopied: vi.fn(async () => QUOTA),
}))

import { RouterContextProvider } from 'react-router'
import * as quotaActions from '@/services/quota-actions'
import { sessionContext } from '@/services/middleware/context'
import { action } from '../quota'

/** Every quota action that writes to the `Quota` row. */
const WRITERS = [
  'onItemsUploaded',
  'updateTotalQuota',
  'onItemsTrashed',
  'onItemsDeleted',
  'onItemsRestored',
  'onItemsCopied',
] as const

/** The context `authMiddleware` leaves for the route. */
function sessionFor(userId: string) {
  const context = new RouterContextProvider()
  context.set(sessionContext, { user: { id: userId } } as never)
  return context
}

function post(body: unknown) {
  return action({
    request: new Request('http://localhost/api/quota', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    params: {},
    context: sessionFor('usr_test'),
  } as never)
}

/** The status of the `data()` response the route threw, or of what it returned. */
async function statusOf(body: unknown): Promise<number> {
  try {
    await post(body)
    return 200
  } catch (thrown) {
    return (thrown as { init?: { status?: number } }).init?.status ?? 500
  }
}

function writesMade() {
  return WRITERS.filter((name) => vi.mocked(quotaActions[name]).mock.calls.length)
}

describe('/api/quota refuses bodies that would change the quota', () => {
  beforeEach(() => vi.clearAllMocks())

  // These six used to be accepted from any signed-in user. `update-total-quota`
  // replaced the storage limit with whatever number the body carried, and
  // `items-uploaded` let the client decide whether, and for how much, an
  // upload was billed. All quota writes now happen on the server.
  it.each([
    'items-uploaded',
    'update-total-quota',
    'items-trashed',
    'items-deleted',
    'items-restored',
    'items-copied',
  ])('rejects %s with 400 and writes nothing', async (forged) => {
    expect(await statusOf({ action: forged, dataSize: '999999999999' })).toBe(400)
    expect(writesMade()).toEqual([])
  })

  it('rejects a negative size with 400', async () => {
    expect(await statusOf({ action: 'verify-free-quota', dataSize: '-5000' })).toBe(400)
  })

  // No browser File can be larger than Number.MAX_SAFE_INTEGER bytes.
  it('rejects an oversized size with 400', async () => {
    expect(
      await statusOf({ action: 'verify-free-quota', dataSize: '99999999999999999999' })
    ).toBe(400)
  })

  it('rejects an unknown action with 400', async () => {
    expect(await statusOf({ action: 'set-anything', dataSize: '1' })).toBe(400)
  })
})

describe('/api/quota still serves what the client sends', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => expect(writesMade()).toEqual([]))

  // An empty file is a real upload, so asking about 0 bytes is valid.
  it('accepts a zero-byte size', async () => {
    expect(await statusOf({ action: 'verify-free-quota', dataSize: 0 })).toBe(200)
  })

  // The quota actor sends no `dataSize` for find-quota (quota.actors.ts).
  it('answers find-quota without a dataSize', async () => {
    const quota = await post({ action: 'find-quota', userId: 'usr_test' })
    expect(quota).toMatchObject({ total: 1000, used: 100 })
  })

  it('verifies free quota for the session user', async () => {
    expect(await post({ action: 'verify-free-quota', dataSize: '500' })).toBe(true)
    expect(quotaActions.verifyFreeQuota).toHaveBeenCalledWith(QUOTA, 500n)
  })

  it('checks free quota for an item', async () => {
    expect(
      await post({ action: 'check-free-quota', dataSize: '500', itemId: 'itm_1' })
    ).toEqual({ itemId: 'itm_1', result: 'allowed' })
  })
})
