import type { ReactNode } from 'react'
import { ItemCard } from '@/components/stash/item-card'
import { Badge } from '@/ui/badge'
import { Button } from '@/ui/button'
import { OpenWithIcon } from '@/components/icons'
import { cn } from '@/utils/styles'
import type { FileCardVariantProps } from './types'
import { formatSize } from '@/utils/formaters';
import { HomeFilePreview } from '@/components/views/home-components/home-file-preview'
import { toFileKind } from '@/components/views/home-components/home-data'
import { KIND_ICON } from '@/components/views/home-components/home-format'

/**
 * The file card's selection checkbox look, layered on `itemCheckboxClassName`:
 * a ringed input-coloured box that turns foreground when checked. Shared with
 * the Images page tiles so both select with the same control.
 */
export const fileCardCheckboxClassName =
  'bg-input! rounded-sm backdrop-blur-sm aria-checked:border-none! aria-checked:ring-accent/50 ring-2 aria-checked:bg-foreground! aria-checked:text-background!'

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
  const kind = toFileKind(item.category)
  const KindIcon = KIND_ICON[kind]

  return (
    <ItemCard
      {...item}
      className={cn(
        'group flex min-w-0 flex-col gap-0 overflow-hidden rounded-2xl! border border-border/50 bg-card p-0 shadow-none transition-[border-color,box-shadow] hover:border-border hover:shadow-stashly',
        className
      )}
    >
      {/* Tile pattern: a 4:3 cover over the body, split by a hairline. */}
      <div className="relative aspect-4/3 w-full overflow-hidden border-b border-border/50 bg-muted">
        <ItemCard.Thumbnail className="absolute inset-0 h-full w-full rounded-none">
          {/* Category art (page, waveform, code lines…) until a thumbnail lands.
              Before the image: both are absolute, so the later one paints on top. */}
          <ItemCard.ThumbnailFallback className="rounded-none p-0">
            <HomeFilePreview kind={kind} />
          </ItemCard.ThumbnailFallback>
          <ItemCard.ThumbnailImage className="rounded-none" />
        </ItemCard.Thumbnail>

        {/* The app badge in the primary colour (owner, 14 Nov: the round chip
            didn't match the app's badges). Hidden while the checkbox row
            shows, which takes the same corner. */}
        {item.file?.extension && (
          <Badge
            asChild
            className="absolute top-2.5 left-2.5 bg-primary text-primary-foreground group-hover/card:hidden group-has-[[data-slot=item-checkbox][data-state=checked]]/card:hidden"
          >
            <ItemCard.Kind />
          </Badge>
        )}

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
            className={fileCardCheckboxClassName}
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

      <div className="flex min-w-0 flex-col gap-1.5 px-3.5 pt-3 pb-3.5">
        {name ?? (
          <ItemCard.Name className="h-auto w-full max-w-full truncate text-left font-stashly text-sm font-medium tracking-tight text-foreground" />
        )}
        <div className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
          <KindIcon className="size-3.5 shrink-0" />
          <span className="flex min-w-0 items-center gap-1 truncate font-stashly text-2xs tabular-nums">
            {size} ·
            <ItemCard.Date className="truncate text-2xs" />
          </span>
          {meta}
        </div>
      </div>

      {children}
    </ItemCard>
  )
}
