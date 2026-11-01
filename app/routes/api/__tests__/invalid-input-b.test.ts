import { describe, expect, it, vi } from 'vitest'

// These routes read the session with `auth.api.getSession` themselves; the mock
// hands them a signed-in user. A malformed request must be refused by the
// parser before any action runs, so no action module is mocked.
vi.mock('@/services/auth', () => ({
  auth: { api: { getSession: vi.fn(async () => ({ user: { id: 'usr_test' } })) } },
}))

import { RouterContextProvider } from 'react-router'
import * as notifications from '../notifications'
import * as permissions from '../permissions'
import * as pins from '../pins'
import * as search from '../search'
import * as settings from '../settings'
import * as shares from '../shares'

type Handler = (args: never) => Promise<unknown> | unknown

/** The status of the `data()` response the handler threw, or of what it returned. */
async function statusOf(handler: Handler, request: Request, params: Record<string, string> = {}) {
  try {
    const result = await handler({ request, params, context: new RouterContextProvider() } as never)
    return (result as { init?: { status?: number } } | null)?.init?.status ?? 200
  } catch (thrown) {
    return (thrown as { init?: { status?: number } }).init?.status ?? 500
  }
}

const get = (path: string) => new Request(`http://localhost${path}`)

function post(path: string, form: [string, string][]) {
  const body = new FormData()
  for (const [key, value] of form) body.append(key, value)
  return new Request(`http://localhost${path}`, { method: 'POST', body })
}

describe('API routes refuse a malformed request with 400, not 500', () => {
  it('GET /api/permissions without an itemId', async () => {
    expect(await statusOf(permissions.loader, get('/api/permissions'))).toBe(400)
  })

  it('POST /api/permissions with an unknown intent', async () => {
    expect(await statusOf(permissions.action, post('/api/permissions', [['intent', 'set_anything']]))).toBe(400)
  })

  it('GET /api/pins with an unknown intent', async () => {
    expect(await statusOf(pins.loader, get('/api/pins?intent=set_anything'))).toBe(400)
  })

  it('POST /api/pins with an unknown intent', async () => {
    expect(await statusOf(pins.action, post('/api/pins', [['intent', 'set_anything']]))).toBe(400)
  })

  it('GET /api/search/items with take=0', async () => {
    expect(
      await statusOf(search.loader, get('/api/search/items?query=hello&take=0'), { type: 'items' })
    ).toBe(400)
  })

  it('POST /api/search/items with an unknown intent', async () => {
    expect(
      await statusOf(search.action, post('/api/search/items', [['intent', 'set_anything'], ['query', 'hello']]), {
        type: 'items',
      })
    ).toBe(400)
  })

  it('GET /api/shares without an itemId', async () => {
    expect(await statusOf(shares.loader, get('/api/shares'))).toBe(400)
  })

  it('POST /api/shares with an unknown intent', async () => {
    expect(await statusOf(shares.action, post('/api/shares', [['intent', 'set_anything']]))).toBe(400)
  })

  // Already inside a try whose catch answers the parser's own status.
  it('GET /api/notifications with limit=0', async () => {
    expect(await statusOf(notifications.loader, get('/api/notifications?limit=0'))).toBe(400)
  })

  it('POST /api/notifications with an unknown intent', async () => {
    expect(
      await statusOf(notifications.action, post('/api/notifications', [['intent', 'set_anything']]))
    ).toBe(400)
  })

  it('POST /api/settings with an unknown intent', async () => {
    expect(await statusOf(settings.action, post('/api/settings', [['intent', 'set_anything']]))).toBe(400)
  })
})
