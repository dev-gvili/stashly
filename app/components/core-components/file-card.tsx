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
 * FileCard — a square card whose thumbnail fills it edge to edge: no padding,
 * no arch, no letterboxing. The cover falls back to the item's category icon
 * when no real thumbnail exists.
 *
 * Floating over the cover: a selection checkbox top-left, the action menu
 * top-right, and a frosted info bar along the bottom carrying name, kind, size
 * and date. Built from `ItemCard` compound parts so it inherits selection,
 * drag-and-drop, navigation, and the live thumbnail signal for free.
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
      className={cn(
        'relative aspect-square p-0 gap-0 border border-input',
        className
      )}
    >
      <ItemCard.Thumbnail className="absolute inset-0 aspect-auto h-full w-full rounded-none bg-muted">
        <ItemCard.ThumbnailImage className="rounded-none transition-transform duration-500 ease-out group-hover/card:scale-[1.04]" />
        <ItemCard.ThumbnailFallback className="rounded-none text-muted-foreground" />
      </ItemCard.Thumbnail>

      {/* Depth scrim: lifts the frosted overlays off busy photography. No text
          sits directly on it, so the fixed-color contrast rule doesn't apply. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-black/40 via-transparent to-black/25"
      />

      <ItemCard.Header className="absolute inset-x-0 top-0 z-20 p-2!">
        <ItemCard.Checkbox
          name="selectedItems"
          value={item.id}
          className="border-white/40 bg-background/40! backdrop-blur-sm"
        />
        {showActions && (
          <ItemCard.Actions className="place-self-end rounded-md bg-background/40 p-1 text-foreground backdrop-blur-sm hover:bg-background/80">
            {actions}
          </ItemCard.Actions>
        )}
      </ItemCard.Header>

      <div className="absolute inset-x-0 bottom-0 z-20 p-2">
        <div className="flex flex-col gap-1 rounded-md border border-white/10 bg-background/70 px-3 py-2 backdrop-blur-md">
          <ItemCard.Name className="h-auto w-full max-w-full truncate text-left text-sm font-semibold text-card-foreground" />
          <div className="flex min-w-0 items-center gap-1.5 truncate">
            <ItemCard.Kind />
            <span className="text-xs text-muted-foreground/50">•</span>
            <ItemCard.Size className="h-auto w-auto shrink-0 place-self-auto text-xs text-muted-foreground" />
            <span className="text-xs text-muted-foreground/50">•</span>
            <ItemCard.Date className="truncate" />
          </div>
        </div>
      </div>
    </ItemCard>
  )
}
