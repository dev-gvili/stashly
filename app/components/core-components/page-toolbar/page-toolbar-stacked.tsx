import { Button } from '@/ui/button'
import { ButtonGroup } from '@/ui/button-group'
import { Separator } from '@/ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
  SearchIcon,
  FilterIcon,
  SortAscIcon,
  DoubleCheckIcon,
  RemoveIcon,
  MinusFillIcon,
  FolderIcon,
} from '@/components/icons'
import { StatCards } from './toolbar-stats'
import { useSelection } from '@/components/stash/selection'
import type { BulkActions, LibraryStats, ToolbarContext } from './types'
import { cn } from '@/utils/styles'

interface Props extends BulkActions {
  stats: LibraryStats
  /** stats for the folder you're inside — falls back to `stats` at the drive root */
  folderStats?: Pick<LibraryStats, 'folders' | 'files' | 'size'>
  context?: ToolbarContext
  /** formatted size of the current selection — the toolbar can't derive it */
  selectedSize?: string
  /**
   * Invert the selection. The shared selection machine has no INVERT event, so
   * the caller supplies it (e.g. `setSelected(items.filter(i => !selectedIds.includes(i)))`).
   * Omit and the Invert button is hidden.
   */
  onInvert?: () => void
  className?: string
}

/**
 * Variant 3 — Stacked: stat cards + labelled action row.
 * Row 1 is identity and library stats; row 2 is an explicit bulk-action bar
 * that tints when a selection exists, with select-all / invert / none controls
 * always present. Best for data-dense list views.
 *
 * Selection comes from the app-wide actor (`useSelection`), so this must render
 * under a route that mounts `<SelectionProvider items={…}>`.
 */
export function PageToolbarStacked({
  stats,
  folderStats,
  context = 'files',
  selectedSize,
  onInvert,
  className,
  ...actions
}: Props) {
  const { selectedIds, selectAll, unselectAll } = useSelection()
  const selectedCount = selectedIds.length
  const active = selectedCount > 0
  const isTrash = context === 'trash'

  return (
    <header
      className={cn(
        'sticky top-0 z-10 shrink-0 border-b border-input bg-sidebar',
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <div className="min-w-0">
          <h1 className="font-stashly text-base font-semibold leading-tight">
            {isTrash ? 'Trash' : 'All files'}
          </h1>
          <p className="mt-0.5 font-stashly text-xs text-muted-foreground">
            {isTrash
              ? 'Items are removed after 30 days.'
              : 'Everything in your drive.'}
          </p>
        </div>
        <div className="ml-auto">
          <StatCards stats={stats} scope={isTrash ? undefined : folderStats} />
        </div>
      </div>

      <Separator className="bg-input" />

      <div
        className={cn(
          'flex items-center gap-2 overflow-hidden px-4 py-2 transition-colors',
          active && 'bg-primary/5'
        )}
      >
        <ButtonGroup className="shrink-0 rounded-md border border-input bg-card">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => selectAll()}
            className="font-stashly text-muted-foreground"
          >
            <DoubleCheckIcon className="size-5" />
            All
          </Button>
          {onInvert ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={onInvert}
              className="font-stashly text-muted-foreground"
            >
              <MinusFillIcon className="size-5" />
              Invert
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => unselectAll()}
            className="font-stashly text-muted-foreground"
          >
            <RemoveIcon className="size-5" />
            None
          </Button>
        </ButtonGroup>
        <Separator orientation="vertical" className="mx-1 h-5 shrink-0" />

        {active ? (
          <>
            <span className="mr-1 hidden shrink-0 whitespace-nowrap font-stashly text-xs text-muted-foreground sm:inline">
              <span className="font-semibold text-foreground tabular-nums">
                {selectedCount}
              </span>{' '}
              selected
              {selectedSize ? (
                <>
                  {' · '}
                  <span className="tabular-nums">{selectedSize}</span>
                </>
              ) : null}
            </span>
            {isTrash ? (
              <>
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <Button size="sm" onClick={actions.onRestore}>
                    <RestoreIcon className="size-5" />
                    Restore
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={actions.onMove}
                    className="hidden bg-card! md:inline-flex"
                  >
                    <MoveToFolder className="size-5" />
                    Restore to…
                  </Button>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={actions.onDeleteForever}
                  className="shrink-0"
                >
                  <TrashFillIcon className="size-5" />
                  Delete forever
                </Button>
              </>
            ) : (
              <>
                <div className="flex min-w-0 flex-1 items-center gap-2">
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
                    className="hidden bg-card! lg:inline-flex"
                  >
                    <DownloadIcon className="size-5" />
                    Download
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={actions.onShare}
                    className="hidden bg-card! xl:inline-flex"
                  >
                    <ShareItemFillIcon className="size-5" />
                    Share
                  </Button>
                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="shrink-0 text-muted-foreground"
                        aria-label="More actions"
                      >
                        <MenuDotsIcon className="size-5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem
                        onClick={actions.onDownload}
                        className="lg:hidden"
                      >
                        <DownloadIcon className="size-5" />
                        Download
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={actions.onShare}
                        className="xl:hidden"
                      >
                        <ShareItemFillIcon className="size-5" />
                        Share
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={actions.onCopyTo}>
                        <FolderIcon className="size-5" />
                        Copy to…
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={actions.onCopyLink}>
                        <ShareItemFillIcon className="size-5" />
                        Copy link
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={actions.onTrash}
                  className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <TrashIcon className="size-5" />
                  Move to trash
                </Button>
              </>
            )}
          </>
        ) : (
          <>
            <span className="truncate font-stashly text-xs text-muted-foreground">
              Select items to move, favorite, or trash them.
            </span>
            <div className="ml-auto flex shrink-0 items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="bg-card! border-input text-muted-foreground"
              >
                <SearchIcon className="size-5" />
                Search
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="bg-card! border-input text-muted-foreground"
              >
                <FilterIcon className="size-5" />
                Filter
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="bg-card! border-input text-muted-foreground"
              >
                <SortAscIcon className="size-5" />
                Sort
              </Button>
            </div>
          </>
        )}
      </div>
    </header>
  )
}
