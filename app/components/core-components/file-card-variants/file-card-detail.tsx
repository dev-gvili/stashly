import { ItemCard } from '@/components/stash/item-card'
import { Button } from '@/ui/button'
import { OpenWithIcon } from '@/components/icons'
import { cn } from '@/utils/styles'
import { splitSize, type FileCardVariantProps } from './types'

/**
 * Variant 4 — Detail.
 * A trail-card reading: a dark hero carrying the name, kind and the primary
 * action together on the scrim, then a single quiet spec line on card ground —
 * size on the left, modified date on the right. Wide cells suit it best.
 */
export function FileCardDetail({
  item,
  className,
  showActions = true,
  actions,
}: FileCardVariantProps) {
  const [value, unit] = splitSize(item.size)

  return (
    <ItemCard
      {...item}
      className={cn(
        'flex flex-col gap-0 rounded-3xl! border-none ring ring-inset ring-sidebar-accent shadow-sm p-2 bg-card group has-[[data-slot=item-checkbox][data-state=checked]]:ring-inset has-[[data-slot=item-checkbox][data-state=checked]]:ring-primary/50',
        className
      )}
    >
      {/* Concentric: card is rounded-3xl (24px) with p-2 (8px), so the hero
          reads 24 − 8 = 16px. The radius has to live on this wrapper too —
          it owns the overflow clip and the shadow, both of which would
          otherwise render square behind the rounded thumbnail. */}
      <div className="relative aspect-4/3 w-full overflow-hidden rounded-2xl ring ring-muted shadow-[2px_8px_10px_0_rgba(38,38,38,0.55)] bg-card">
        <ItemCard.Thumbnail className="absolute inset-0 h-full w-full ">
          <ItemCard.ThumbnailImage className="rounded-2xl transition-transform duration-700 ease-out group-hover/card:scale-105" />
          <ItemCard.ThumbnailFallback className="rounded-2xl text-muted-foreground" />
        </ItemCard.Thumbnail>
        {/* Scrim: the name/kind/Open row sits on a fixed dark ground, so the
            text below uses literal white rather than theme tokens. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-2xl"
        />

        {/* Stays visible while the actions menu is open — otherwise moving the
            pointer off the card hides the row out from under the open menu. */}
        <ItemCard.Header className="absolute inset-x-0 top-0 z-20 p-2! hidden group-hover:flex has-[[data-slot=dropdown-menu-trigger][data-state=open]]:flex">
          <ItemCard.Checkbox
            name="selectedItems"
            value={item.id}
            className="border-primary/40 bg-input! rounded-sm backdrop-blur-sm"
          />
          {showActions && (
            // rounded-lg (8px) = the hero's 16px radius minus this row's p-2 inset.
            <ItemCard.Actions className="place-self-end rounded-lg bg-background/40 p-1 text-foreground backdrop-blur-sm hover:bg-background/80">
              {actions}
            </ItemCard.Actions>
          )}
        </ItemCard.Header>

        <div className="absolute inset-x-0 bottom-0 z-20 flex items-end gap-2 p-2.5">
          {/* pl-3.5/pr-4: the icon side takes 2px less than the text side so
              the label reads optically centred. Overrides Button's base
              `transition-all` with just the property that changes on press. */}
          {/* <Button
            size="sm"
            className="shrink-0 rounded-full bg-background/85 pl-3.5 pr-4 text-foreground backdrop-blur-md transition-transform duration-150 ease-out hover:bg-background active:scale-[0.96]"
          >
            <OpenWithIcon className="size-4" />
            Open
          </Button> */}
        </div>
      </div>

      <div className="flex items-end justify-between gap-3 px-1 pb-1 pt-3">
        <div className="min-w-0">
          <ItemCard.Name className="h-auto w-full max-w-full truncate text-left font-stashly text-sm font-semibold text-foreground" />
          <p className="truncate font-stashly text-sm font-semibold tabular-nums">
            {value}
            <span className="text-xs font-medium text-muted-foreground">
              {unit}
            </span>
          </p>
        </div>
        <ItemCard.Date className="shrink-0 truncate text-xs text-muted-foreground" />
      </div>
    </ItemCard>
  )
}
