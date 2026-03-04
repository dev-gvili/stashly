import type { Route } from './+types/workspace'
import { prisma } from '@/.server/db'

export async function loader({ request, params }: Route.LoaderArgs) {
  // TODO: implement loader logic
  return await prisma.workspace.findUnique({
    where: {
      id: params.workspaceId,
    },
  })
}

export async function action({ request, params }: Route.ActionArgs) {
  // TODO: implement action logic
  return null
}

export default ({ loaderData }: Route.ComponentProps) => {
  // This is a placeholder component for the workspace route.
  // You can implement your workspace UI here.
  return (
    <div>
      Workspace Route
      <h1>{loaderData?.name}</h1>
      <p>{loaderData?.description}</p>
      <p>{loaderData?.id}</p>
      <p>{loaderData?.slug}</p>
    </div>
  )
}
