import { prisma } from '@/services/db'
import { StashlyError, StashlyErrorCode } from '@/utils/api.errors'
import { getPrefixForModel, toObjectId } from '@/utils/converters'
import { NotificationType, NotificationStatus, NotificationKind } from '@/prisma/enums'
import type { Prisma } from '@/prisma/client'
import { buildNotificationFilters } from '@/utils/filters/notification.filters'
import { searchFactory } from '@/utils/search'

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/**
 * Paginated, filterable search over Notification records.
 *
 * @example
 * const page = await searchNotifications({ userId: 'user_123', take: 20, strategy: 'cursor' })
 */
export const searchNotifications = searchFactory({
  dbDelegate: prisma.notification,
  buildFilters: buildNotificationFilters,
  defaultOrderBy: (): Prisma.NotificationOrderByWithRelationInput => ({ createdAt: 'desc' }),
})

/**
 * Returns a paginated list of notifications for a user.
 * Optionally filters by status and/or type.
 */
export async function listNotifications({
  userId,
  status,
  type,
  cursor,
  limit = 20,
}: {
  userId: string
  status?: NotificationStatus
  type?: NotificationType
  cursor?: string | null
  limit?: number
}) {
  const where: Prisma.NotificationWhereInput = {
    userId,
    ...(status ? { status } : {}),
    ...(type ? { type } : {}),
  }

  const notifications = await prisma.notification.findMany({
    where,
    take: limit + 1,
    cursor: cursor ? { id: cursor } : undefined,
    orderBy: { createdAt: 'desc' },
  })

  const hasMore = notifications.length > limit
  const data = notifications.slice(0, limit)
  const nextCursor = hasMore ? (data[data.length - 1]?.id ?? null) : null

  return { notifications: data, nextCursor, hasMore }
}

/**
 * Marks a single notification as read.
 * Enforces that the notification belongs to the requesting user.
 */
export async function markNotificationRead(id: string, userId: string) {
  const notification = await prisma.notification.findUnique({ where: { id } })
  if (!notification) {
    throw new StashlyError(StashlyErrorCode.NOT_FOUND, 'Notification not found')
  }
  if (notification.userId !== userId) {
    throw new StashlyError(StashlyErrorCode.FORBIDDEN, 'Cannot update another user\'s notification')
  }
  return prisma.notification.update({
    where: { id },
    data: { status: NotificationStatus.read },
  })
}

/**
 * Marks a single notification as unread.
 * Enforces that the notification belongs to the requesting user.
 */
export async function markNotificationUnread(id: string, userId: string) {
  const notification = await prisma.notification.findUnique({ where: { id } })
  if (!notification) {
    throw new StashlyError(StashlyErrorCode.NOT_FOUND, 'Notification not found')
  }
  if (notification.userId !== userId) {
    throw new StashlyError(StashlyErrorCode.FORBIDDEN, 'Cannot update another user\'s notification')
  }
  return prisma.notification.update({
    where: { id },
    data: { status: NotificationStatus.unread },
  })
}

/**
 * Marks all unread notifications for a user as read in a single query.
 */
export async function markAllNotificationsRead(userId: string) {
  return prisma.notification.updateMany({
    where: { userId, status: NotificationStatus.unread },
    data: { status: NotificationStatus.read },
  })
}

/**
 * Deletes a single notification.
 * Enforces that the notification belongs to the requesting user.
 */
export async function deleteNotification(id: string, userId: string) {
  const notification = await prisma.notification.findUnique({ where: { id } })
  if (!notification) {
    throw new StashlyError(StashlyErrorCode.NOT_FOUND, 'Notification not found')
  }
  if (notification.userId !== userId) {
    throw new StashlyError(StashlyErrorCode.FORBIDDEN, 'Cannot delete another user\'s notification')
  }
  return prisma.notification.delete({ where: { id } })
}

/**
 * Creates a new notification for a user.
 */
export async function createNotification({
  userId,
  message,
  type,
  kind = NotificationKind.system,
}: {
  userId: string
  message: string
  type: NotificationType
  kind?: NotificationKind
}) {
  return prisma.notification.create({
    data: {
      id: toObjectId(getPrefixForModel('Notification')),
      userId,
      message,
      type,
      kind,
      status: NotificationStatus.unread,
    },
  })
}
