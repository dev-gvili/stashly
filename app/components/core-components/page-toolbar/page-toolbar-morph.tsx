import { Button } from '@/ui/button'
import { Separator } from '@/ui/separator'
import { Badge } from '@/ui/badge'
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
} from '@/components/icons'
import { SelectAllCheckbox, InlineStats, StorageMeter } from './toolbar-stats'
import { Breadcrumbs } from '@/components/core-components/breadcrumb-navigation'
import { useSelection } from '@/components/stash/selection'
import { useBreadcrumbs } from '@/hooks'
import type {
  BulkActions,
  LibraryStats,
  ToolbarContext,
} from './types'
import { cn } from '@/utils/styles'

interface Props extends BulkActions {
  stats: LibraryStats
  context?: ToolbarContext
  /** formatted size of the current selection — the toolbar can't derive it */
  selectedSize?: string
  className?: string
}

/**
 * Variant 1 — Morphing single row.
 * One `h-14` header row that swaps its contents in place when a selection
 * exists: no height change, no layout shift. Destructive action is separated
 * by a divider and rendered in destructive ink rather than a filled button.
 *
 * Selection comes from the app-wide actor (`useSelection`), so this must render
 * under a route that mounts `<SelectionProvider items={…}>`.
 */
export function PageToolbarMorph({
  stats,
  context = 'files',
  selectedSize,
  className,
  ...actions
}: Props) {
  const { selectedIds, unselectAll } = useSelection()
  const crumbs = useBreadcrumbs()
  const selectedCount = selectedIds.length
  const active = selectedCount > 0
  const isTrash = context === 'trash'
  const nested = !isTrash && (crumbs?.length ?? 0) > 1

  return (
    <header
      className={cn(
        'sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 bg-sidebar',
        className
      )}
    >
      <SelectAllCheckbox />

      {active ? (
        <>
          <div className="flex min-w-0 items-baseline gap-2">
            <span className="font-stashly text-sm font-semibold tabular-nums">
              {selectedCount}
            </span>
            <span className="font-stashly text-xs text-muted-foreground">
              selected
            </span>
            {selectedSize ? (
              <Badge
                variant="outline"
                className="hidden tabular-nums sm:inline-flex"
              >
                {selectedSize}
              </Badge>
            ) : null}
          </div>
          <Separator orientation="vertical" className="mx-1 h-5" />
          <div className="flex flex-1 items-center gap-1">
            {isTrash ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-card!"
                  onClick={actions.onRestore}
                >
                  <RestoreIcon className="size-5" />
                  Restore
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={actions.onDeleteForever}
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <TrashFillIcon className="size-5" />
                  Delete forever
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-card!"
                  onClick={actions.onMove}
                >
                  <MoveToFolder className="size-5" />
                  Move
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-card!"
                  onClick={actions.onFavorite}
                >
                  <FavoriteIcon className="size-5" />
                  Favorite
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={actions.onDownload}
                  className="hidden bg-card! md:inline-flex"
                >
                  <DownloadIcon className="size-5" />
                  Download
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={actions.onShare}
                  className="hidden bg-card! lg:inline-flex"
                >
                  <ShareItemFillIcon className="size-5" />
                  Share
                </Button>
                <Separator orientation="vertical" className="mx-1 h-5" />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={actions.onTrash}
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <TrashIcon className="size-5" />
                  Trash
                </Button>
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
              <DropdownMenuContent align="start">
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
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => unselectAll()}
            className="text-muted-foreground"
            aria-label="Clear selection"
          >
            <RemoveIcon className="size-5" />
          </Button>
        </>
      ) : (
        <>
          {nested ? (
            <Breadcrumbs />
          ) : (
            <h1 className="font-stashly text-sm font-semibold">
              {isTrash ? 'Trash' : 'All files'}
            </h1>
          )}
          {/* <Badge variant="outline" className="tabular-nums">
            {isTrash ? stats.trashed : stats.files + stats.folders}
          </Badge> */}
          <InlineStats stats={stats} className="ml-2 hidden lg:flex" />
          <StorageMeter stats={stats} className="ml-2 hidden lg:flex" />
        </>
      )}
    </header>
  )
}
