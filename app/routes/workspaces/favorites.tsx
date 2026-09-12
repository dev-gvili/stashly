import { sessionContext } from '@/.server/middleware/context'
import type { Route } from './+types/favorites'
export async function loader({ request, params, context }: Route.LoaderArgs) {
  const session = context.get(sessionContext)
  // if (!session) throw new Error('Unauthorized')
  return { session }
}

export async function action({ request, params, context }: Route.ActionArgs) {
  // TODO: implement action logic
  return null
}

export default ({ loaderData }: Route.ComponentProps) => {
  const { session } = loaderData
  return <span>Favorites Path</span>
}
