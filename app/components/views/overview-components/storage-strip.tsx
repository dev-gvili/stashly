import { formatSize } from '@/utils/formaters'
import { cn } from '@/utils/styles'
import { Link } from 'react-router'
import { basisForPercent, toRelativeTime } from './overview-helpers'
import type { StorageSegment, StorageUsage } from './types'

/** Literal tint per segment kind — see overview-helpers for why. */
const SEGMENT_TONE: Record<StorageSegment['tone'], string> = {
  images: 'bg-emerald-500',
  video: 'bg-sky-500',
  documents: 'bg-amber-500',
  code: 'bg-rose-500',
  other: 'bg-muted-foreground',
}

/**
 * Storage banner. Sits directly under the greeting: usage figure and percent
 * pill on the left, segmented meter with its legend in the middle, remaining
 * space and the plan action on the right.
 */
export function StorageStrip({
  storage,
  manageTo,
  className,
}: {
  storage: StorageUsage
  manageTo: string
  className?: string
}) {
  const percent = storage.totalBytes
    ? Math.round((storage.usedBytes / storage.totalBytes) * 100)
    : 0
  const free = Math.max(storage.totalBytes - storage.usedBytes, 0)

  return (
    <div
      className={cn(
        'bg-card grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-6 rounded-3xl px-5 py-4',
        className
      )}
    >
      <div className="whitespace-nowrap">
        <div className="text-muted-foreground font-stashly text-xs tracking-wider uppercase">
          Storage used
        </div>
        <div className="mt-1 flex items-baseline gap-1.5">
          <span className="text-2xl leading-none font-bold tracking-tight tabular-nums">
            {formatSize('byte', 'unit', storage.usedBytes)}
          </span>
          <span className="text-muted-foreground text-xs tabular-nums">
            of {formatSize('byte', 'unit', storage.totalBytes)}
          </span>
          <span className="bg-accent text-accent-foreground ml-1.5 inline-flex h-5 items-center rounded-full px-2 text-xs tracking-wider uppercase">
            {percent}%
          </span>
        </div>
      </div>

      <div className="min-w-0">
        <div className="bg-muted flex h-2 overflow-hidden rounded-full">
          {storage.segments.map((segment) => (
            <span
              key={segment.label}
              className={cn(
                'h-full',
                SEGMENT_TONE[segment.tone],
                basisForPercent(
                  storage.totalBytes
                    ? (segment.bytes / storage.totalBytes) * 100
                    : 0
                )
              )}
            />
          ))}
        </div>
        <ul className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-1">
          {storage.segments.map((segment) => (
            <li
              key={segment.label}
              className="flex items-baseline gap-1.5 text-xs whitespace-nowrap"
            >
              <span
                className={cn(
                  'size-2 translate-y-px rounded-sm',
                  SEGMENT_TONE[segment.tone]
                )}
              />
              <span className="text-muted-foreground">{segment.label}</span>
              <span className="tabular-nums">
                {formatSize('byte', 'unit', segment.bytes)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex items-center gap-4 whitespace-nowrap">
        <div className="text-right">
          <div className="font-stashly text-sm font-semibold tabular-nums">
            {formatSize('byte', 'unit', free)} free
          </div>
          <div className="text-muted-foreground text-xs">
            {storage.planName ?? 'Free'}
            {storage.renewsAt
              ? ' · renews ' + toRelativeTime(storage.renewsAt)
              : null}
          </div>
        </div>
        <Link
          to={manageTo}
          className="bg-accent text-accent-foreground flex h-9 items-center rounded-xl px-4 text-xs tracking-wider uppercase"
        >
          Manage plan
        </Link>
      </div>
    </div>
  )
}
