import { sessionContext } from '@/.server/middleware/context'
import type { Route } from './+types/collections'

export async function loader({ request, params, context }: Route.LoaderArgs) {
  // TODO: implement loader logic
  const session = context.get(sessionContext)
  // if (!session) throw new Error('Unauthorized')
  return { session }
}

export async function action({ request, params, context }: Route.ActionArgs) {
  // TODO: implement action logic
  return null
}

export default ({ loaderData }: Route.ComponentProps) => {
  // This is a placeholder component for the collections route.
  // You can implement your collections UI here.
  return <span>Collections Path</span>
}
