import { ItemCard, type ItemCardProps } from '@/components/stash/item-card'
import { itemMeta } from '@/utils/formaters'
import { cn } from '@/utils/styles'

/**
 * Quick-access tile for a pinned item. Landscape (aspect-video) so a row of
 * four fits the panel, and thumbnail-led: the item's own preview is the hero —
 * it takes the full tile width and every row the name line doesn't need — with
 * the category glyph only as fallback.
 */
export function PinnedTile({ className, children, ...item }: ItemCardProps) {
  return (
    <ItemCard
      {...item}
      className={cn(
        'bg-muted flex aspect-video w-full flex-col justify-between gap-0 rounded-2xl border-none! p-2',
        className
      )}
    >
      {/* `aspect-auto` clears the Thumbnail's own aspect-video so `flex-1` owns
          the height — the hero grows to whatever the footer leaves behind. */}
      <ItemCard.Thumbnail className="bg-card aspect-auto min-h-0 w-full flex-1 overflow-hidden rounded-xl">
        <ItemCard.ThumbnailImage className="rounded-xl" />
        <ItemCard.ThumbnailFallback className="text-muted-foreground rounded-xl p-2 [&_svg]:size-10" />
      </ItemCard.Thumbnail>
      <ItemCard.Footer className="min-w-0 shrink-0 flex-col items-start gap-0.5 px-1 pt-2 pb-1">
        <ItemCard.Name className="font-stashly h-auto w-full max-w-full truncate text-left text-sm font-semibold" />
        <span className="text-muted-foreground truncate text-xs tracking-wider uppercase">
          {itemMeta(item)}
        </span>
      </ItemCard.Footer>
      {children}
    </ItemCard>
  )
}
