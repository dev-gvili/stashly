import { memo, type CSSProperties, type MouseEvent } from 'react'
import { Link, useViewTransitionState } from 'react-router'
import { PinFillIcon } from '@/components/icons'
import { itemCheckboxClassName } from '@/components/stash/item-card'
import { fileCardCheckboxClassName } from '@/components/core-components/file-card-variants/file-card-detail'
import { Button } from '@/ui/button'
import { Checkbox } from '@/ui/checkbox'
import { useFileHref } from '@/hooks/useFileHref'
import { usePinItem } from '@/hooks/usePinItem'
import type { GalleryPageImage } from '@/types/stash.types'
import { cn } from '@/utils/styles'

export interface GalleryTileProps {
  image: GalleryPageImage
  /** Width / height the tile keeps (River, Waterfall); Grid cells are 4:3. */
  aspect: number
  /** Grid cells take a fixed 4:3 frame; the others keep the image's shape. */
  cell?: 'grid' | 'free'
  selected: boolean
  /** True while anything is selected: a click toggles instead of opening. */
  selectionMode: boolean
  onToggle: (id: string, selected: boolean) => void
  /** Records the shift key for range selection (from `useSelection`). */
  onMouseDown: (e: MouseEvent) => void
}

/**
 * One image in the gallery. It is an ordinary in-flow element: the section's
 * CSS layout (grid, columns or flex row) sizes it, and its `aspect-ratio`
 * gives the height. Nothing positions it from JavaScript, so a width change —
 * the sidebar animating — costs no script and no re-render.
 *
 * The open target, checkbox and pin are siblings, never nested, so each is its
 * own tab stop and a checkbox or pin click can never open the image.
 */
export const GalleryTile = memo(function GalleryTile({
  image,
  aspect,
  cell = 'free',
  selected,
  selectionMode,
  onToggle,
  onMouseDown,
}: GalleryTileProps) {
  const to = useFileHref(image) ?? '.'
  const isTransitioning = useViewTransitionState(to)
  const { pinned, toggle: togglePin } = usePinItem(image.id, image.pinned)

  return (
    <div
      data-slot="gallery-tile"
      data-selected={selected || undefined}
      data-selection-mode={selectionMode || undefined}
      style={{ '--aspect': aspect } as CSSProperties}
      className={cn(
        'group @container/tile relative rounded-lg transition-[box-shadow,background-color] duration-200 motion-reduce:transition-none',
        cell === 'grid' ? 'aspect-4/3' : 'aspect-(--aspect)',
        selected && 'bg-primary/15 ring-2 ring-primary'
      )}
    >
      {/* Media — the browser skips its rendering while it is off screen. */}
      <div
        className={cn(
          'content-auto absolute inset-0 overflow-hidden rounded-lg bg-muted transition-[inset,border-radius] duration-200 motion-reduce:transition-none',
          selected && 'inset-1.75 rounded-md'
        )}
      >
        <img
          src={image.src ?? undefined}
          alt=""
          width={image.width}
          height={image.height}
          loading="lazy"
          decoding="async"
          draggable={false}
          style={
            isTransitioning ? { viewTransitionName: `img-${image.id}` } : undefined
          }
          className={cn(
            'size-full object-cover transition-transform duration-500 ease-gallery motion-reduce:transition-none',
            !selected && 'group-hover:scale-103'
          )}
        />
      </div>

      {/* Top shade, so the checkbox and pin read on light images */}
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-x-0 top-0 h-14 rounded-t-lg bg-linear-to-b from-black/45 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100',
          (selected || selectionMode) && 'opacity-100'
        )}
      />

      {/* Name overlay — hidden by a container query on narrow tiles. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-0.5 rounded-b-lg bg-linear-to-t from-black/70 to-transparent px-2.5 pt-7 pb-2.25 text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100 @max-gallery-label/tile:hidden"
      >
        <span className="truncate text-sm font-medium">{image.name}</span>
      </div>

      {/* Open target: a link normally, a toggle in selection mode */}
      {selectionMode ? (
        <button
          type="button"
          aria-pressed={selected}
          aria-label={image.name}
          onMouseDown={onMouseDown}
          onClick={(e) => {
            if (!e.currentTarget.contains(e.target as Node)) return
            onToggle(image.id, !selected)
          }}
          className="absolute inset-0 cursor-pointer rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      ) : (
        <Link
          to={to}
          viewTransition
          prefetch="intent"
          aria-label={image.name}
          className="absolute inset-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      )}

      {/* Checkbox — the item card's own control and look (`ItemCard.Checkbox`
          needs an ItemCard context, so its classes are shared instead). */}
      <Checkbox
        checked={selected}
        onMouseDown={onMouseDown}
        onCheckedChange={(checked) => onToggle(image.id, checked === true)}
        aria-label={`Select ${image.name}`}
        data-slot="item-checkbox"
        className={cn(
          itemCheckboxClassName,
          fileCardCheckboxClassName,
          'absolute! top-2 left-2 opacity-0 transition-opacity duration-150',
          'group-hover:opacity-100 group-focus-within:opacity-100 pointer-coarse:opacity-100',
          (selected || selectionMode) && 'opacity-100'
        )}
      />

      {/* Pin */}
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-label={pinned ? 'Unpin' : 'Pin'}
        aria-pressed={pinned}
        onClick={togglePin}
        className={cn(
          'absolute top-2 right-2 rounded-md bg-black/35 text-white opacity-0 transition-opacity duration-150 hover:bg-black/50 hover:text-white',
          'group-hover:opacity-100 group-focus-within:opacity-100 pointer-coarse:opacity-100',
          pinned &&
            'bg-background/70 text-primary opacity-100 backdrop-blur-sm hover:bg-background/80 hover:text-primary'
        )}
      >
        <PinFillIcon aria-hidden className="size-4" />
      </Button>
    </div>
  )
})
