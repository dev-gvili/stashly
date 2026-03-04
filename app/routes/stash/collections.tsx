import { auth } from '@/.server/auth'
import type { Route } from './+types/collections'
import RecentFilesPage from '@/components/Gemini3DashboardFiles'

export { ErrorBoundary } from '@/components/error-boundary'
export async function loader({ request, params }: Route.LoaderArgs) {
  // TODO: implement loader logic
  const session = await auth.api.getSession(request)
  // if (!session) throw new Error('Unauthorized')
  return { session }
}

export async function action({ request, params }: Route.ActionArgs) {
  // TODO: implement action logic
  return null
}

export default ({ loaderData }: Route.ComponentProps) => {
  // This is a placeholder component for the collections route.
  // You can implement your collections UI here.
  return (
    <span>Collections Path</span>
  )
}
