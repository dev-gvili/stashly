import { createContext } from 'react-router'
import type { AuthSession } from '@/services/auth.types'

/**
 * The authenticated session for the current request.
 *
 * Set by `authMiddleware` on the app layout, which redirects unauthenticated
 * requests before any loader runs — so inside a loader under that layout the
 * value is guaranteed to exist.
 *
 * Created without a default on purpose: `context.get()` throws when a context
 * was never set, which turns "the middleware did not run" into a loud error at
 * the point of use rather than a `null` every caller has to re-check.
 *
 * @example
 * export async function loader({ context }: Route.LoaderArgs) {
 *   const session = context.get(sessionContext) // guaranteed to exist
 *   return { user: session.user }
 * }
 */
export const sessionContext = createContext<AuthSession>()
