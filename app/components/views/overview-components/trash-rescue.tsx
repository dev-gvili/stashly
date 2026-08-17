import { cn } from '@/utils/styles'
import { Link } from 'react-router'

/**
 * Quiet recovery line at the foot of the overview: how much is in the trash and
 * how long it stays restorable. Renders nothing when the trash is empty.
 *
 * `retentionDays` is optional — the app has no purge policy yet, and the line
 * must not promise a window nothing enforces.
 */
export function TrashRescue({
  count,
  retentionDays,
  trashTo,
  className,
}: {
  count: number
  retentionDays?: number
  trashTo: string
  className?: string
}) {
  if (!count) return null
  return (
    <div
      className={cn(
        'bg-muted flex items-center gap-3 rounded-3xl px-5 py-4',
        className
      )}
    >
      <span className="text-muted-foreground flex-1 text-sm">
        {count} {count === 1 ? 'item' : 'items'} in the trash
        {retentionDays ? ` · restorable for ${retentionDays} days` : ''}
      </span>
      <Link
        to={trashTo}
        className="bg-card text-muted-foreground hover:text-foreground flex h-9 items-center rounded-xl px-4 text-xs tracking-wider whitespace-nowrap uppercase transition-colors"
      >
        Open trash
      </Link>
    </div>
  )
}
