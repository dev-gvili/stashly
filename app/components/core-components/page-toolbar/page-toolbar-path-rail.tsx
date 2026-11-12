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
  MoveFillIcon,
  FavoritesFillIcon,
  DownloadFillIcon,
  RestoreFillIcon,
} from '@/components/icons'
import { SelectAllCheckbox } from './toolbar-stats'
import { AddToCollectionMenu, type CollectionRef } from './add-to-collection-menu'
import { Breadcrumbs } from '@/components/core-components/breadcrumb-navigation'
import { useSelection } from '@/hooks/useSelection'
import { useBreadcrumbs } from '@/hooks'
import type {
  BulkActions,
  ToolbarContext,
  LibraryStats,
} from '@/types/stash.types'
import { cn } from '@/utils/styles'
import { href, Link, useLocation, useParams } from 'react-router'
import {
  ButtonGroup,
  ButtonGroupSeparator,
  ButtonGroupText,
} from '@/components/ui'

function rail(
  label: string,
  Icon: (p: { className?: string }) => JSX.Element,
  onClick?: () => void,
  danger?: boolean,
  /** Disables the button and shows this instead of the label as its tooltip. */
  disabledReason?: string | null
) {
  return (
    <Tooltip key={label} content={disabledReason ?? label} asChild>
      {/* A disabled button gets no pointer events, so the tooltip hangs on a wrapper. */}
      <span className="inline-flex">
        <Button
          variant="ghost"
          size="icon"
          onClick={onClick}
          disabled={!!disabledReason}
          aria-label={label}
          className={cn(danger ? 'text-destructive hover:text-destructive!' : '')}
        >
          <Icon className="size-5" />
        </Button>
      </span>
    </Tooltip>
  )
}

interface SelectionActionsProps extends BulkActions {
  selectedCount: number
  context?: ToolbarContext
  className?: string
  /** Shows "Add to collection" with the user's collections. */
  onAddToCollection?: (collection: CollectionRef) => void
  /** Shows a × that clears the selection. */
  onClear?: () => void
  /** Set when Share can't run for this selection (e.g. several items). */
  shareDisabledReason?: string | null
  /** Set when Download can't run now (in progress, or folders selected). */
  downloadDisabledReason?: string | null
}

/**
 * The rail's bulk-mode group — "N selected" plus whichever actions the page
 * wires: Add to collection / Move / Share / Download / Trash, and a clear
 * button (Restore / Delete forever in Trash). An action renders only when its
 * handler is passed, so each page picks its set in `StashPageToolbar`.
 * `PageToolbarPathRail` swaps it in when a selection exists; the Images page
 * shows it in the app header.
 *
 * @example
 * {selectedCount > 0 && <PathRailSelectionActions selectedCount={selectedCount} onTrash={trash} />}
 */
export function PathRailSelectionActions({
  selectedCount,
  context = 'files',
  className,
  onAddToCollection,
  onClear,
  shareDisabledReason,
  downloadDisabledReason,
  ...actions
}: SelectionActionsProps) {
  return (
    <div
      className={cn(
        'flex shrink-0 items-center gap-1 rounded-md ring-2 ring-accent bg-card pl-2',
        className
      )}
    >
      {context === 'trash' ? (
        <ButtonGroup>
          <ButtonGroupText className="text-muted-foreground border-none bg-card">
            {selectedCount} selected
          </ButtonGroupText>
          <ButtonGroupSeparator className="bg-accent h-5! my-auto!" />
          {rail('Restore', RestoreFillIcon, actions.onRestore)}
          {rail(
            'Delete forever',
            () => (
              <TrashFillIcon className="text-destructive" />
            ),
            actions.onDeleteForever,
            true
          )}
        </ButtonGroup>
      ) : (
        <ButtonGroup>
          <ButtonGroupText className="text-muted-foreground border-none bg-card">
            {selectedCount} selected
          </ButtonGroupText>
          {onAddToCollection && <AddToCollectionMenu onSelect={onAddToCollection} />}
          {actions.onMove && rail('Move to…', MoveFillIcon, actions.onMove)}
          {/* {rail('Favorite', FavoritesFillIcon, actions.onFavorite)} */}
          {actions.onShare &&
            rail('Share', ShareItemFillIcon, actions.onShare, false, shareDisabledReason)}
          {actions.onDownload &&
            rail('Download', DownloadFillIcon, actions.onDownload, false, downloadDisabledReason)}
          {actions.onTrash &&
            rail(
              'Trash',
              () => (
                <TrashFillIcon />
              ),
              actions.onTrash,
              true
            )}
          {onClear && rail('Clear selection (Esc)', RemoveIcon, onClear)}
        </ButtonGroup>
      )}
    </div>
  )
}

