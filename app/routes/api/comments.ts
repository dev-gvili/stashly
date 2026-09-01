import { data, redirect } from 'react-router'
import { auth } from '@/services/auth'
import type { Route } from './+types/comments'
import { parseFormData, parseSearchParams } from '@/utils/parsers'
import {
  commentsLoaderInput,
  commentsApiRouteInput,
} from '@/schemas/api.schemas'
import { toErrorInfo } from '@/utils/api.errors'
import {
  listComments,
  createComment,
  updateComment,
  deleteComment,
} from '@/services/comment-actions'

export async function loader({ request, params }: Route.LoaderArgs) {
    const session = await auth.api.getSession({
    headers: request.headers,
  })
  if (!session) throw redirect('/auth/sign-in')

  const { itemId: queryItemId } = parseSearchParams({
    request,
    schema: commentsLoaderInput,
  })

  const itemId = params.itemId ?? queryItemId
  if (!itemId) {
    return data({ error: 'itemId is required' }, { status: 400 })
  }

  const comments = await listComments(itemId)
  return data({ comments })
}

export async function action({ request, params }: Route.ActionArgs) {
    const session = await auth.api.getSession({
    headers: request.headers,
  })
  if (!session) throw redirect('/auth/sign-in')

  const itemId = params.itemId
  if (!itemId) {
    return data({ error: 'itemId is required' }, { status: 400 })
  }

  try {
    const formData = await parseFormData({
      request,
      schema: commentsApiRouteInput,
    })

    if (formData.intent === 'create_comment') {
      const comment = await createComment({
        content: formData.content,
        itemId,
        ownerId: session.user.id,
      })
      return data({ comment }, { status: 201 })
    }

    if (formData.intent === 'update_comment') {
      const comment = await updateComment({
        commentId: formData.commentId,
        content: formData.content,
        ownerId: session.user.id,
      })
      return data({ comment })
    }

    if (formData.intent === 'delete_comment') {
      await deleteComment({
        commentId: formData.commentId,
        ownerId: session.user.id,
      })
      return data({ success: true })
    }

    return data({ error: 'Invalid intent' }, { status: 400 })
  } catch (e) {
    const err = toErrorInfo(e)
    return data(
      { error: err.message ?? 'An error occurred' },
      { status: err.status ?? 500 }
    )
  }
}
