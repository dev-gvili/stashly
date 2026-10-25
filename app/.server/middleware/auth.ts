import { redirect, type MiddlewareFunction } from 'react-router'
import { auth } from '@/services/auth'
import { sessionContext } from '@/services/middleware/context'
import { forwardSetCookies } from '@/services/session-user'

/**
 * Resolves the session once per request and puts it on the router context.
 *
 * Runs before any loader, so unauthenticated requests are redirected without a
 * single route query executing. Loaders under this middleware read the session
 * with `context.get(sessionContext)` instead of calling `getSession` again.
 */
export const authMiddleware: MiddlewareFunction<Response> = async ({ request, context }, next) => {
  const { headers, response: session } = await auth.api.getSession({
    headers: request.headers,
    returnHeaders: true,
  })

  if (!session) {
    throw redirect('/auth/sign-in')
  }

  context.set(sessionContext, session)

  // The session cache cookie this lookup refreshed would otherwise be dropped.
  return forwardSetCookies(await next(), headers)
}

/**
 * Asserts that the `:me` URL segment names the signed-in user.
 *
 * Must be middleware rather than a loader check: React Router runs loaders in
 * parallel, so a parent loader that throws cannot stop a child loader's query
 * from executing — only from being returned. Middleware runs parent-to-child
 * before any loader, so a failure here means the child query never happens.
 *
 * `params.me` is absent outside the `:me` prefix (the index route, `auth/*`,
 * `not-found`), hence the conditional.
 */
export const meMiddleware: MiddlewareFunction<Response> = async ({ params, context }) => {
  const session = context.get(sessionContext)

  if (params.me && params.me !== session.user.id) {
    throw new Response('Forbidden', { status: 403 })
  }
}
