import { authMiddleware } from '@/services/middleware/auth'
import { sessionContext } from '@/services/middleware/context'
import { data } from 'react-router'
import type { Route } from './+types/notifications'
import { parseFormData, parseSearchParams } from '@/utils/parsers'
import {
  notificationsLoaderInput,
  notificationsApiRouteInput,
} from '@/schemas/api.schemas'
import { parseOrRespond, rethrowAsResponse, toErrorInfo } from '@/utils/api.errors'
import {
  listNotifications,
  markNotificationRead,
  markNotificationUnread,
  markAllNotificationsRead,
  deleteNotification,
  createNotification,
} from '@/services/notification-actions'

export const middleware: Route.MiddlewareFunction[] = [authMiddleware]

export async function loader({ request, context }: Route.LoaderArgs) {
  const session = context.get(sessionContext)

  try {
    const query = parseOrRespond(() =>
      parseSearchParams({
        request,
        schema: notificationsLoaderInput,
      })
    )
    const result = await listNotifications({
      userId: session.user.id,
      status: query.status,
      type: query.type,
      cursor: query.cursor,
      limit: query.limit,
    })
    return data(result)
  } catch (e) {
    const err = toErrorInfo(e)
    return data(
      { error: err.message ?? 'Failed to list notifications' },
      { status: err.status ?? 500 }
    )
  }
}

export async function action({ request, context }: Route.ActionArgs) {
  const session = context.get(sessionContext)

  try {
    const formData = await parseFormData({
      request,
      schema: notificationsApiRouteInput,
    }).catch(rethrowAsResponse)

    if (formData.intent === 'mark_read') {
      const notification = await markNotificationRead(
        formData.notificationId,
        session.user.id
      )
      return data({ notification })
    }

    if (formData.intent === 'mark_unread') {
      const notification = await markNotificationUnread(
        formData.notificationId,
        session.user.id
      )
      return data({ notification })
    }

    if (formData.intent === 'mark_all_read') {
      const result = await markAllNotificationsRead(session.user.id)
      return data({ count: result.count })
    }

    if (formData.intent === 'delete_notification') {
      await deleteNotification(formData.notificationId, session.user.id)
      return data({ success: true })
    }

    if (formData.intent === 'create_notification') {
      const notification = await createNotification({
        userId: session.user.id,
        message: formData.message,
        type: formData.type,
        kind: formData.kind,
      })
      return data({ notification }, { status: 201 })
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
