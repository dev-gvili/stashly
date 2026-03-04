import FileManagementDashboard from '@/components/FileManagementDashboard'
import type { Route } from './+types/favorites'
import { auth } from '@/services/auth'
export async function loader({ request, params }: Route.LoaderArgs) {
  const session = await auth.api.getSession(request)
  // if (!session) throw new Error('Unauthorized')
  return { session }
}

export async function action({ request, params }: Route.ActionArgs) {
  // TODO: implement action logic
  return null
}

export default ({ loaderData }: Route.ComponentProps) => {
  const { session } = loaderData
  return (
    <>
      <span>Favorites Path</span>
      <FileManagementDashboard />
    </>
  )
}
