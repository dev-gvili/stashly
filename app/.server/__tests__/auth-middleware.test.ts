import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { RouterContextProvider } from 'react-router'

vi.mock('@/services/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))

import { auth } from '@/services/auth'
import { authMiddleware } from '@/services/middleware/auth'
import { sessionContext } from '@/services/middleware/context'

/**
 * The session is served from a 5-minute cookie cache. A server-side
 * `getSession` puts the cache cookie it refreshed in its own headers, so the
 * middleware must forward it, or the cache lapses for good once it expires.
 * The upload routes run it themselves: an upload is a long run of API calls
 * with no page load to refresh the cookie (tech-debt item 35).
 */
const REFRESHED = 'better-auth.session_data=jwe; Max-Age=300; Path=/; HttpOnly; SameSite=Lax'

function lookupReturns(session: unknown, cookie?: string) {
  const headers = new Headers()
  if (cookie) headers.append('set-cookie', cookie)
  vi.mocked(auth.api.getSession).mockResolvedValueOnce({ headers, response: session } as never)
}

const run = (next = async () => new Response('ok')) => {
  const context = new RouterContextProvider()
  const result = authMiddleware(
    { request: new Request('http://localhost/api/s3/upload'), context, params: {} } as never,
    next as never
  )
  return { context, result }
}

describe('authMiddleware', () => {
  it('puts the session on the context and forwards the refreshed cache cookie', async () => {
    lookupReturns({ user: { id: 'usr_1' } }, REFRESHED)
    const { context, result } = run()
    const response = (await result) as Response
    expect(context.get(sessionContext)).toEqual({ user: { id: 'usr_1' } })
    expect(response.headers.getSetCookie()).toEqual([REFRESHED])
  })

  it('adds no cookie while the cache is still fresh', async () => {
    lookupReturns({ user: { id: 'usr_1' } })
    const response = (await run().result) as Response
    expect(response.headers.getSetCookie()).toEqual([])
  })

  it('redirects a request with no session before the route runs', async () => {
    lookupReturns(null)
    const next = vi.fn(async () => new Response('ok'))
    await expect(run(next).result).rejects.toMatchObject({ status: 302 })
    expect(next).not.toHaveBeenCalled()
  })
})

/**
 * Routes under `api/` sit outside the app layout and don't inherit its
 * middleware, so each runs `authMiddleware` itself (tech-debt items 35, 62).
 * A new route fails here until it does, or is named below with its reason.
 */
const WITHOUT_AUTH_MIDDLEWARE: Record<string, string> = {
  'ai.ts': 'stub that ignores its arguments',
  'auth.ts': 'the better-auth handler itself',
  'health.ts': 'probed anonymously by Fly and CI',
  'images.ts': 'stub that ignores its arguments',
  'metrics.ts': 'beacon that answers 204 to everyone, signed in or not',
  'sidebar.ts': 'writes a preference cookie, reads no data',
  'stripe.ts': 'webhook, authenticated by its signature',
  'theme.ts': 'writes a preference cookie, reads no data',
  'view.ts': 'writes a preference cookie, reads no data',
}

const API_ROUTES = readdirSync('app/routes/api').filter((name) => name.endsWith('.ts'))

describe('API routes run authMiddleware themselves', () => {
  it.each(API_ROUTES.filter((name) => !(name in WITHOUT_AUTH_MIDDLEWARE)))('api/%s', (name) => {
    const source = readFileSync(`app/routes/api/${name}`, 'utf8')
    expect(source).toMatch(/export const middleware: Route\.MiddlewareFunction\[\] = \[authMiddleware\];?/)
    expect(source).not.toMatch(/auth\.api\.getSession/)
  })

  it('every exception still exists', () => {
    for (const name of Object.keys(WITHOUT_AUTH_MIDDLEWARE)) expect(API_ROUTES).toContain(name)
  })
})
