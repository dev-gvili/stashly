import type { Route } from "./+types/notifications";

export async function loader({ request, params }: Route.LoaderArgs) {
  // TODO: implement loader logic
  return null;
}

export async function action({ request, params }: Route.ActionArgs) {
  // TODO: implement action logic
  return null;
}

export default () => {
  // This is a placeholder component for the notifications route.
  // You can implement your notifications UI here.
  return <div>Notifications Route</div>;
}