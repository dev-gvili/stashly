import {
  ActivityFillIcon,
  CopyFillIcon,
  EditFillIcon,
  HeartFillIcon,
  LockFillIcon,
  MoveFillIcon,
  PinFillIcon,
  PreviewIcon,
  RefreshIcon,
  RenameFillIcon,
  RestoreIcon,
  ShareFillIcon,
  TrashFillIcon,
  UploadFillIcon
} from '@/components/icons'
import type { ActivityWithRelations } from '@/utils/activity'
import { formatActivity, formatActivityTimestamp } from '@/utils/activity'
import { cn } from '@/utils/styles'
import type { JSX, SVGProps } from 'react'
import { Badge } from '../ui'

interface ActivityEntryProps {
  activity: ActivityWithRelations
  className?: string
  isLast?: boolean
}

type IconComponent = (props: SVGProps<SVGSVGElement>) => JSX.Element

function actionIcon(activity: ActivityWithRelations): IconComponent {
  const a = activity.action
  if (!a) return ActivityFillIcon
  if (a.create) return UploadFillIcon
  if (a.delete) return TrashFillIcon
  if (a.rename) return RenameFillIcon
  if (a.move) return MoveFillIcon
  if (a.copy) return CopyFillIcon
  if (a.restore) return RestoreIcon
  if (a.share) return ShareFillIcon
  if (a.comment) return EditFillIcon
  if (a.permission) return LockFillIcon
  if (a.version) return RefreshIcon
  if (a.upload) return UploadFillIcon
  if (a.favorite) return HeartFillIcon
  if (a.pin) return PinFillIcon
  if (activity.access) return PreviewIcon
  return ActivityFillIcon
}

export function ActivityEntry({
  activity,
  className,
  isLast,
}: ActivityEntryProps) {
  const passive = !activity.action && !!activity.access
  const prose = formatActivity(activity)
  const timestamp = formatActivityTimestamp(activity.time?.observedAt)
  const name = activity.item?.name ?? 'this item'
  const Icon = actionIcon(activity)

  return (
    <div className={cn('relative flex gap-4', !isLast && 'pb-6', className)}>
      {!isLast && (
        <div className="absolute left-4 top-11 -bottom-1 w-px bg-accent" />
      )}
      <div
        className={cn(
          'relative z-10 mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md ',
          passive ? 'ring-border' : 'bg-secondary text-secondary-foreground'
        )}
      >
        <Icon className={cn('size-5 ')} />
      </div>
      <div className="flex-1 space-y-1 pt-0.5">
        {timestamp && (
          <p className="text-xs text-muted-foreground">{timestamp}</p>
        )}
        <p className="text-sm  leading-snug">{prose}</p>
        <Badge
          className={cn(
            'w-52 flex-1',
            passive
              ? 'bg-muted text-muted-foreground'
              : 'bg-primary/10 text-primary'
          )}
        >
          <span className="truncate">{name}</span>
        </Badge>
      </div>
    </div>
  )
}
