import type { Route } from './+types/index'

export async function loader({ request, params }: Route.LoaderArgs) {
  // TODO: implement loader logic
  return null
}

export async function action({ request, params }: Route.ActionArgs) {
  // TODO: implement action logic
  return null
}

export default () => {
  // This is a placeholder component for the workspace route.
  // You can implement your workspace UI here.
  return <div>Workspace Index Route</div>
}
