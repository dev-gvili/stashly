import type { MiddlewareFunction } from 'react-router'
import { sessionContext } from '@/services/middleware/context'
import { track } from '@/services/vinktar'

/** A request slower than this to answer is recorded as slow. */
export const SLOW_REQUEST_MS = 1000

/**
 * Records requests that fail (5xx) or answer slowly, per route pattern.
 *
 * Registered on the root, so it wraps every document, `.data` and resource
 * request, loaders and actions alike. Only the outliers are sent: every
 * fetcher submission re-runs all of a page's loaders, so one event per request
 * would bury everything else. The time is to the response's headers; a
 * streamed body (`<Await>`) keeps arriving after it.
 *
 * The user is read after `next()`, once `authMiddleware` below has set it;
 * routes outside the app layout have none and send anonymously.
 */
export const requestTimingMiddleware: MiddlewareFunction<Response> = async (
  { request, pattern, context },
  next
) => {
  const startedAt = performance.now()
  let status = 500
  try {
    const response = await next()
    status = response.status
    return response
  } catch (error) {
    // A thrown redirect or response is an answer, not a crash.
    if (error instanceof Response) status = error.status
    throw error
  } finally {
    const durationMs = Math.round(performance.now() - startedAt)
    const failed = status >= 500
    if (failed || durationMs > SLOW_REQUEST_MS) {
      const url = new URL(request.url)
      let userId: string | undefined
      try {
        userId = context.get(sessionContext).user.id
      } catch {
        // No session on this route.
      }
      track(
        failed ? 'route_request_failed' : 'route_request_slow',
        {
          route_pattern: pattern,
          method: request.method,
          kind: url.pathname.endsWith('.data')
            ? 'data'
            : request.headers.get('accept')?.includes('text/html')
              ? 'document'
              : 'resource',
          status,
          duration_ms: durationMs,
        },
        userId ? { userId } : undefined
      )
    }
  }
}
