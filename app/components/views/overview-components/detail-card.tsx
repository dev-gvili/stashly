import { ItemCard } from '@/components/stash/item-card'
import type { StashItem } from '@/types/stash.types'
import { formatSize } from '@/utils/formaters'
import { cn } from '@/utils/styles'
import type { ReactNode } from 'react'

/**
 * The overview's workhorse item card — the same anatomy as `FileCardDetail`
 * (rounded-3xl shell with a p-2 gutter, rounded-2xl hero, name/size left and
 * date right) but with two slots the overview needs: `overlay` for chips that
 * ride the thumbnail, and `footerNote` / `footerRight` when the meta line has
 * to say something other than size and modified date.
 *
 * `fill` drops the fixed 4:3 hero so the card can stretch to a grid row that
 * another block (e.g. the folder grid beside it) has already sized.
 *
 * Navigation, drag-and-drop, selection and the actions menu all come from
 * `ItemCard` — nothing here re-implements them.
 */
export function OverviewDetailCard({
  item,
  overlay,
  footerNote,
  footerRight,
  fill = false,
  className,
  children,
}: {
  item: StashItem
  overlay?: ReactNode
  footerNote?: ReactNode
  footerRight?: ReactNode
  fill?: boolean
  className?: string
  children?: ReactNode
}) {
  return (
    <ItemCard
      {...item}
      className={cn(
        'bg-card flex flex-col justify-between gap-0 rounded-3xl border-none! p-2',
        fill && 'h-full',
        className
      )}
    >
      <div
        className={cn(
          'bg-card relative w-full overflow-hidden rounded-2xl shadow-[2px_6px_6px_0_rgba(38,38,38,0.10)] dark:shadow-[0px_6px_6px_3px_rgba(0,0,0,0.35)]',
          fill ? 'flex-1' : 'aspect-4/3'
        )}
      >
        <ItemCard.Thumbnail className="absolute inset-0 size-full">
          <ItemCard.ThumbnailImage className="rounded-2xl transition-transform duration-700 ease-out group-hover/card:scale-125" />
          <ItemCard.ThumbnailFallback className="text-muted-foreground rounded-2xl" />
        </ItemCard.Thumbnail>

        {/* Checkbox + actions fade in on hover and stay while the menu is open
            or the item is checked, so the dropdown can't disappear under the
            pointer. `group/card` is the named group ItemCard's root declares. */}
        <ItemCard.Header className="absolute inset-x-0 top-0 z-20 hidden p-2! group-hover/card:flex! has-[[data-slot=dropdown-menu-trigger][data-state=open]]:flex! has-[[data-slot=item-checkbox][data-state=checked]]:flex!">
          <ItemCard.Checkbox
            name="selectedItems"
            value={item.id}
            className="border-primary/40 bg-input! data-[state=checked]:border-primary rounded-sm backdrop-blur-sm"
          />
          <ItemCard.Actions className="bg-background/40 text-foreground hover:bg-background/80 place-self-end rounded-lg p-1 backdrop-blur-sm data-[state=open]:flex!">
            {children}
          </ItemCard.Actions>
        </ItemCard.Header>

        {overlay}
      </div>

      <ItemCard.Footer className="flex items-end justify-between gap-3 px-1 pt-3 pb-1">
        <div className="min-w-0">
          <ItemCard.Name className="font-stashly h-auto w-full max-w-full truncate text-left text-sm font-semibold" />
          <p className="text-muted-foreground font-stashly truncate text-xs tabular-nums">
            {footerNote ?? formatSize('byte', 'unit', item.size)}
          </p>
        </div>
        {footerRight ?? (
          <ItemCard.Date className="text-muted-foreground shrink-0 truncate text-xs" />
        )}
      </ItemCard.Footer>
    </ItemCard>
  )
}
