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
} from '@/components/icons'
import { SelectAllCheckbox } from './toolbar-stats'
import { LayoutToggle } from './layout-toggle'
import { Breadcrumbs } from '@/components/core-components/breadcrumb-navigation'
import { useSelection } from '@/components/stash/selection'
import { useBreadcrumbs } from '@/hooks'
import type { BulkActions, ToolbarContext } from './types'
import { cn } from '@/utils/styles'
import { useLocation } from 'react-router'
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
  ...actions
}: Props) {
  const location = useLocation()
  const { selectedIds, unselectAll, selectAll } = useSelection()
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
        className={cn(
          danger
            ? 'hover:text-destructive'
            : ''
        )}
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

      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
        {isTrash ? (
          <h1 className="font-stashly text-sm font-semibold">Trash</h1>
        ) : (
          <>
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
            <Breadcrumbs />
          </>
        )}
        <Badge variant="outline" className="hidden tabular-nums md:inline-flex">
          {itemCount.toLocaleString()} items
        </Badge>
      </div>

      {active ? (
        <div className="flex shrink-0 items-center gap-1 rounded-md ring-2 ring-accent bg-card pl-2">
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
            <ButtonGroup>
              <ButtonGroupText className="text-muted-foreground border-none bg-card">
                {selectedCount} selected
              </ButtonGroupText>
              <ButtonGroupSeparator className="bg-accent w-2" />
              {rail('Move to…', MoveFillIcon, actions.onMove)}
              {rail('Favorite', FavoritesFillIcon, actions.onFavorite)}
              {rail('Download', DownloadFillIcon, actions.onDownload)}
              {rail('Share', ShareItemFillIcon, actions.onShare)}
              <ButtonGroupSeparator className="bg-accent w-2" />
              {rail('Move to trash', TrashFillIcon, actions.onTrash, true)}
              <ButtonGroupSeparator className="bg-accent w-2" />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => unselectAll()}
                aria-label="Clear selection"
                className="text-muted-foreground"
              >
                <RemoveIcon className="size-5" />
              </Button>
            </ButtonGroup>
          )}
        </div>
      ) : (
        <div className="flex shrink-0 items-center gap-1">
          <Separator orientation="vertical" className="mx-1 h-5" />
        </div>
      )}
    </nav>
  )
}
