import { formatActivity, formatActivityTimestamp } from '@/utils/activity'
import type { ActivityWithRelations } from '@/utils/activity'
import { cn } from '@/utils/styles'

interface ActivityEntryProps {
  activity: ActivityWithRelations
  className?: string
}

export function ActivityEntry({ activity, className }: ActivityEntryProps) {
  const prose = formatActivity(activity)
  const timestamp = formatActivityTimestamp(activity.time?.observedAt)
  const name = activity.item?.name ?? 'this item'

  return (
    <div className={cn('flex gap-3 py-3', className)}>
      <div className="mt-0.5 size-8 shrink-0 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground overflow-hidden">
        <span>Y</span>
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm leading-snug">{prose}</p>
        {timestamp && (
          <p className="text-xs text-muted-foreground">{timestamp}</p>
        )}
        <div className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-1 text-xs font-medium max-w-full">
          <span className="truncate">{name}</span>
        </div>
      </div>
    </div>
  )
}
