import { RemoveIcon } from '@/components/icons'
import { Button } from '@/ui/button'
import { cn } from '@/utils/styles'
import { motion } from 'framer-motion'
import { useFetcher } from 'react-router'
import {
  formatRelativeTime,
  typeLabel,
  typeTileClass,
} from '@/utils/notifications'
import type { Notification } from '@/types/notification.types'
import { getKindIcon } from './notification-icons'

// ---------------------------------------------------------------------------
// Notification row
//
// Unread is signalled by contrast alone: a full-strength ink bar in the left
// gutter and foreground-weight body text. Read rows drop to muted-foreground
// and lose the bar. No tinted backgrounds — the palette has no hue to spend.
// ---------------------------------------------------------------------------

export function NotificationItem({
  notification,
  index = 0,
}: {
  notification: Notification
  index?: number
}) {
  const readFetcher = useFetcher()
  const dismissFetcher = useFetcher()

  // Optimistic: trust the in-flight intent before the loader revalidates.
  const pendingIntent = readFetcher.formData?.get('intent')
  const isUnread =
    pendingIntent === 'mark_read' ? false : notification.status === 'unread'

  // Optimistically remove the row while the delete is in flight.
  if (dismissFetcher.formData?.get('intent') === 'delete_notification')
    return null

  const Icon = getKindIcon(notification.kind)
  const isDismissing = dismissFetcher.state !== 'idle'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        type: 'spring',
        duration: 0.3,
        bounce: 0,
        delay: Math.min(index, 8) * 0.03,
      }}
      className={cn(
        'group relative flex gap-3 py-3 pl-5 pr-3 transition-colors',
        'hover:bg-accent/40 rounded-md',
        isDismissing && 'pointer-events-none opacity-50'
      )}
    >
      {/* ── type glyph ── */}
      <div
        className={cn(
          'grid size-8 shrink-0 place-items-center rounded-md',
          typeTileClass(notification.type),
          !isUnread && 'opacity-60'
        )}
      >
        <Icon className="size-4" />
      </div>

      {/* ── body ── */}
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'font-stashly text-sm leading-snug text-pretty',
            isUnread ? 'text-foreground' : 'text-muted-foreground'
          )}
        >
          {notification.message}
        </p>

        <div className="mt-1.5 flex items-center gap-2 text-xs uppercase tracking-[0.08em] text-muted-foreground">
          <span
            className={cn(
              notification.type === 'error' && 'text-destructive',
              isUnread && notification.type !== 'error' && 'text-foreground/70'
            )}
          >
            {typeLabel(notification.type)}
          </span>
          <span aria-hidden className="text-input">
            /
          </span>
          <time
            className="tabular-nums"
            dateTime={new Date(notification.createdAt).toISOString()}
          >
            {formatRelativeTime(notification.createdAt)}
          </time>
        </div>
      </div>

      {/* ── row actions ── */}
      <div className="flex shrink-0 items-start gap-1">
        {isUnread && (
          <readFetcher.Form method="post" action="/api/notifications">
            <input type="hidden" name="intent" value="mark_read" />
            <input
              type="hidden"
              name="notificationId"
              value={notification.id}
            />
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs uppercase tracking-[0.08em] text-muted-foreground opacity-0 focus-visible:opacity-100 group-hover:opacity-100 active:scale-[0.96]"
            >
              Mark read
            </Button>
          </readFetcher.Form>
        )}

        <dismissFetcher.Form method="post" action="/api/notifications">
          <input type="hidden" name="intent" value="delete_notification" />
          <input type="hidden" name="notificationId" value={notification.id} />
          <Button
            type="submit"
            variant="outline"
            size="icon-sm"
            title="Dismiss"
            className="size-6 rounded-sm text-muted-foreground opacity-0 focus-visible:opacity-100 group-hover:opacity-100 active:scale-[0.96]"
          >
            <RemoveIcon className="size-3.5" />
          </Button>
        </dismissFetcher.Form>
      </div>
    </motion.div>
  )
}
