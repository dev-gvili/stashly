// ---------------------------------------------------------------------------
// Notification model types — mirrors the Prisma `Notification` record.
//
// NOTE: the exported `Notification` type intentionally shadows the DOM lib's
// global `Notification` interface inside any module that imports it. That is
// deliberate: nothing in the app uses the Web Notifications API, and the
// shorter name reads better at every call site.
// ---------------------------------------------------------------------------

import type { NotificationType, NotificationKind } from '@/prisma/enums'

export type Notification = {
  id: string
  message: string
  type: NotificationType
  kind: NotificationKind
  status: 'read' | 'unread'
  createdAt: string | Date
  updatedAt: string | Date
}

export type NotificationFilter = 'all' | 'unread' | 'alerts'

/**
 * Grouping by day — buckets are derived, not stored, so an empty bucket
 * simply never renders.
 */
export type NotificationGroup = {
  label: string
  items: Notification[]
}
