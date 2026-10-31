import { afterEach, describe, expect, it, vi } from 'vitest'
import { RouterContextProvider } from 'react-router'

vi.mock('@/services/vinktar', () => ({ track: vi.fn() }))

import { track } from '@/services/vinktar'
import { sessionContext } from '@/services/middleware/context'
import {
  requestTimingMiddleware,
  SLOW_REQUEST_MS,
} from '@/services/middleware/request-timing'

/**
 * Only the outliers are sent: a request that fails (5xx) or answers slower
 * than `SLOW_REQUEST_MS`. Every other request sends nothing, since each
 * fetcher submission re-runs all of a page's loaders.
 */
function run({
  tookMs = 10,
  next = async () => new Response('ok'),
  url = 'http://localhost/usr_1/stash/folders/fld_2.data',
  session = false,
}: {
  tookMs?: number
  next?: () => Promise<Response>
  url?: string
  session?: boolean
} = {}) {
  const now = vi.spyOn(performance, 'now')
  now.mockReturnValueOnce(1000).mockReturnValueOnce(1000 + tookMs)
  const context = new RouterContextProvider()
  if (session) context.set(sessionContext, { user: { id: 'usr_1' } } as never)
  return requestTimingMiddleware(
    {
      request: new Request(url),
      context,
      params: {},
      pattern: '/:me/stash/folders/:folderId',
    } as never,
    next as never
  )
}

afterEach(() => {
  vi.mocked(track).mockClear()
  vi.restoreAllMocks()
})

describe('requestTimingMiddleware', () => {
  it('sends nothing for a fast, successful request', async () => {
    await run()
    expect(track).not.toHaveBeenCalled()
  })

  it('records a slow request with its pattern, kind and user', async () => {
    await run({ tookMs: SLOW_REQUEST_MS + 1, session: true })
    expect(track).toHaveBeenCalledWith(
      'route_request_slow',
      {
        route_pattern: '/:me/stash/folders/:folderId',
        method: 'GET',
        kind: 'data',
        status: 200,
        duration_ms: SLOW_REQUEST_MS + 1,
      },
      { userId: 'usr_1' }
    )
  })

  it('records a 5xx answer as failed, anonymously without a session', async () => {
    await run({
      next: async () => new Response('boom', { status: 500 }),
      url: 'http://localhost/api/items',
    })
    expect(track).toHaveBeenCalledWith(
      'route_request_failed',
      expect.objectContaining({ status: 500, kind: 'resource' }),
      undefined
    )
  })

  it('records a thrown error as a 500 and rethrows it', async () => {
    const error = new Error('loader crashed')
    await expect(
      run({
        next: async () => {
          throw error
        },
      })
    ).rejects.toBe(error)
    expect(track).toHaveBeenCalledWith(
      'route_request_failed',
      expect.objectContaining({ status: 500 }),
      undefined
    )
  })

  it('treats a thrown redirect as an answer, not a failure', async () => {
    await expect(
      run({
        next: async () => {
          throw new Response(null, { status: 302 })
        },
      })
    ).rejects.toBeInstanceOf(Response)
    expect(track).not.toHaveBeenCalled()
  })
})
