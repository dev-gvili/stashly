import { AppContent } from '@/components/app-content'
import { AppSidebar } from '@/components/app-sidebar'
import { SidebarProvider } from '@/components/ui/sidebar'
import { authMiddleware, meMiddleware } from '@/services/middleware/auth'
import { workspaceMiddleware } from '@/services/middleware/workspace'
import { listNotifications } from '@/services/notification-actions'
import { sidebarCookie } from '@/services/sidebar'
import {
  findDefaultStoragePlan,
  findStoragePlanById,
} from '@/services/storagePlan-actions'
import { Confirm } from '@/components/confirm-renderer'
import { DegradedNotice } from '@/components/core-components/degraded-notice'
import { UploadPanel } from '@/components/upload'
import { UploadActorContext } from '@/machines/upload/upload.context'
import { UploadThumbnailRunner } from '@/components/upload/upload-thumbnail-runner'
import { sessionContext, workspaceContext } from '@/.server/middleware/context'
import { useEmbeddingBackfill } from '@/hooks/useEmbeddingBackfill'
import { identifyUser } from '@/.client/vinktar'
import { useEffect } from 'react'
import { Outlet, type ShouldRevalidateFunction } from 'react-router'
import z from 'zod'
import type { Route } from './+types/layout'

export { ErrorBoundary } from '@/components/error-boundary'

// Every authenticated route hangs off this layout (see routes.ts), so these
// cover all of them and any route added later inherits them. Order matters:
// `workspaceMiddleware` reads the session the first one resolves, and runs on
// every branch — the sidebar lists workspaces on all pages, not just
// `/:me/workspaces/*`.
export const middleware: Route.MiddlewareFunction[] = [
  authMiddleware,
  meMiddleware,
  workspaceMiddleware,
]

export async function loader({ request, context }: Route.LoaderArgs) {
  // Resolved by the middleware above — no second getSession call.
  const session = context.get(sessionContext)
  const workspaces = context.get(workspaceContext)
  // Determine the storage plan: prefer active subscription, then user.storagePlanId, then default
  let plan = await findStoragePlanById(session.user.storagePlanId)
  if (!plan) {
    plan = await findDefaultStoragePlan()
  }

  const [sidebarCookieValue, notificationsPage] = await Promise.all([
    sidebarCookie.parse(request.headers.get('cookie')),
    listNotifications({ userId: session.user.id, limit: 30 }),
  ])

  return {
    user: session.user,
    notifications: notificationsPage.notifications,
    workspaces: workspaces.map((member) => ({
      id: member.id,
      workspaceId: member.workspaceId,
      name: member.workspace.name,
      slug: member.workspace.slug || '',
      role: member.role,
      description: member.workspace.description,
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
  // Every signed-in page passes here: covers sign-in, sign-up and a restored session.
  useEffect(() => identifyUser(user.id), [user.id])
  return (
    // The upload manager's life is scoped to this layout on purpose. `auth/*`
    // sits under its own layout, so leaving the app for the sign-in page
    // unmounts this Provider, which stops the actor, its file machines, and
    // their in-flight requests.
    <UploadActorContext.Provider>
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
    </UploadActorContext.Provider>
  )
}
