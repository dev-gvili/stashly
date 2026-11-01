import { describe, expect, it, vi } from 'vitest'

// These routes read the session from the context `authMiddleware` fills; the
// test fills it with a signed-in user, and stubs the auth module so better-auth
// isn't loaded. A malformed request must be refused with 400 by the parser,
// before any action (or the database) is reached.
vi.mock('@/services/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))

import { RouterContextProvider } from 'react-router'
import { sessionContext } from '@/services/middleware/context'
import * as activities from '../activities'
import * as collections from '../collections'
import * as comments from '../comments'
import * as invitations from '../invitations'
import * as locks from '../locks'
import * as members from '../members'

type Handler = (args: never) => unknown

/** The status of the `data()` response the handler threw, or of what it returned. */
async function statusOf(handler: Handler, request: Request, params: Record<string, string> = {}) {
  try {
    const context = new RouterContextProvider()
    context.set(sessionContext, {
      user: { id: 'usr_test', email: 'test@example.com', driveId: 'drv_test' },
    } as never)
    const result = await handler({ request, params, context } as never)
    if (result instanceof Response) return result.status
    return (result as { init?: { status?: number } } | null)?.init?.status ?? 200
  } catch (thrown) {
    if (thrown instanceof Response) return thrown.status
    return (thrown as { init?: { status?: number } }).init?.status ?? 500
  }
}

const get = (path: string) => new Request(`http://localhost${path}`)

function post(path: string, form: [string, string][]) {
  const body = new FormData()
  for (const [key, value] of form) body.append(key, value)
  return new Request(`http://localhost${path}`, { method: 'POST', body })
}

describe('API loaders refuse a malformed query with 400, not 500', () => {
  it('GET /api/activities with a non-numeric take', async () => {
    expect(await statusOf(activities.loader, get('/api/activities?take=abc'))).toBe(400)
  })

  it('GET /api/collections with a non-numeric take', async () => {
    expect(await statusOf(collections.loader, get('/api/collections?take=abc'))).toBe(400)
  })

  it('GET /api/comments with itemId sent twice', async () => {
    expect(await statusOf(comments.loader, get('/api/comments?itemId=a&itemId=b'))).toBe(400)
  })

  it('GET /api/invitations with an unknown type', async () => {
    expect(await statusOf(invitations.loader, get('/api/invitations?type=bogus'))).toBe(400)
  })

  it('GET /api/locks with an unknown intent', async () => {
    expect(await statusOf(locks.loader, get('/api/locks?intent=bogus'))).toBe(400)
  })

  it('GET /api/members without a workspaceId', async () => {
    expect(await statusOf(members.loader, get('/api/members'))).toBe(400)
  })
})

describe('API actions refuse a malformed body with 400, not 500', () => {
  it('POST /api/collections with an unknown intent', async () => {
    expect(
      await statusOf(collections.action, post('/api/collections', [['intent', 'set_anything']]))
    ).toBe(400)
  })

  it('POST /api/invitations with an unknown intent', async () => {
    expect(
      await statusOf(invitations.action, post('/api/invitations', [['intent', 'set_anything']]))
    ).toBe(400)
  })

  it('POST /api/locks lock without its itemId', async () => {
    expect(await statusOf(locks.action, post('/api/locks', [['intent', 'lock']]))).toBe(400)
  })
})
