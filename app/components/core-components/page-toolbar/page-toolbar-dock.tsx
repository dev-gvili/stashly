import type { JSX } from 'react'
import { Button } from '@/ui/button'
import { Separator } from '@/ui/separator'
import { Badge } from '@/ui/badge'
import { Tooltip } from '@/ui/tooltip'
import {
  TrashIcon,
  TrashFillIcon,
  RestoreIcon,
  FavoriteIcon,
  MoveToFolder,
  DownloadIcon,
  ShareItemFillIcon,
  SearchIcon,
  FilterIcon,
} from '@/components/icons'
import { SelectAllCheckbox, StorageMeter } from './toolbar-stats'
import { LayoutToggle } from './layout-toggle'
import { Breadcrumbs } from '@/components/core-components/breadcrumb-navigation'
import { useSelection } from '@/components/stash/selection'
import { useBreadcrumbs } from '@/hooks'
import type {
  BulkActions,
  LibraryStats,
  ToolbarContext,
  ToolbarLayout,
} from './types'
import { cn } from '@/utils/styles'

interface Props extends BulkActions {
  stats: LibraryStats
  /** stats line for the folder you're inside — falls back to drive-wide stats */
  folderStats?: Pick<LibraryStats, 'folders' | 'files' | 'size'>
  context?: ToolbarContext
  selectedFolders?: number
  selectedFiles?: number
  /** formatted size of the current selection — the toolbar can't derive it */
  selectedSize?: string
  layout?: ToolbarLayout
  onLayoutChange?: (layout: ToolbarLayout) => void
  className?: string
}

/**
 * Variant 2 — Persistent header + floating action dock.
 * The header never changes shape (title, stats, storage meter, view controls);
 * bulk actions ride in a floating pill dock so they stay reachable while
 * scrolling a long list. Render inside a `relative` page container.
 *
 * Selection comes from the app-wide actor (`useSelection`), so this must render
 * under a route that mounts `<SelectionProvider items={…}>`.
 */
export function PageToolbarDock({
  stats,
  folderStats,
  context = 'files',
  selectedFolders,
  selectedFiles,
  selectedSize,
  layout = 'grid',
  onLayoutChange,
  className,
  ...actions
}: Props) {
  const { selectedIds, unselectAll } = useSelection()
  const crumbs = useBreadcrumbs()
  const selectedCount = selectedIds.length
  const active = selectedCount > 0
  const isTrash = context === 'trash'
  const nested = !isTrash && (crumbs?.length ?? 0) > 1
  const scope = nested ? (folderStats ?? stats) : stats

  const iconAction = (
    label: string,
    Icon: (p: { className?: string }) => JSX.Element,
    onClick?: () => void,
    danger?: boolean
  ) => (
    <Tooltip content={label} asChild>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onClick}
        aria-label={label}
        className={cn(
          danger
            ? 'text-destructive hover:bg-destructive/10 hover:text-destructive'
            : 'text-muted-foreground'
        )}
      >
        <Icon className="size-5" />
      </Button>
    </Tooltip>
  )

  return (
    <>
      <header
        className={cn(
          'sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 border-b border-input bg-sidebar px-3',
          className
        )}
      >
        <SelectAllCheckbox />
        <div className="flex min-w-0 flex-col gap-0.5">
          {nested ? (
            <Breadcrumbs />
          ) : (
            <h1 className="font-stashly text-sm font-semibold leading-tight">
              {isTrash ? 'Trash' : 'My drive'}
            </h1>
          )}
          <p className="pl-1 font-stashly text-xs leading-tight text-muted-foreground tabular-nums">
            {scope.folders} folders · {scope.files.toLocaleString()} files ·{' '}
            {scope.size}
          </p>
        </div>
        <Separator
          orientation="vertical"
          className="mx-1 hidden h-8 sm:block"
        />
        <StorageMeter stats={stats} className="hidden sm:flex" />
        <div className="ml-auto flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="hidden bg-card! border-input text-muted-foreground md:inline-flex"
          >
            <SearchIcon className="size-5" />
            Search files
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            className="bg-card! border-input text-muted-foreground"
            aria-label="Filter"
          >
            <FilterIcon className="size-5" />
          </Button>
          <LayoutToggle layout={layout} onLayoutChange={onLayoutChange} />
        </div>
      </header>

      {active ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-5 z-10 flex justify-center px-4">
          <div className="pointer-events-auto flex items-center gap-1 rounded-lg border border-input bg-popover p-1.5 shadow-xl">
            <div className="flex items-center gap-2 pl-1.5 pr-1">
              <Badge className="size-6 justify-center rounded-md px-0 font-stashly text-xs tabular-nums">
                {selectedCount}
              </Badge>
              <span className="hidden font-stashly text-xs text-muted-foreground tabular-nums sm:inline">
                {selectedFolders ?? 0} folders · {selectedFiles ?? 0} files
                {selectedSize ? ` · ${selectedSize}` : ''}
              </span>
            </div>
            <Separator orientation="vertical" className="mx-1 h-5" />
            {isTrash ? (
              <>
                {iconAction('Restore', RestoreIcon, actions.onRestore)}
                {iconAction(
                  'Delete forever',
                  TrashFillIcon,
                  actions.onDeleteForever,
                  true
                )}
              </>
            ) : (
              <>
                {iconAction('Move to…', MoveToFolder, actions.onMove)}
                {iconAction('Favorite', FavoriteIcon, actions.onFavorite)}
                {iconAction('Download', DownloadIcon, actions.onDownload)}
                {iconAction('Share', ShareItemFillIcon, actions.onShare)}
                <Separator orientation="vertical" className="mx-1 h-5" />
                {iconAction('Move to trash', TrashIcon, actions.onTrash, true)}
              </>
            )}
            <Separator orientation="vertical" className="mx-1 h-5" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => unselectAll()}
              className="font-stashly text-muted-foreground"
            >
              Done
            </Button>
          </div>
        </div>
      ) : null}
    </>
  )
}
