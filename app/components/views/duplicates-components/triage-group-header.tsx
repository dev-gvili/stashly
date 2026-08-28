import { formatSize } from '@/utils/formaters'
import { cn } from '@/utils/styles'
import type { DuplicateGroup } from './types'

/** Filename on the left, live decision state on the right. */
export function TriageGroupHeader({
  group,
  selectedCount,
  className,
}: {
  group: DuplicateGroup
  selectedCount: number
  className?: string
}) {
  return (
    <div
      className={cn('flex flex-wrap items-center gap-3 pt-5 pb-5', className)}
    >
      <h2 className="font-stashly m-0 text-lg">{group.name}</h2>
      <span className="text-muted-foreground font-stashly ml-auto text-xs tabular-nums">
        {selectedCount} selected · {group.copies.length} copies · reclaim{' '}
        {formatSize('byte', 'unit', group.reclaimableBytes)}
      </span>
    </div>
  )
}
