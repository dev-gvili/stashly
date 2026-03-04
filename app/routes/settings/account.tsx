import type { Route } from './+types/account'

export async function loader({ request, params }: Route.LoaderArgs) {
  // TODO: implement loader logic
  return null
}

export async function action({ request, params }: Route.ActionArgs) {
  // TODO: implement action logic
  return null
}

export default () => {
  // This is a placeholder component for the account route.
  // You can implement your account UI here.
  return <div>Account Route</div>
}
