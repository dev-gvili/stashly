import type { JSX } from 'react'
import {
  MinusFillIcon,
  DoubleCheckIcon,
  FolderIcon,
  FileIcon,
  StorageFillIcon,
  FolderFillIcon,
  FileFillIcon,
} from '@/components/icons'
import { Checkbox } from '@/ui/checkbox'
import { Progress } from '@/ui/progress'
import { useSelection } from '@/hooks/useSelection'
import { cn } from '@/utils/styles'
import type { LibraryStats } from '@/types/stash.types'

/**
 * Tri-state select-all control shared by every toolbar variant. Reads the
 * app-wide selection actor directly (no props), so it stays in sync with the
 * item grid and the `?selectedItems` URL param. Built on the shadcn `Checkbox`
 * (Radix), which already models `'indeterminate'` — the mixed state swaps the
 * check glyph for a minus.
 */
export function SelectAllCheckbox({
  paramName,
  className,
  checkboxClassName,
}: {
  /** URL param the selection syncs to; defaults to `selectedItems` */
  paramName?: string
  /** wrapper — use for the hover target's ground */
  className?: string
  /** the box itself — use to re-tint border/fill on a non-default surface */
  checkboxClassName?: string
}) {
  const { allSelected, someSelected, toggleAll } = useSelection()
  const state = allSelected ? 'on' : someSelected ? 'mixed' : 'off'

  return (
    <span
      className={cn(
        'inline-grid size-8 shrink-0 place-items-center rounded-md transition-colors hover:bg-accent',
        className
      )}
    >
      <Checkbox
        checked={
          state === 'on' ? true : state === 'mixed' ? 'indeterminate' : false
        }
        onCheckedChange={() => toggleAll(paramName)}
        aria-label={state === 'on' ? 'Clear selection' : 'Select all'}
        className={cn('size-5 hover:cursor-pointer', checkboxClassName)}
      >
        {state === 'off' ? null : (
          <span className="flex items-center justify-center text-current">
            {state === 'mixed' ? (
              <MinusFillIcon className="size-4" />
            ) : (
              <DoubleCheckIcon className="size-5" />
            )}
          </span>
        )}
      </Checkbox>
    </span>
  )
}

/** One-line inline stat run: folders · files · size. */
export function InlineStats({
  stats,
  className,
}: {
  stats: LibraryStats
  className?: string
}) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-3 font-stashly text-sm text-muted-foreground h-full',
        className
      )}
    >
      <span className="flex items-center gap-1.5 justify-center">
        <FolderFillIcon className="size-5" />
        <span className="tabular-nums mt-0.5">{stats.folders} folders</span> 
      </span>
      <span className="flex items-center gap-1.5">
        <FileFillIcon className="size-5" />
        <span className="tabular-nums mt-0.5">{stats.files.toLocaleString()} files</span>
      </span>
      <span className="flex items-center gap-1.5">
        <StorageFillIcon className="size-5" />
        <span className="tabular-nums mt-0.5">{stats.size}</span>
      </span>
    </div>
  )
}

/** Storage meter — label row + progress bar. */
export function StorageMeter({
  stats,
  className,
}: {
  stats: LibraryStats
  className?: string
}) {
  return (
    <div className={cn('flex min-w-40 flex-col gap-1', className)}>
      <div className="flex items-baseline justify-between font-stashly text-xs text-muted-foreground">
        <span>Storage</span>
        <span className="tabular-nums">
          {stats.size} / {stats.quota}
        </span>
      </div>
      <Progress value={stats.usedPercent} className="h-1.5" />
    </div>
  )
}

/** Boxed stat used by the stacked variant. */
export function StatCard({
  icon: Icon,
  value,
  label,
}: {
  icon: (props: { className?: string }) => JSX.Element
  value: string | number
  label: string
}) {
  return (
    <div className="flex shrink-0 items-center gap-2.5 rounded-md border border-input bg-card px-3 py-2">
      <span className="grid size-8 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
        <Icon className="size-5" />
      </span>
      <div className="flex flex-col">
        <span className="font-stashly text-sm font-semibold leading-none tabular-nums">
          {value}
        </span>
        <span className="mt-1 font-stashly text-xs leading-none text-muted-foreground">
          {label}
        </span>
      </div>
    </div>
  )
}

export function StatCards({
  stats,
  scope,
}: {
  stats: LibraryStats
  /** when inside a folder, counts for that folder — the storage card stays drive-wide */
  scope?: Pick<LibraryStats, 'folders' | 'files' | 'size'>
}) {
  const s = scope ?? stats
  return (
    <div className="flex flex-wrap items-center gap-2">
      <StatCard icon={FolderFillIcon} value={s.folders} label="folders" />
      <StatCard icon={FileFillIcon} value={s.files.toLocaleString()} label="files" />
      <StatCard
        icon={StorageFillIcon}
        value={s.size}
        label={scope ? 'in this folder' : 'total size'}
      />
      <div className="flex min-w-48 shrink-0 flex-col gap-1.5 rounded-md border border-input bg-card px-3 py-2">
        <div className="flex items-baseline justify-between">
          <span className="flex items-center gap-1.5 font-stashly text-xs text-muted-foreground">
            <StorageFillIcon className="size-4" />
            Storage
          </span>
          <span className="font-stashly text-xs font-semibold tabular-nums">
            {stats.size}
            <span className="font-normal text-muted-foreground">
              {' '}
              / {stats.quota}
            </span>
          </span>
        </div>
        <Progress value={stats.usedPercent} className="h-1.5" />
      </div>
    </div>
  )
}
