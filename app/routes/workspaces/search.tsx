import type { Route } from './+types/search'

export async function loader({ request, params }: Route.LoaderArgs) {
  // TODO: implement loader logic
  return null
}

export async function action({ request, params }: Route.ActionArgs) {
  // TODO: implement action logic
  return null
}

export default () => {
  // This is a placeholder component for the search route.
  // You can implement your search UI here.
  return <div>Search Route</div>
}
