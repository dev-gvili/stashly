import { Button } from '@/ui/button'
import { Separator } from '@/ui/separator'
import {
  TrashIcon,
  TrashFillIcon,
  RestoreIcon,
  FavoriteIcon,
  MoveToFolder,
  DownloadIcon,
  ShareItemFillIcon,
  RemoveIcon,
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
  /** stats for the folder you're inside, e.g. "6 folders · 214 files · 3.8 GB" */
  statsLine: string
  context?: ToolbarContext
  /** formatted size of the current selection — the toolbar can't derive it */
  selectedSize?: string
  onBack?: () => void
  layout?: ToolbarLayout
  onLayoutChange?: (layout: ToolbarLayout) => void
  className?: string
}

/**
 * Variant 5 — Slide-over command bar.
 * The breadcrumb row is permanent. A selection slides a full-width inverted
 * command bar in beneath it (`grid-rows-[0fr]` → `[1fr]`, so it animates height
 * without measuring): labelled actions on the primary ground, destructive
 * action isolated on the right.
 *
 * Selection comes from the app-wide actor (`useSelection`), so this must render
 * under a route that mounts `<SelectionProvider items={…}>`.
 */
export function PageToolbarCommandBar({
  statsLine,
  context = 'files',
  selectedSize,
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

  // Ghost buttons riding the primary ground — token pair keeps AA contrast in
  // both themes, so no literal colors here.
  const barBtn =
    'font-stashly text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground'

  return (
    <header
      className={cn(
        'sticky top-0 z-10 shrink-0 border-b border-input bg-sidebar',
        className
      )}
    >
      <div className="flex h-14 items-center gap-2 px-3">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onBack}
          aria-label="Back"
          className={cn('shrink-0 text-muted-foreground', !nested && 'invisible')}
        >
          <ArrowLeftFillIcon className="size-5" />
        </Button>
        {isTrash ? (
          <h1 className="font-stashly text-sm font-semibold">Trash</h1>
        ) : (
          <Breadcrumbs />
        )}
        <div className="ml-auto flex shrink-0 items-center gap-3">
          <span className="hidden whitespace-nowrap font-stashly text-xs text-muted-foreground tabular-nums md:inline">
            {statsLine}
          </span>
          <LayoutToggle layout={layout} onLayoutChange={onLayoutChange} />
        </div>
      </div>

      <div
        className={cn(
          'grid overflow-hidden transition-all duration-200',
          active ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="flex h-12 items-center gap-1.5 bg-primary px-3 text-primary-foreground">
            <SelectAllCheckbox
              className="hover:bg-primary-foreground/15"
              checkboxClassName="border-primary-foreground/60 dark:bg-transparent data-[state=checked]:bg-primary-foreground data-[state=checked]:text-primary data-[state=checked]:border-primary-foreground dark:data-[state=checked]:bg-primary-foreground dark:data-[state=checked]:text-primary"
            />
            <span className="mr-1 whitespace-nowrap font-stashly text-xs text-primary-foreground/70">
              <span className="font-semibold text-primary-foreground tabular-nums">
                {selectedCount}
              </span>{' '}
              selected
              {selectedSize ? (
                <span className="hidden tabular-nums sm:inline">
                  {' '}
                  · {selectedSize}
                </span>
              ) : null}
            </span>
            <Separator
              orientation="vertical"
              className="mx-1 h-5 bg-primary-foreground/20"
            />

            {isTrash ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={actions.onRestore}
                  className={barBtn}
                >
                  <RestoreIcon className="size-5" />
                  Restore
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={actions.onMove}
                  className={barBtn}
                >
                  <MoveToFolder className="size-5" />
                  Restore to…
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={actions.onDeleteForever}
                  className="ml-auto"
                >
                  <TrashFillIcon className="size-5" />
                  Delete forever
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={actions.onMove}
                  className={barBtn}
                >
                  <MoveToFolder className="size-5" />
                  Move
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={actions.onFavorite}
                  className={barBtn}
                >
                  <FavoriteIcon className="size-5" />
                  Favorite
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={actions.onDownload}
                  className={cn('hidden md:inline-flex', barBtn)}
                >
                  <DownloadIcon className="size-5" />
                  Download
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={actions.onShare}
                  className={cn('hidden lg:inline-flex', barBtn)}
                >
                  <ShareItemFillIcon className="size-5" />
                  Share
                </Button>
                <div className="ml-auto flex items-center gap-1.5">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={actions.onTrash}
                  >
                    <TrashIcon className="size-5" />
                    Trash
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => unselectAll()}
                    aria-label="Clear selection"
                    className="text-primary-foreground/70 hover:bg-primary-foreground/15 hover:text-primary-foreground"
                  >
                    <RemoveIcon className="size-5" />
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
