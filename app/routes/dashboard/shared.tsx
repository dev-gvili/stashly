import type { Route } from "./+types/shared";

export async function loader({ request, params }: Route.LoaderArgs) {
  // TODO: implement loader logic
  return null;
}

export async function action({ request, params }: Route.ActionArgs) {
  // TODO: implement action logic
  return null;
}

export default () => {
  // This is a placeholder component for the shared route.
  // You can implement your shared UI here.
  return <div>Shared Route</div>;
}