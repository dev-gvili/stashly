import { data, redirect } from 'react-router'
import { auth } from '@/services/auth'
import type { Route } from './+types/workspaces'
import { parseFormData, parseSearchParams } from '@/utils/parsers'
import {
  workspacesLoaderInput,
  workspacesApiRouteInput,
} from '@/schemas/api.schemas'
import {
  findWorkspaceById,
  findAllWorkspaces,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
  addMember,
} from '@/services/workspace-actions'

export async function loader({ request, params }: Route.LoaderArgs) {
  const session = await auth.api.getSession(request)
  if (!session) throw redirect('/auth/sign-in')

  const query = parseSearchParams({ request, schema: workspacesLoaderInput })

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

export async function action({ request, params }: Route.ActionArgs) {
  const session = await auth.api.getSession(request)
  if (!session) throw redirect('/auth/sign-in')

  const formData = await parseFormData({
    request,
    schema: workspacesApiRouteInput,
  })

  try {
    if (formData.intent === 'create_workspace') {
      const workspace = await createWorkspace({
        name: formData.name,
        slug: formData.slug,
      })
      await addMember(session.user.id, workspace.id, 'owner')
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
    const err = e as { statusCode?: number; message?: string }
    return data(
      { error: err.message ?? 'An error occurred' },
      { status: err.statusCode ?? 500 }
    )
  }

  return data({ error: 'Invalid intent' }, { status: 400 })
}
