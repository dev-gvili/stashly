import { ActivityEntry } from './activity-entry'
import type { ActivityWithRelations } from '@/utils/activity'
import { cn } from '@/utils/styles'

interface ActivityFeedProps {
  activities: ActivityWithRelations[]
  isLoading?: boolean
  className?: string
  streamUrl?: string
}

function ActivitySkeleton({ isLast }: { isLast?: boolean }) {
  return (
    <div className={cn('relative flex gap-3 animate-pulse', !isLast && 'pb-6')}>
      {!isLast && (
        <div className="absolute left-3 top-6 bottom-0 w-px bg-border" />
      )}
      <div className="relative z-10 mt-0.5 size-6 shrink-0 rounded-md bg-muted ring-1 ring-border" />
      <div className="flex-1 space-y-2 pt-0.5">
        <div className="h-2.5 w-1/3 rounded bg-muted" />
        <div className="h-3 w-3/4 rounded bg-muted" />
        <div className="h-5 w-2/5 rounded-full bg-muted" />
      </div>
    </div>
  )
}

export function ActivityFeed({ activities, isLoading, className }: ActivityFeedProps) {
  if (isLoading) {
    return (
      <div className={cn('px-4 py-3', className)}>
        <ActivitySkeleton />
        <ActivitySkeleton />
        <ActivitySkeleton isLast />
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
    <div className={cn('flex-col h-full flex-1 space-y-3 justify-center w-full items-start', className)}>
      {activities.map((activity, i) => (
        <ActivityEntry
          key={activity.id}
          activity={activity}
          isLast={i === activities.length - 1}
        />
      ))}
    </div>
  )
}
