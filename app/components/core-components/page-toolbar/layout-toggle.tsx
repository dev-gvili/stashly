import { LayoutMenu, LayoutMenuItem } from '@/ui/layout-menu'
import { GridFillIcon, ListFillIcon } from '@/components/icons'
import { cn } from '@/utils/styles'
import type { ToolbarLayout } from './types'

/**
 * Grid / list segmented control shared by the toolbar variants. Wraps the app's
 * `LayoutMenu` so the toggle keeps the standard segmented styling *and* the
 * `?layout=` URL sync every other layout switcher in the app uses.
 */
export function LayoutToggle({
  layout = 'grid',
  onLayoutChange,
  className,
}: {
  layout?: ToolbarLayout
  onLayoutChange?: (layout: ToolbarLayout) => void
  className?: string
}) {
  return (
    <LayoutMenu
      value={layout}
      onLayoutChange={(value) => onLayoutChange?.(value as ToolbarLayout)}
      className={cn('shrink-0', className)}
    >
      <LayoutMenuItem value="grid" tooltip="Grid view" aria-label="Grid view">
        <GridFillIcon className="size-5" />
      </LayoutMenuItem>
      <LayoutMenuItem value="list" tooltip="List view" aria-label="List view">
        <ListFillIcon className="size-5" />
      </LayoutMenuItem>
    </LayoutMenu>
  )
}
