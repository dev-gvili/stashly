import { AppContent } from '@/components/app-content'
import { AppSidebar } from '@/components/app-sidebar'
import { SidebarProvider } from '@/components/ui/sidebar'
// import { UploadPanel } from '@/machines/upload-v2/ui'
import { UploadPanel } from '@/components/upload'
import { UploadThumbnailRunner } from '@/components/upload/upload-thumbnail-runner'
import { auth } from '@/services/auth'
import {
  findStoragePlanById,
  findDefaultStoragePlan,
} from '@/.server/storagePlan-actions'
import { listNotifications } from '@/.server/notification-actions'
import { prisma } from '@/services/db'
import {
  createContext,
  Outlet,
  redirect,
  type ShouldRevalidateFunction,
} from 'react-router'
import type { AuthSession } from '@/.server/auth.types'
import type { Route } from './+types/layout'
import { sidebarCookie } from '@/.server/sidebar'
import z from 'zod'
import { Confirm } from '@/components/confirm-renderer'
import { useEmbeddingBackfill } from '@/hooks/useEmbeddingBackfill'
import { DegradedNotice } from '@/components/core-components/degraded-notice'
import { AppToolbar } from '@/components/app-toolbar'

export { ErrorBoundary } from '@/components/error-boundary'

/**
 * The authenticated session for the current request, resolved once by the
 * middleware below and read by loaders instead of calling `getSession` again.
 *
 * Defaults to `null` deliberately: `context.get()` **throws** on a context that
 * was never set and has no default, and this layout renders for unauthenticated
 * requests too (they are redirected before any loader runs).
 */
export const sessionContext = createContext<AuthSession | null>(null)

/**
 * Enforces that the `:me` segment names the signed-in user.
 *
 * This has to be middleware, not a loader check. React Router runs loaders in
 * **parallel**, so a parent loader that throws cannot stop a child loader's
 * query from executing — it only stops the data being returned. Middleware runs
 * parent-to-child *before any loader*, so a failure here means the child query
 * never happens at all.
 *
 * Every authenticated route hangs off this layout (`routes.ts`), so one check
 * here covers all 37 of them, and a route added tomorrow inherits it. `params.me`
 * is absent outside the `:me` prefix (`routes/index.tsx`, `auth/*`, `not-found`),
 * hence the conditional.
 */
export const middleware: Route.MiddlewareFunction[] = [
  async ({ request, params, context }) => {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) throw redirect('/auth/sign-in')

    if (params.me && params.me !== session.user.id) {
      throw new Response('Forbidden', { status: 403 })
    }

    context.set(sessionContext, session)
    // No explicit next(): React Router calls it when middleware neither throws
    // nor returns a Response.
  },
]

export async function loader({ request, context }: Route.LoaderArgs) {
  // Resolved by the middleware above; the redirect there means this is only
  // null in impossible states, but the type is nullable so we narrow.
  const session = context.get(sessionContext)
  if (!session) throw redirect('/auth/sign-in')
  // Determine the storage plan: prefer active subscription, then user.storagePlanId, then default
  let plan = await findStoragePlanById(session.user.storagePlanId)
  if (!plan) {
    plan = await findDefaultStoragePlan()
  }

  const [sidebarCookieValue, workspaceMemberships, notificationsPage] =
    await Promise.all([
      sidebarCookie.parse(request.headers.get('cookie')),
      prisma.workspaceMember.findMany({
        where: { memberId: session.user.id },
        select: {
          role: true,
          workspace: { select: { id: true, name: true, slug: true } },
        },
        orderBy: { workspace: { name: 'asc' } },
      }),
      listNotifications({ userId: session.user.id, limit: 30 }),
    ])

  return {
    user: session.user,
    notifications: notificationsPage.notifications,
    workspaces: workspaceMemberships.map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      slug: m.workspace.slug ?? m.workspace.id,
      role: m.role,
    })),
    storagePlan: {
      id: plan.id,
      name: plan.name,
      tag: plan.tag,
      type: plan.type,
      storageLimit: z.coerce.number().parse(plan.storageLimit),
      priceCents: plan.priceCents,
    },
    sidebarState: sidebarCookieValue,
  }
}

// The layout loader is heavy (storage plan, workspaces, notification seed), so
// it never revalidates on navigation. The notification bell stays live via the
// SSE stream (useNotificationStream) rather than by re-running this loader.
export const shouldRevalidate: ShouldRevalidateFunction = () => false

export default function StashlyLayout({ loaderData }: Route.ComponentProps) {
  const { user, sidebarState, workspaces } = loaderData
  // Re-embeds chunks whose vectors never got written because a previous
  // session ended mid-run. Idle-scheduled and once per tab.
  useEmbeddingBackfill()
  return (
    <SidebarProvider defaultOpen={sidebarState}>
      <AppSidebar user={user} workspaces={workspaces} />
      <AppContent>
        {/* <AppToolbar /> */}
        <DegradedNotice />
        <Outlet />
        <UploadPanel user={user} />
        <UploadThumbnailRunner />
        <Confirm />
      </AppContent>
    </SidebarProvider>
  )
}
