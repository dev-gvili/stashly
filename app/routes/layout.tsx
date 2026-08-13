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
import { Outlet, redirect, type ShouldRevalidateFunction } from 'react-router'
import type { Route } from './+types/layout'
import { sidebarCookie } from '@/.server/sidebar'
import z from 'zod'
import { Confirm } from '@/components/confirm-renderer'
import { useEmbeddingBackfill } from '@/hooks/useEmbeddingBackfill'
import { AppToolbar } from '@/components/app-toolbar'

export { ErrorBoundary } from '@/components/error-boundary'

export async function loader({ request }: Route.LoaderArgs) {
  const session = await auth.api.getSession({
    headers: request.headers
  })
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
        <Outlet />
        <UploadPanel user={user} />
        <UploadThumbnailRunner />
        <Confirm />
      </AppContent>
    </SidebarProvider>
  )
}
