import { describe, expect, it, vi } from 'vitest'

// The route's session comes from the context authMiddleware leaves; the auth
// module itself is mocked so importing the route needs no auth setup. A
// malformed body must be refused before any item action runs.
vi.mock('@/services/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))

import { RouterContextProvider } from 'react-router'
import { sessionContext } from '@/services/middleware/context'
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
