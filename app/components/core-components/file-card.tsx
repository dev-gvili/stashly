import { ItemCard } from '@/components/stash/item-card'
import type { StashItem } from '@/types/stash.types'
import { cn } from '@/utils/styles'
import type { ReactNode } from 'react'

export interface FileCardProps {
  /** The item to render. Folders should use `FolderCardTab` instead. */
  item: StashItem
  className?: string
  /** When false, the action menu is hidden (e.g. read-only shared items). */
  showActions?: boolean
  /** Custom action-menu contents; falls back to the default menu when omitted. */
  actions?: ReactNode
}

/**
 * FileCard — square card with an edge-to-edge cover whose bottom edge is an
 * oval arch, above a body that stacks name / date / big-size-stat + kind. The
 * cover falls back to the item's category icon when no real thumbnail exists.
 *
 * Overlaid on the cover: a selection checkbox at the top-left and the item
 * action menu at the top-right. Built entirely from `ItemCard` compound parts
 * so it inherits selection, drag-and-drop, navigation, and the live thumbnail
 * signal for free.
 */
export function FileCard({
  item,
  className,
  showActions = true,
  actions,
}: FileCardProps) {
  return (
    <ItemCard
      {...item}
      className={cn('flex flex-col aspect-square p-0 gap-0', className)}
    >
      <ItemCard.Cover />
      <ItemCard.Header className="absolute inset-x-0 top-0 z-10 p-2!">
        <ItemCard.Checkbox name="selectedItems" value={item.id} />
        {showActions && (
          <ItemCard.Actions className="place-self-end rounded-md bg-background/30 p-1 text-foreground backdrop-blur-sm hover:bg-background/70">
            {actions}
          </ItemCard.Actions>
        )}
      </ItemCard.Header>
      <div className="flex min-h-0 flex-1 flex-col gap-1 p-3">
        <ItemCard.Name className="h-auto w-full max-w-full truncate text-left text-base font-semibold text-card-foreground" />
        <ItemCard.Date />
        <div className="mt-auto flex items-end justify-between gap-2">
          <ItemCard.SizeStat />
          <ItemCard.Kind />
        </div>
      </div>
    </ItemCard>
  )
}
