import type { Route } from "./+types/trash";

export async function loader({ request, params }: Route.LoaderArgs) {
  // TODO: implement loader logic
  return null;
}

export async function action({ request, params }: Route.ActionArgs) {
  // TODO: implement action logic
  return null;
}

export default () => {
  // This is a placeholder component for the trash route.
  // You can implement your trash UI here.
  return <div>Trash Route</div>;
}