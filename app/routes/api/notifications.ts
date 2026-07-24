import { data, redirect } from 'react-router'
import { auth } from '@/services/auth'
import type { Route } from './+types/notifications'
import { parseFormData, parseSearchParams } from '@/utils/parsers'
import {
  notificationsLoaderInput,
  notificationsApiRouteInput,
} from '@/schemas/api.schemas'
import {
  listNotifications,
  markNotificationRead,
  markNotificationUnread,
  markAllNotificationsRead,
  deleteNotification,
  createNotification,
} from '@/services/notification-actions'

export async function loader({ request }: Route.LoaderArgs) {
    const session = await auth.api.getSession({
    headers: request.headers,
  })
  if (!session) throw redirect('/auth/sign-in')

  try {
    const query = parseSearchParams({
      request,
      schema: notificationsLoaderInput,
    })
    const result = await listNotifications({
      userId: session.user.id,
      status: query.status,
      type: query.type,
      cursor: query.cursor,
      limit: query.limit,
    })
    return data(result)
  } catch (e) {
    const err = e as { statusCode?: number; message?: string }
    return data(
      { error: err.message ?? 'Failed to list notifications' },
      { status: err.statusCode ?? 500 }
    )
  }
}

export async function action({ request }: Route.ActionArgs) {
    const session = await auth.api.getSession({
    headers: request.headers,
  })
  if (!session) throw redirect('/auth/sign-in')

  try {
    const formData = await parseFormData({
      request,
      schema: notificationsApiRouteInput,
    })

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
    const err = e as { statusCode?: number; message?: string }
    return data(
      { error: err.message ?? 'An error occurred' },
      { status: err.statusCode ?? 500 }
    )
  }
}
