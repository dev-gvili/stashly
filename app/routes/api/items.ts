import type { Route } from "./+types/items"

export async function loader({ request, params }: Route.LoaderArgs) {
  // TODO: implement loader logic
  return null;
}

export async function action({ request, params }: Route.ActionArgs) {
  // TODO: implement action logic
  const formData = await request.formData()
  console.log("Form Data:", {data: Object.fromEntries(formData.entries())})
  return null;
}