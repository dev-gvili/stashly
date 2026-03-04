import DocumentViewerPage from '@/components/DocumentViewer'
import type { Route } from './+types/recent'
export async function loader({ request, params }: Route.LoaderArgs) {
  return null
}

export async function action({ request, params }: Route.ActionArgs) {
  // TODO: implement action logic
  return null
}

export default (props: Route.ComponentProps) => {
  return <DocumentViewerPage />
  // return <span>Recent Path - {props.matches[1].loaderData.user.bucket}</span>;
}
