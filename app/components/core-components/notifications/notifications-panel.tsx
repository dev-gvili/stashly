import React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useFetcher } from 'react-router'
import {
  DoubleCheckIcon,
  NotificationEmptyFillIcon,
  NotificationFullFillIcon,
} from '@/components/icons'
import { useNotificationStream } from '@/hooks/useNotificationStream'
import { Button } from '@/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/popover'
import { ScrollArea } from '@/ui/scroll-area'
import { cn } from '@/utils/styles'
import { NotificationItem } from './notification-item'
import {
  NOTIFICATION_FILTERS,
  applyFilter,
  countUnread,
  groupByDay,
  type Notification,
  type NotificationFilter,
} from './notification-model'
import { GenericEmptyState } from '@/components/states/generic-empty-state'

// ---------------------------------------------------------------------------
// Bell trigger — the unread count is the badge; zero renders nothing.
// ---------------------------------------------------------------------------

function NotificationBell({
  unread,
  ...props
}: React.ComponentPropsWithRef<typeof Button> & { unread: number }) {
  return (
    <Button
      variant="outline"
      size="icon"
      className="relative border rounded-md! items-center justify-center font-stashly bg-card! border-accent data-[state=open]:bg-muted/30 data-[state=open]:text-accent-foreground"
      aria-label={
        unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'
      }
      {...props}
    >
      <NotificationFullFillIcon className="size-5" />
      {unread > 0 && (
        <span
          className={cn(
            'absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full px-1',
            'bg-foreground text-[10px] leading-none text-background',
            'font-stashly tabular-nums'
          )}
        >
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </Button>
  )
}

// ---------------------------------------------------------------------------
// Empty state — an empty screen is an invitation to act, so each filter says
// something true about *why* it's empty rather than a shared shrug.
// ---------------------------------------------------------------------------

const EMPTY_COPY: Record<NotificationFilter, string> = {
  all: 'Nothing here yet. Activity on your files and shares shows up here.',
  unread: "You've read everything.",
  alerts: 'No warnings or failures.',
}

function NotificationsEmpty({ filter }: { filter: NotificationFilter }) {
  return (
    <GenericEmptyState
      title={filter}
      description={EMPTY_COPY[filter]}
      icon={<NotificationEmptyFillIcon className="size-16" />}
      className="h-full"
    />
  )
}

// ---------------------------------------------------------------------------
// Filter rail
// ---------------------------------------------------------------------------

function FilterRail({
  value,
  onChange,
}: {
  value: NotificationFilter
  onChange: (next: NotificationFilter) => void
}) {
  return (
    <div
      role="tablist"
      aria-label="Filter notifications"
      className="flex items-center gap-1 px-3 py-2"
    >
      {NOTIFICATION_FILTERS.map((f) => (
        <Button
          variant="ghost"
          size="sm"
          key={f.key}
          role="tab"
          aria-selected={value === f.key}
          onClick={() => onChange(f.key)}
          className={cn(
            'active:scale-[0.96]',
            value === f.key
              ? 'bg-primary text-primary-foreground border border-input'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
          )}
        >
          {f.label}
        </Button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Notifications panel
// ---------------------------------------------------------------------------

export function NotificationsPanel({
  notifications: initial,
}: {
  notifications: Notification[]
}) {
  // Live list: seeded by the layout loader (SSR/first paint), then kept current
  // by the SSE stream — new notifications, status changes, and dismissals all
  // arrive here without a loader revalidation.
  const notifications = useNotificationStream(initial)
  const [filter, setFilter] = React.useState<NotificationFilter>('all')
  const markAllFetcher = useFetcher()

  // Optimistic: clear every unread the moment mark-all is submitted.
  const markingAll = markAllFetcher.formData?.get('intent') === 'mark_all_read'

  const resolved = React.useMemo<Notification[]>(
    () =>
      markingAll
        ? notifications.map((n) => ({ ...n, status: 'read' as const }))
        : notifications,
    [notifications, markingAll]
  )

  const unread = countUnread(resolved)
  const groups = React.useMemo(
    () => groupByDay(applyFilter(resolved, filter)),
    [resolved, filter]
  )

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="relative border rounded-md! items-center justify-center font-stashly bg-card! border-accent active:scale-[0.96] data-[state=open]:bg-muted/30 data-[state=open]:text-accent-foreground"
          aria-label={
            unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'
          }
        >
          <AnimatePresence initial={false} mode="wait">
            <motion.span
              key={unread > 0 ? 'full' : 'empty'}
              initial={{ opacity: 0, scale: 0.25, filter: 'blur(4px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scale: 0.25, filter: 'blur(4px)' }}
              transition={{ type: 'spring', duration: 0.3, bounce: 0 }}
              className="grid place-items-center"
            >
              {unread > 0 ? (
                <NotificationFullFillIcon className="size-5" />
              ) : (
                <NotificationEmptyFillIcon className="size-5" />
              )}
            </motion.span>
          </AnimatePresence>
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="relative w-md rounded-md shadow-xl overflow-hidden font-stashly border border-sidebar-border p-2 bg-card"
      >
        {/* ── header ── */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-baseline gap-2">
            <h2 className="font-stashly text-sm font-semibold">
              Notifications
            </h2>
            {unread > 0 && (
              <span className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground tabular-nums">
                {unread} unread
              </span>
            )}
          </div>

          <markAllFetcher.Form method="post" action="/api/notifications">
            <input type="hidden" name="intent" value="mark_all_read" />
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              disabled={unread === 0 || markAllFetcher.state !== 'idle'}
              className="h-7 gap-1.5 px-2 text-[11px] uppercase tracking-[0.08em] text-muted-foreground active:scale-[0.96]"
            >
              <DoubleCheckIcon className="size-4" />
              Mark all read
            </Button>
          </markAllFetcher.Form>
        </div>

        <FilterRail value={filter} onChange={setFilter} />

        {/* ── list ── */}
        {groups.length === 0 ? (
          <NotificationsEmpty filter={filter} />
        ) : (
          <ScrollArea className="h-70" type="hidden">
            <div className="relative pb-1">
              {groups.map((group) => (
                <section key={group.label}>
                  <div className="sticky top-0 z-10 w-full bg-card/95 px-5 pb-1.5 pt-3 text-xs uppercase tracking-[0.12em] text-muted-foreground backdrop-blur">
                    {group.label}
                  </div>
                  <div className="flex flex-col gap-1">
                    {group.items.map((n, i) => (
                      <NotificationItem
                        key={n.id}
                        notification={n}
                        index={i}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  )
}
