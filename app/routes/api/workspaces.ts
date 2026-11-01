import { authMiddleware } from '@/services/middleware/auth'
import { sessionContext } from '@/services/middleware/context'
import { data } from 'react-router'
import type { Route } from './+types/workspaces'
import { parseFormData, parseSearchParams } from '@/utils/parsers'
import {
  workspacesLoaderInput,
  workspacesApiRouteInput,
} from '@/schemas/api.schemas'
import { parseOrRespond, rethrowAsResponse, toErrorInfo } from '@/utils/api.errors'
import { track } from '@/services/vinktar'
import {
  findWorkspaceById,
  findAllWorkspaces,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
  addMember,
} from '@/services/workspace-actions'

export const middleware: Route.MiddlewareFunction[] = [authMiddleware]

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const session = context.get(sessionContext)

  const query = parseOrRespond(() => parseSearchParams({ request, schema: workspacesLoaderInput }))

  // Resolve workspaceId from query params or URL params
  const workspaceId = query.workspaceId ?? (params as any).workspaceId

  if (workspaceId) {
    const workspace = await findWorkspaceById(workspaceId)
    return data({ workspaces: [workspace] })
  }

  // List workspaces — optionally filter by userId from params or query
  const userId = query.userId ?? params.userId ?? session.user.id
  const workspaces = await findAllWorkspaces({
    where: { members: { some: { memberId: userId } } },
  })
  return data({ workspaces })
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const session = context.get(sessionContext)

  const formData = await parseFormData({
    request,
    schema: workspacesApiRouteInput,
  }).catch(rethrowAsResponse)

  try {
    if (formData.intent === 'create_workspace') {
      const workspace = await createWorkspace({
        name: formData.name,
        slug: formData.slug,
      })
      await addMember(session.user.id, workspace.id, 'owner')
      track(
        'workspace_created',
        { workspace_id: workspace.id, name_length: formData.name.length },
        { userId: session.user.id }
      )
      return data({ workspace }, { status: 201 })
    }

    if (formData.intent === 'update_workspace') {
      const workspace = await updateWorkspace({
        where: { id: formData.workspaceId },
        data: {
          ...(formData.name !== undefined && { name: formData.name }),
          ...(formData.slug !== undefined && { slug: formData.slug }),
        },
      })
      return data({ workspace })
    }

    if (formData.intent === 'delete_workspace') {
      await deleteWorkspace(formData.workspaceId)
      return data({ success: true })
    }
  } catch (e) {
    const err = toErrorInfo(e)
    return data(
      { error: err.message ?? 'An error occurred' },
      { status: err.status ?? 500 }
    )
  }

  return data({ error: 'Invalid intent' }, { status: 400 })
}
