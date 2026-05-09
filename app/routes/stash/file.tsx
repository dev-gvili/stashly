import type { Route } from './+types/file'
import {
  useLocation,
  useNavigate,
  type LinkProps,
  type UIMatch,
} from 'react-router'

import { breadcrumbs } from '@/services/breadcrumbs'
import { auth } from '@/services/auth'
import { redirect } from 'react-router'
import { getFileItem, touchOpenedAt } from '@/services/item-actions'

export async function loader({ request, params }: Route.LoaderArgs) {
  const session = await auth.api.getSession(request)
  if (!session) throw redirect('/auth/sign-in')

  const [, allCrumbs, item] = await Promise.all([
    touchOpenedAt(params.fileId),
    breadcrumbs(params.fileId),
    getFileItem(params.fileId, params.folderId),
  ])

  const crumbs =
    item.ownerId === session.user.id ? allCrumbs : allCrumbs.slice(-1)
  return { item, crumbs }
}

export async function action({ request, params }: Route.ActionArgs) {
  // TODO: implement action logic
  return null
}


export default ({ loaderData }: Route.ComponentProps) => {
  let { item, crumbs } = loaderData

  return (
    <div>
      <pre>
        <code className="font-stashly">
          {JSON.stringify(
            crumbs,
            (key, value) => {
              return key === 'size' || key === 'inclusiveSize'
                ? Number(value)
                : value
            },
            2
          )}
        </code>
      </pre>
      <pre>
        <code className="font-stashly">
          {JSON.stringify(
            item,
            (key, value) => {
              return key === 'size' || key === 'inclusiveSize'
                ? Number(value)
                : value
            },
            2
          )}
        </code>
      </pre>
    </div>
  )
}
