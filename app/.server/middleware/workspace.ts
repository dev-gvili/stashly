import type { MiddlewareFunction } from 'react-router'
import { sessionContext, workspaceContext } from '@/services/middleware/context'
import { findAllMemberWorkspaces } from '@/services/workspace-actions'

/**
 * Loads the caller's workspace memberships once per request and puts them on
 * the router context.
 *
 * **Not registered on any route since 2026-10-30** (tech-debt item 43). Its
 * only reader was the layout loader, which never revalidates, so on the layout
 * it queried `WorkspaceMember` on every `.data` request for a result nothing
 * read; the loader now calls `findAllMemberWorkspaces` itself. Register it on
 * the route whose loaders read `workspaceContext`, not on the layout.
 *
 * This is a per-*user* value, not a per-URL one: the sidebar renders the list
 * on every authenticated page, so the middleware runs on the whole layout
 * rather than only the `/:me/workspaces/:workspaceId/*` branch. A loader that
 * needs the workspace the URL points at picks it out of the list by
 * `params.workspaceId` — no second query.
 *
 * A parent *loader* cannot supply this: React Router runs loaders in parallel,
 * so a child loader can never await the layout's result. Middleware runs
 * parent-to-child before any loader, which makes context the only way to
 * compute it once and share it down.
 *
 * This resolves scope; it does not enforce it. Membership is reported, never
 * asserted, because authorization lives in the action layer where a new caller
 * cannot bypass it. Loaders forward scope, actions decide authority.
 */
export const workspaceMiddleware: MiddlewareFunction<Response> = async ({
  context,
}) => {
  const session = context.get(sessionContext)

  context.set(workspaceContext, await findAllMemberWorkspaces(session.user.id))
}
