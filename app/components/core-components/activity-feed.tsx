import { ActivityEntry } from './activity-entry'
import type { ActivityWithRelations } from '@/utils/activity'
import { cn } from '@/utils/styles'

interface ActivityFeedProps {
  activities: ActivityWithRelations[]
  isLoading?: boolean
  className?: string
  streamUrl?: string
}

function ActivitySkeleton() {
  return (
    <div className="flex gap-3 py-3 animate-pulse">
      <div className="mt-0.5 size-8 shrink-0 rounded-full bg-muted" />
      <div className="flex-1 space-y-2 pt-1">
        <div className="h-3 w-3/4 rounded bg-muted" />
        <div className="h-2.5 w-1/3 rounded bg-muted" />
        <div className="h-6 w-1/2 rounded bg-muted" />
      </div>
    </div>
  )
}

export function ActivityFeed({ activities, isLoading, className }: ActivityFeedProps) {
  if (isLoading) {
    return (
      <div className={cn('divide-y divide-border', className)}>
        <ActivitySkeleton />
        <ActivitySkeleton />
        <ActivitySkeleton />
      </div>
    )
  }

  if (!activities.length) {
    return (
      <div className={cn('py-8 text-center text-sm text-muted-foreground', className)}>
        No activity yet
      </div>
    )
  }

  return (
    <div className={cn('divide-y divide-border', className)}>
      {activities.map((activity) => (
        <ActivityEntry key={activity.id} activity={activity} />
      ))}
    </div>
  )
}
