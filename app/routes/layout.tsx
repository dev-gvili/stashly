import { AppContent } from '@/components/app-content'
import { AppSidebar } from '@/components/app-sidebar'
import { SidebarProvider } from '@/components/ui/sidebar'
// import { UploadPanel } from '@/machines/upload-v2/ui'
import { UploadPanel } from '@/components/upload'
import { auth } from '@/services/auth'
import { storagePlanRepository } from '@/services/repositories/StoragePlanRepository'
import { Outlet, redirect, type ShouldRevalidateFunction } from 'react-router'
import type { Route } from './+types/layout'
import { sidebarCookie } from '@/.server/sidebar'
import z from 'zod'
import { Confirm } from '@/components/confirm-renderer'

export { ErrorBoundary } from '@/components/error-boundary'

export async function loader({ request }: Route.LoaderArgs) {
  const session = await auth.api.getSession(request)
  if (!session) throw redirect('/auth/sign-in')
  // Determine the storage plan: prefer active subscription, then user.storagePlanId, then default
  let plan = await storagePlanRepository.findById(session.user.storagePlanId)
  if (!plan) {
    plan = await storagePlanRepository.findDefault()
  }

  const sidebarCookieValue = await sidebarCookie.parse(
    request.headers.get('cookie')
  )

  return {
    user: session.user,
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

export const shouldRevalidate: ShouldRevalidateFunction = () => false

export default function StashlyLayout({ loaderData }: Route.ComponentProps) {
  const { user, sidebarState } = loaderData
  return (
    <SidebarProvider defaultOpen={sidebarState}>
      <AppSidebar user={user} />
      <AppContent>
        <Outlet />
        <UploadPanel user={user} />
        <Confirm />
      </AppContent>
    </SidebarProvider>
  )
}
