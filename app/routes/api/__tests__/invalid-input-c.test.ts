import { describe, expect, it, vi } from 'vitest'

// A request that fails its route's Zod schema is the caller's error: the
// parsers throw INVALID_INPUT (400), and a handler that lets it escape is
// answered 500 by React Router. Each case below runs before any action does.
// The routes read the session from the context `authMiddleware` fills; the auth
// module is stubbed so better-auth isn't loaded.
vi.mock('@/services/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))

import { RouterContextProvider } from 'react-router'
import { sessionContext } from '@/services/middleware/context'
import { action as sidebarAction } from '../sidebar'
import { loader as thumbnailsLoader } from '../thumbnails'
import { loader as versionsLoader } from '../versions'
import { loader as workspacesLoader, action as workspacesAction } from '../workspaces'

function context() {
  const ctx = new RouterContextProvider()
  ctx.set(sessionContext, { user: { id: 'usr_test' } } as never)
  return ctx
}

function form(entries: [string, string][]) {
  const body = new FormData()
  for (const [key, value] of entries) body.append(key, value)
  return body
}

/** The status of the `data()` response the handler threw, or of what it returned. */
async function statusOf(run: () => unknown): Promise<number> {
  try {
    const result = await run()
    return (result as { init?: { status?: number } } | null)?.init?.status ?? 200
  } catch (thrown) {
    return (thrown as { init?: { status?: number } }).init?.status ?? 500
  }
}

describe('a malformed request is refused with 400, not 500', () => {
  it('POST /api/sidebar without an id', async () => {
    const request = new Request('http://localhost/api/sidebar', {
      method: 'POST',
      body: form([['state', 'true']]),
    })
    expect(await statusOf(() => sidebarAction({ request }))).toBe(400)
  })

  it('GET /api/thumbnails/:itemId with an unknown intent', async () => {
    const request = new Request('http://localhost/api/thumbnails/item_a?intent=steal')
    expect(
      await statusOf(() =>
        thumbnailsLoader({ request, params: { itemId: 'item_a' }, context: context() } as never)
      )
    ).toBe(400)
  })

  // The search-param decoder turns "true" into a boolean, which `z.string()` refuses.
  it('GET /api/versions with a non-string itemId', async () => {
    const request = new Request('http://localhost/api/versions?itemId=true')
    expect(
      await statusOf(() => versionsLoader({ request, params: {}, context: context() } as never))
    ).toBe(400)
  })

  it('GET /api/workspaces with a non-string userId', async () => {
    const request = new Request('http://localhost/api/workspaces?userId=true')
    expect(
      await statusOf(() => workspacesLoader({ request, params: {}, context: context() } as never))
    ).toBe(400)
  })

  it('POST /api/workspaces with an unknown intent', async () => {
    const request = new Request('http://localhost/api/workspaces', {
      method: 'POST',
      body: form([['intent', 'set_anything']]),
    })
    expect(
      await statusOf(() => workspacesAction({ request, params: {}, context: context() } as never))
    ).toBe(400)
  })
})
