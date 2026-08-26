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

interface Props extends BulkActions {
  itemCount: number
  context?: ToolbarContext
  onBack?: () => void
  className?: string

  stats: LibraryStats
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

  const rail = (
    label: string,
    Icon: (p: { className?: string }) => JSX.Element,
    onClick?: () => void,
    danger?: boolean
  ) => (
    <Tooltip key={label} content={label} asChild>
      <Button
        variant="ghost"
        size="icon"
        onClick={onClick}
        aria-label={label}
        className={cn(danger ? 'text-destructive hover:text-destructive!' : '')}
      >
        <Icon className="size-5" />
      </Button>
    </Tooltip>
  )

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
        onClick={onBack}
      >
        <ArrowLeftFillIcon className="size-5" />
      </Button>

      <SelectAllCheckbox className="shrink-0" />

      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
        {isTrash ? (
          <h1 className="font-stashly text-sm font-semibold">Trash</h1>
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
                <Badge
                  variant="outline"
                  className="tabular-nums rounded border-none bg-card! px-2 text-sm font-medium ring-2 ring-accent"
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
        <div className="flex shrink-0 items-center gap-1 rounded-md ring-2 ring-accent bg-card pl-2">
          {isTrash ? (
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
              {/* <ButtonGroupSeparator className="bg-accent h-5! my-auto!" />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => unselectAll()}
                aria-label="Clear selection"
                className="text-muted-foreground"
              >
                <RemoveIcon className="size-5" />
              </Button> */}
            </ButtonGroup>
          ) : (
            <ButtonGroup>
              <ButtonGroupText className="text-muted-foreground border-none bg-card">
                {selectedCount} selected
              </ButtonGroupText>
              {/* <ButtonGroupSeparator className="bg-accent h-5! my-auto!" /> */}

              {rail('Move to…', MoveFillIcon, actions.onMove)}
              {/* {rail('Favorite', FavoritesFillIcon, actions.onFavorite)} */}
              {rail('Download', DownloadFillIcon, actions.onDownload)}
              {rail('Share', ShareItemFillIcon, actions.onShare)}
              {/* <ButtonGroupSeparator className="bg-accent h-5! my-auto!" /> */}
              {/* <ButtonGroupSeparator className="bg-accent h-5! my-auto!" /> */}
              {rail(
                'Trash',
                () => (
                  <TrashFillIcon />
                ),
                actions.onTrash,
                true
              )}
              {/* <Button
                variant="outline"
                size="icon"
                onClick={() => unselectAll()}
                aria-label="Clear selection"
                className="text-current border-none"
                >
                <RemoveIcon className="size-6" />
              </Button> */}
            </ButtonGroup>
          )}
        </div>
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
