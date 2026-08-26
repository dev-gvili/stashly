import type { ReactNode } from 'react'
import { ItemCard } from '@/components/stash/item-card'
import { Button } from '@/ui/button'
import { OpenWithIcon } from '@/components/icons'
import { cn } from '@/utils/styles'
import type { FileCardVariantProps } from './types'
import { formatSize } from '@/utils/formaters';

export interface FileCardDetailProps extends FileCardVariantProps {
  /**
   * Replaces the name line. For callers that must render the name themselves —
   * search highlights query terms and clips the middle to keep the extension —
   * while everything else about the card stays put.
   */
  name?: ReactNode
  /** Extra content on the spec line, right of the size. */
  meta?: ReactNode
  /** Pinned onto the hero, above the thumbnail. Position it yourself. */
  overlay?: ReactNode
  /**
   * A third concentric block welded below the spec line, inside the card's own
   * gutter — search puts the matching passage here so the evidence can never
   * drift away from the file it belongs to.
   */
  children?: ReactNode
}

/**
 * Variant 4 — Detail.
 * A trail-card reading: a dark hero carrying the name, kind and the primary
 * action together on the scrim, then a single quiet spec line on card ground —
 * size on the left, modified date on the right. Wide cells suit it best.
 *
 * The `name` / `meta` / `overlay` / `children` slots exist so a caller can add
 * to the anatomy without forking it. They are all optional and the card is
 * unchanged when none are passed.
 */
export function FileCardDetail({
  item,
  className,
  showActions = true,
  actions,
  name,
  meta,
  overlay,
  children,
}: FileCardDetailProps) {
  const size = formatSize('byte', 'unit', item.size)

  return (
    <ItemCard
      {...item}
      className={cn(
        'flex flex-col gap-0 rounded-3xl! border-none p-2 bg-muted group',
        className
      )}
    >
      {/* Concentric: card is rounded-3xl (24px) with p-2 (8px), so the hero
          reads 24 − 8 = 16px. The radius has to live on this wrapper too —
          it owns the overflow clip and the shadow, both of which would
          otherwise render square behind the rounded thumbnail. */}
      <div className="relative aspect-4/3 w-full overflow-hidden rounded-2xl  shadow-[2px_6px_6px_0_rgba(38,38,38,0.10)] dark:shadow-[0px_6px_6px_3px_rgba(0,0,0,0.35)]  bg-card">
        <ItemCard.Thumbnail className="absolute inset-0 h-full w-full ">
          <ItemCard.ThumbnailImage className="rounded-2xl transition-transform duration-700 ease-out group-hover/card:scale-125" />
          <ItemCard.ThumbnailFallback className="rounded-2xl text-muted-foreground" />
        </ItemCard.Thumbnail>

        {overlay}
        {/* Scrim: the name/kind/Open row sits on a fixed dark ground, so the
            text below uses literal white rather than theme tokens. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-2xl"
        />

        {/* Stays visible while the actions menu is open — otherwise moving the
            pointer off the card hides the row out from under the open menu. */}
        <ItemCard.Header className="absolute inset-x-0 top-0 z-20 p-2! hidden group-hover/card:flex! has-[[data-slot=dropdown-menu-trigger][data-state=open]]:flex! has-[[data-slot=item-checkbox][data-state=checked]]:flex!">
          <ItemCard.Checkbox
            name="selectedItems"
            value={item.id}
            className="bg-input! rounded-sm backdrop-blur-sm aria-checked:border-none! aria-checked:ring-accent/50 ring-2 aria-checked:bg-foreground! aria-checked:text-background! "
          />
          {showActions && (
            // rounded-lg (8px) = the hero's 16px radius minus this row's p-2 inset.
            <ItemCard.Actions className="place-self-end hidden group-hover/card:flex! has-[[data-slot=dropdown-menu-trigger][data-state=open]]:flex! has-[[data-slot=dropdown-menu-trigger][data-state=open]]:bg-primary data-[state=open]:flex!">
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
          {name ?? (
            <ItemCard.Name className="h-auto w-full max-w-full truncate text-left font-stashly text-sm font-semibold text-foreground" />
          )}
          <p className="flex items-center gap-2 truncate font-stashly text-xs text-muted-foreground tabular-nums">
            {size}
            {meta}
          </p>
        </div>
        <ItemCard.Date className="shrink-0 truncate text-xs text-muted-foreground" />
      </div>

      {children}
    </ItemCard>
  )
}
