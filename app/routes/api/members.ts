import { authMiddleware } from '@/services/middleware/auth'
import { sessionContext } from '@/services/middleware/context'
import { data } from 'react-router'
import type { Route } from './+types/members'
import { parseFormData, parseSearchParams } from '@/utils/parsers'
import { membersLoaderInput, membersApiRouteInput } from '@/schemas/api.schemas'
import {
  getMembersForWorkspace,
  addMember,
  removeMember,
  changeRole,
} from '@/services/workspace-actions'
import { parseOrRespond, rethrowAsResponse, toErrorInfo } from '@/utils/api.errors'

export const middleware: Route.MiddlewareFunction[] = [authMiddleware]

export async function loader({ request, context }: Route.LoaderArgs) {
  const session = context.get(sessionContext)

  const params = parseOrRespond(() => parseSearchParams({ request, schema: membersLoaderInput }))

  const members = await getMembersForWorkspace(params.workspaceId)
  return data({ members })
}

export async function action({ request, context }: Route.ActionArgs) {
  const session = context.get(sessionContext)

  const formData = await parseFormData({ request, schema: membersApiRouteInput }).catch(
    rethrowAsResponse
  )

  try {
    if (formData.intent === 'add_member') {
      const member = await addMember(
        formData.userId,
        formData.workspaceId,
        formData.role
      )
      return data({ member })
    }

    if (formData.intent === 'remove_member') {
      const member = await removeMember(formData.userId, formData.workspaceId)
      return data({ member })
    }

    if (formData.intent === 'change_role') {
      const member = await changeRole(
        formData.userId,
        formData.workspaceId,
        formData.role
      )
      return data({ member })
    }
  } catch (e) {
    const err = toErrorInfo(e)
    return data(
      { error: err.message ?? 'Action failed' },
      { status: err.status ?? 500 }
    )
  }

  return data({ error: 'Invalid intent' }, { status: 400 })
}
