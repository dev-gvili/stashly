import { FolderIcon } from '@/components/icons'
import type {
  OverviewActivity,
  OverviewActivityKind,
} from '@/services/activity-actions'
import { toIcon, toItemUrl } from '@/utils/converters'
import { cn } from '@/utils/styles'
import { Link } from 'react-router'
import { toRelativeTime } from './overview-helpers'

const ACTIVITY_VERB: Record<OverviewActivityKind, string> = {
  viewed: 'viewed',
  created: 'created',
  edited: 'edited',
  renamed: 'renamed',
  moved: 'moved',
  copied: 'copied',
  shared: 'shared',
  restored: 'restored',
  deleted: 'deleted',
  commented: 'commented on',
  updated: 'updated',
  pinned: 'pinned',
  unpinned: 'unpinned',
  reordered: 'reordered',
  changed_permission: 'changed permissions for',
  uploaded: 'uploaded',
  collection_item_added: 'added items to',
  collection_item_removed: 'removed items from',
  collection_emptied: 'emptied',
  favorited: 'favorited',
  unfavorited: 'unfavorited',
  bucket_emptied: 'emptied stash',
}

type Bucket = 'today' | 'yesterday' | 'earlier'

const BUCKETS: Bucket[] = ['today', 'yesterday', 'earlier']

const BUCKET_LABEL: Record<Bucket, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  earlier: 'Earlier',
}

/** Undated events fall to `earlier` rather than jumping to the top. */
function toBucket(value: Date | string | null): Bucket {
  if (!value) return 'earlier'
  const date = new Date(value)
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  if (date >= start) return 'today'
  const yesterday = new Date(start.getTime() - 86_400_000)
  return date >= yesterday ? 'yesterday' : 'earlier'
}

/** A single event on the rail: thumbnail, verb, item, age. */
function ActivityEvent({ activity }: { activity: OverviewActivity }) {
  if (!activity.item) return null
  const item = activity.item
  const Icon = item.type === 'folder' ? FolderIcon : toIcon(item.category)
  const url = toItemUrl({
    type: item.type,
    id: item.id,
    parentId: item.parentId ?? '',
    ownerId: item.ownerId,
  })

  return (
    <li className="group relative flex items-center gap-3 py-2">
      <span className="border-input bg-background group-hover:border-accent-foreground absolute top-1/2 -left-6 size-[0.6875rem] -translate-y-1/2 rounded-full border transition-colors" />
      <Link to={url} className="flex min-w-0 flex-1 items-center gap-3">
        <span className="bg-muted flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-xl">
          {Icon && (
            <Icon
              className={cn(
                'text-muted-foreground size-5',
                item.type === 'folder' && 'fill-current!'
              )}
            />
          )}
        </span>
        <span className="text-muted-foreground w-16 shrink-0 text-xs tracking-wider uppercase">
          {ACTIVITY_VERB[activity.kind]}
        </span>
        <span className="font-stashly flex-1 truncate text-sm">
          {item.name}
        </span>
        <span className="text-muted-foreground shrink-0 text-xs tabular-nums whitespace-nowrap">
          {toRelativeTime(activity.observedAt)}
        </span>
      </Link>
    </li>
  )
}

/**
 * Activity as a timeline rather than a log: day dividers, one continuous rail,
 * and the affected item's glyph on every event.
 */
export function ActivityTimeline({
  activity,
  className,
}: {
  activity: OverviewActivity[]
  className?: string
}) {
  if (!activity.length) return null

  return (
    <div className={cn('bg-card rounded-3xl p-5', className)}>
      {BUCKETS.map((bucket) => {
        const rows = activity.filter(
          (entry) => toBucket(entry.observedAt) === bucket
        )
        if (!rows.length) return null
        return (
          <div key={bucket} className="mb-1 last:mb-0">
            <div className="flex items-center gap-3 py-1.5">
              <span className="text-muted-foreground text-xs tracking-wider whitespace-nowrap uppercase">
                {BUCKET_LABEL[bucket]}
              </span>
              <span className="bg-input h-px flex-1" />
            </div>
            <ol className="relative pl-6">
              <span className="bg-input absolute top-2 bottom-2 left-[0.3125rem] w-px" />
              {rows.map((entry) => (
                <ActivityEvent key={entry.id} activity={entry} />
              ))}
            </ol>
          </div>
        )
      })}
    </div>
  )
}
