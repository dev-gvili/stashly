import type { ComponentType, ReactNode, SVGProps } from 'react'

import {
  FileFillIcon,
  GroupFillIcon,
  RecentFillIcon,
  StorageFillIcon,
} from '@/components/icons'
import { Badge } from '@/ui/badge'
import { formatSize } from '@/utils/formaters'
import { cn } from '@/utils/styles'

export interface CollectionStatProps {
  icon: ComponentType<SVGProps<SVGSVGElement>>
  children: ReactNode
  className?: string
}

/**
 * A single neutral meta chip: an icon plus mono text. Stats are information,
 * not signal, so they never use the primary colour.
 */
export function CollectionStat({ icon: Icon, children, className }: CollectionStatProps) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        'h-6 gap-1.5 rounded-sm px-2.25 font-stashly text-xs font-normal text-secondary-foreground',
        className
      )}
    >
      <Icon aria-hidden className="size-3.5! text-muted-foreground" />
      {children}
    </Badge>
  )
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** `today`, `yesterday`, `Oct 29`, or `Oct 29, 2025` for an earlier year. */
export function formatUpdated(value: Date | string, now = new Date()) {
  const date = new Date(value)
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const diffDays = Math.round((day(now) - day(date)) / 86_400_000)
  if (diffDays <= 0) return 'today'
  if (diffDays === 1) return 'yesterday'
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
  })
}

export interface CollectionStatsProps {
  itemCount: number
  /** Total bytes. Prisma returns BigInt, which is accepted as-is. */
  size: bigint | number
  updatedAt?: Date | string | null
  /** Number of people the collection is shared with. Hidden when 0. */
  sharedWith?: number
  className?: string
}

/**
 * The row of meta chips under the collection title:
 * `22 files · 47 MB · Updated today · Shared with 2`.
 */
export function CollectionStats({
  itemCount,
  size,
  updatedAt,
  sharedWith = 0,
  className,
}: CollectionStatsProps) {
  return (
    <ul
      aria-label="Collection details"
      className={cn('flex flex-wrap items-center gap-2', className)}
    >
      <li className="flex">
        <CollectionStat icon={FileFillIcon}>{plural(itemCount, 'file')}</CollectionStat>
      </li>
      <li className="flex">
        <CollectionStat icon={StorageFillIcon}>{formatSize('byte', 'unit', size)}</CollectionStat>
      </li>
      {updatedAt && (
        <li className="flex">
          <CollectionStat icon={RecentFillIcon}>
            <time dateTime={new Date(updatedAt).toISOString()}>
              Updated {formatUpdated(updatedAt)}
            </time>
          </CollectionStat>
        </li>
      )}
      {sharedWith > 0 && (
        <li className="flex">
          <CollectionStat icon={GroupFillIcon}>Shared with {sharedWith}</CollectionStat>
        </li>
      )}
    </ul>
  )
}
