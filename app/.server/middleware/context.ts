import { createContext } from 'react-router'
import type { AuthSession } from '@/services/auth.types'
import type { WorkspaceMemberData } from '@/services/workspace-actions'

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

/**
 * Every workspace the signed-in user is a member of, with their role in each.
 *
 * Set by `workspaceMiddleware`, which no route registers since 2026-10-30: its
 * only reader, the layout loader, never revalidates, so the query ran on every
 * `.data` request for nothing, and that loader now reads the list itself
 * (tech-debt item 43). Both are kept for a workspace loader that wants the
 * list without a second query. This is a per-*user* value,
 * not a per-URL one — the sidebar lists the workspaces on every authenticated
 * page — so it is populated on all routes under the layout, not only the
 * `/:me/workspaces/:workspaceId/*` branch. A loader that wants the workspace
 * the URL points at finds it in this list by `params.workspaceId`.
 *
 * Created *with* a default, unlike `sessionContext`: an empty list is a
 * truthful answer for a user who belongs to no workspaces, so there is nothing
 * for a missing-middleware guard to distinguish.
 *
 * Membership here is reported, never enforced. Authorization stays in the
 * action layer, so a loader forwarding a `workspaceId` still gets the same
 * check it would have got otherwise.
 *
 * @example
 * export async function loader({ params, context }: Route.LoaderArgs) {
 *   const workspaces = context.get(workspaceContext)
 *   const current = workspaces.find((w) => w.workspaceId === params.workspaceId)
 * }
 */
export const workspaceContext = createContext<WorkspaceMemberData[]>([])