interface Props
  extends BulkActions,
    Pick<
      SelectionActionsProps,
      'onAddToCollection' | 'onClear' | 'shareDisabledReason' | 'downloadDisabledReason'
    > {
  itemCount: number
  context?: ToolbarContext
  onBack?: () => void
  className?: string

  stats: Pick<LibraryStats, 'size' | 'files' | 'folders'>
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
  className,
  stats,
  ...actions
}: Props) {
  const location = useLocation()
  const { me } = useParams()
  const { selectedIds, unselectAll } = useSelection()
  const crumbs = useBreadcrumbs()
  const selectedCount = selectedIds.length
  const active = selectedCount > 0
  const isTrash = context === 'trash'

  return (
    <nav
      className={cn(
        'sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 bg-background py-2 px-0.5',
        className
      )}
    >
      <Button
        variant="outline"
        size="icon"
        className={cn(
          'font-stashly bg-card! border-none ring-2 ring-accent rounded-md!',
          !crumbs && 'hidden'
        )}
        aria-label="Back"
        onClick={onBack}
      >
        <ArrowLeftFillIcon className="size-5" />
      </Button>

      <SelectAllCheckbox className="shrink-0" />

      {/* w-0: a nowrap path and badges still count their full length toward the
          page's minimum width (min-w-0 only lets them shrink in the row), so
          inside Radix ScrollArea's `display: table` the rail held the folder
          page at ~530px on a 390px phone. */}
      <div className="flex w-0 min-w-0 flex-1 items-center gap-2 overflow-hidden">
        {isTrash && !crumbs ? (
          <h1 className="font-stashly text-sm font-semibold">Trash</h1>
        ) : isTrash ? (
          // Inside a trashed folder: "Trash / folder / …", every link staying
          // in Trash (see `useFolderHref` in breadcrumb-navigation.tsx).
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
            <Breadcrumbs />
          </div>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
            {!crumbs && (
              <span className="text-sm font-stashly text-muted-foreground">
                {location.state?.name ??
                  location.pathname
                    .split('/')
                    .filter(Boolean)
                    .at(-1)
                    ?.replace(/-/g, ' ') ??
                  ''}
              </span>
            )}
            <div className="flex min-w-0 items-start gap-2 overflow-hidden">
              <Breadcrumbs />
              <div className="flex min-w-0 items-start gap-2 ">
                {/* Phones have room for the name or all three counts, not both;
                    the size is also on every card. */}
                <Badge
                  variant="outline"
                  className="tabular-nums rounded border-none bg-card! px-2 text-sm font-medium ring-2 ring-accent max-sm:hidden"
                >
                  {stats.size}
                </Badge>
                <Badge
                  variant="outline"
                  className="tabular-nums rounded border-none bg-card! px-2 text-sm font-medium ring-2 ring-accent"
                >
                  {stats.files} files
                </Badge>
                <Badge
                  variant="outline"
                  className="tabular-nums rounded border-none bg-card! px-2 text-sm font-medium ring-2 ring-accent"
                >
                  {stats.folders} folders
                </Badge>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Trash keeps select-all reachable with an empty selection — it is how
          you arm "empty the bin" in one click. Elsewhere the neutral rail owns
          that space. */}
      {/* {isTrash && <SelectAllCheckbox className="shrink-0" />} */}

      {active ? (
        <PathRailSelectionActions
          selectedCount={selectedCount}
          context={context}
          {...actions}
        />
      ) : (
        <div className="flex shrink-0 items-center gap-1">
          {/* The rail's neutral action. Search is a route rather than an
              in-place filter, so it navigates instead of toggling state. */}
          {me && (
            <Tooltip content="Search" asChild>
              <Button variant="ghost" size="icon" aria-label="Search" asChild>
                <Link to={href('/:me/stash/search', { me })}>
                  <SearchIcon className="size-5" />
                </Link>
              </Button>
            </Tooltip>
          )}
          <Separator orientation="vertical" className="h-5" />
        </div>
      )}
    </nav>
  )
}
