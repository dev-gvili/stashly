import { formatActivity, formatActivityTimestamp } from '@/utils/activity'
import type { ActivityWithRelations } from '@/utils/activity'
import { cn } from '@/utils/styles'
import type { JSX, SVGProps } from 'react'
import {
  UploadIcon,
  TrashIcon,
  RenameIcon,
  MoveToFolder,
  CopyIcon,
  RestoreIcon,
  ShareItemIcon,
  LockIcon,
  RefreshIcon,
  EditIcon,
  PreviewIcon,
  ActivityIcon,
} from '@/components/icons'
import { Badge } from '../ui'

interface ActivityEntryProps {
  activity: ActivityWithRelations
  className?: string
  isLast?: boolean
}

type IconComponent = (props: SVGProps<SVGSVGElement>) => JSX.Element

function actionIcon(activity: ActivityWithRelations): IconComponent {
  const a = activity.action
  if (!a) return ActivityIcon
  if (a.create) return UploadIcon
  if (a.delete) return TrashIcon
  if (a.rename) return RenameIcon
  if (a.move) return MoveToFolder
  if (a.copy) return CopyIcon
  if (a.restore) return RestoreIcon
  if (a.share) return ShareItemIcon
  if (a.comment) return EditIcon
  if (a.permission) return LockIcon
  if (a.version) return RefreshIcon
  if (a.upload) return UploadIcon
  if (activity.access) return PreviewIcon
  return ActivityIcon
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
        <div className="absolute left-4 top-11 -bottom-1 w-px bg-accent dark:bg-accent/20" />
      )}
      <div
        className={cn(
          'relative z-10 mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-background ',
          passive ? 'ring-border' : 'ring-accent/40 bg-accent/30 text-accent'
        )}
      >
        <Icon
          className={cn(
            'size-4',
            passive ? 'text-current' : 'text-accent-foreground'
          )}
        />
      </div>
      <div className="flex-1 space-y-1 pt-0.5">
        {timestamp && (
          <p className="text-xs text-muted-foreground">{timestamp}</p>
        )}
        <p className="text-sm  leading-snug">{prose}</p>
        <Badge
          className={cn(
            'rounded font-medium font-stashly w-52 flex-1',
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
