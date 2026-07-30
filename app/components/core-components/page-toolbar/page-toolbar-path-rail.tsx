import type { JSX } from 'react'
import { Button } from '@/ui/button'
import { Separator } from '@/ui/separator'
import { Badge } from '@/ui/badge'
import { Tooltip } from '@/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/ui/dropdown-menu'
import {
  TrashIcon,
  TrashFillIcon,
  RestoreIcon,
  FavoriteIcon,
  MoveToFolder,
  DownloadIcon,
  ShareItemFillIcon,
  MenuDotsIcon,
  RemoveIcon,
  SearchIcon,
  FilterIcon,
  SortAscIcon,
  FolderIcon,
  ArrowLeftFillIcon,
} from '@/components/icons'
import { SelectAllCheckbox } from './toolbar-stats'
import { LayoutToggle } from './layout-toggle'
import { Breadcrumbs } from '@/components/core-components/breadcrumb-navigation'
import { useSelection } from '@/components/stash/selection'
import { useBreadcrumbs } from '@/hooks'
import type { BulkActions, ToolbarContext, ToolbarLayout } from './types'
import { cn } from '@/utils/styles'

interface Props extends BulkActions {
  itemCount: number
  context?: ToolbarContext
  onBack?: () => void
  layout?: ToolbarLayout
  onLayoutChange?: (layout: ToolbarLayout) => void
  className?: string
}

/**
 * Variant 4 — Path-led rail.
 * The breadcrumb IS the title. A rail of icon actions sits on the right and
 * swaps its neutral set (search / filter / sort / view) for bulk actions in
 * place when a selection exists — the path never moves, so nesting context
 * survives the mode change. Depth collapsing is handled by `<Breadcrumbs />`.
 *
 * Selection comes from the app-wide actor (`useSelection`), so this must render
 * under a route that mounts `<SelectionProvider items={…}>`.
 */
export function PageToolbarPathRail({
  itemCount,
  context = 'files',
  onBack,
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
  const nested = (crumbs?.length ?? 0) > 1

  const rail = (
    label: string,
    Icon: (p: { className?: string }) => JSX.Element,
    onClick?: () => void,
    danger?: boolean
  ) => (
    <Tooltip key={label} content={label} asChild>
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
    <header
      className={cn(
        'sticky top-0 z-10 flex h-14 shrink-0 items-center gap-1.5 border-b border-input bg-sidebar px-2.5',
        className
      )}
    >
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onBack}
        aria-label="Back"
        className={cn(
          'shrink-0 text-muted-foreground',
          !nested && 'invisible'
        )}
      >
        <ArrowLeftFillIcon className="size-5" />
      </Button>
      <SelectAllCheckbox />

      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
        {isTrash ? (
          <h1 className="font-stashly text-sm font-semibold">Trash</h1>
        ) : (
          <Breadcrumbs />
        )}
        <Badge
          variant="outline"
          className="hidden tabular-nums md:inline-flex"
        >
          {itemCount.toLocaleString()} items
        </Badge>
      </div>

      {active ? (
        <div className="flex shrink-0 items-center gap-1 rounded-md border border-input bg-primary/5 p-1 pl-2">
          <span className="whitespace-nowrap font-stashly text-xs text-muted-foreground">
            <span className="font-semibold text-foreground tabular-nums">
              {selectedCount}
            </span>{' '}
            selected
          </span>
          <Separator orientation="vertical" className="mx-1 h-5" />
          {isTrash ? (
            <>
              {rail('Restore', RestoreIcon, actions.onRestore)}
              {rail(
                'Delete forever',
                TrashFillIcon,
                actions.onDeleteForever,
                true
              )}
            </>
          ) : (
            <>
              {rail('Move to…', MoveToFolder, actions.onMove)}
              {rail('Favorite', FavoriteIcon, actions.onFavorite)}
              {rail('Download', DownloadIcon, actions.onDownload)}
              {rail('Share', ShareItemFillIcon, actions.onShare)}
              <Separator orientation="vertical" className="mx-1 h-5" />
              {rail('Move to trash', TrashIcon, actions.onTrash, true)}
            </>
          )}
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground"
                aria-label="More actions"
              >
                <MenuDotsIcon className="size-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {isTrash ? (
                <>
                  <DropdownMenuItem onClick={actions.onMove}>
                    <FolderIcon className="size-5" />
                    Restore to…
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={actions.onDeleteForever}
                  >
                    <TrashFillIcon className="size-5" />
                    Delete forever
                  </DropdownMenuItem>
                </>
              ) : (
                <>
                  <DropdownMenuItem onClick={actions.onCopyTo}>
                    <FolderIcon className="size-5" />
                    Copy to…
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={actions.onCopyLink}>
                    <ShareItemFillIcon className="size-5" />
                    Copy link
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={actions.onTrash}
                  >
                    <TrashIcon className="size-5" />
                    Move to trash
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => unselectAll()}
            aria-label="Clear selection"
            className="text-muted-foreground"
          >
            <RemoveIcon className="size-5" />
          </Button>
        </div>
      ) : (
        <div className="flex shrink-0 items-center gap-1">
          {rail('Search', SearchIcon)}
          {rail('Filter', FilterIcon)}
          {rail('Sort', SortAscIcon)}
          <Separator orientation="vertical" className="mx-1 h-5" />
          <LayoutToggle layout={layout} onLayoutChange={onLayoutChange} />
        </div>
      )}
    </header>
  )
}
