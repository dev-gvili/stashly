import { createContext } from 'react-router'
import type { AuthSession } from '@/.server/auth.types'

/**
 * The authenticated session for the current request.
 *
 * Set once by the middleware in `app/routes/layout.tsx`, which redirects
 * unauthenticated requests before any loader runs. Loaders under that layout
 * read it here instead of calling `auth.api.getSession` again.
 *
 * It lives in its own module rather than in `layout.tsx` on purpose: importing
 * a route module would pull that route's whole import graph — including its
 * `.server` imports — into every consumer, and React Router's build inspects
 * the import graph rather than what is actually referenced.
 *
 * The `null` default is required: `context.get()` throws on a context that was
 * never set and has no default, and this must stay readable in edge cases (an
 * error boundary rendering after a redirect, for instance).
 *
 * @example
 * export async function loader({ context }: Route.LoaderArgs) {
 *   const session = requireSession(context)
 *   return getThings(session.user.id)
 * }
 */
export const sessionContext = createContext<AuthSession | null>(null)

/**
 * Reads the session set by the layout middleware, narrowing away the `null`.
 *
 * Throws rather than redirecting: by the time a loader runs, the middleware has
 * already redirected anonymous requests, so a null here means the middleware
 * chain was bypassed — a bug to surface, not a state to recover from.
 *
 * @param context - The loader/action `context`.
 * @throws When no session is present, i.e. the layout middleware did not run.
 */
export function requireSession(context: {
  get: (c: typeof sessionContext) => AuthSession | null
}): AuthSession {
  const session = context.get(sessionContext)
  if (!session) {
    throw new Error(
      'No session in context — this route must render under the layout whose middleware sets it.'
    )
  }
  return session
}
