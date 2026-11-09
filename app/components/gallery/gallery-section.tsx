import type { CSSProperties, MouseEvent } from 'react'

import { SelectAllCheckbox } from '@/components/core-components/page-toolbar'
import { GalleryTile } from '@/components/gallery/gallery-tile'
import type { GalleryPageImage } from '@/types/stash.types'
import {
  GALLERY_ZOOM_SIZES,
  tileAspectFromId,
  type DateGroup,
  type GalleryLayout,
} from '@/utils/gallery-layout'

export interface GallerySectionProps {
  group: DateGroup<GalleryPageImage>
  layout: GalleryLayout
  zoom: number
  selectedIds: ReadonlySet<string>
  selectionMode: boolean
  onToggle: (id: string, selected: boolean) => void
  onMouseDown: (e: MouseEvent) => void
}

type TileHandlers = Pick<
  GallerySectionProps,
  'selectedIds' | 'selectionMode' | 'onToggle' | 'onMouseDown'
>

/**
 * One date group: a header with a tri-state "select group" checkbox, then the
 * group's images in native CSS layout — a grid (Grid), columns (Waterfall) or
 * justified wrapping flex lines (River). The browser places every tile and
 * decides every line break, so a width change runs no script and re-renders
 * nothing.
 */
export function GallerySection({
  group,
  layout,
  zoom,
  ...handlers
}: GallerySectionProps) {
  const ids = group.items.map((i) => i.id)
  const rowHeight = GALLERY_ZOOM_SIZES.river[Math.min(Math.max(zoom, 1), 5) - 1]

  return (
    <section className="flex flex-col gap-3" aria-label={group.label ?? undefined}>
      {group.label && (
        <header className="flex items-center gap-2.5">
          <SelectAllCheckbox ids={ids} label={group.label} />
          <h2 className="text-base font-semibold tracking-tight">{group.label}</h2>
          <span className="text-xs text-muted-foreground tabular-nums">
            {group.sub} · {group.items.length}{' '}
            {group.items.length === 1 ? 'image' : 'images'}
          </span>
        </header>
      )}
      <div
        data-slot="gallery-canvas"
        style={{ '--row-h': `${rowHeight}px` } as CSSProperties}
        className={
          layout === 'grid' ? 'gallery-grid' : layout === 'river' ? 'gallery-river' : 'gallery-columns'
        }
      >
        {group.items.map((image) => (
          <Tile
            key={image.id}
            image={image}
            cell={layout === 'grid' ? 'grid' : 'free'}
            aspect={tileAspectFromId(layout, image.id)}
            {...handlers}
          />
        ))}
      </div>
    </section>
  )
}

function Tile({
  image,
  cell,
  aspect,
  selectedIds,
  selectionMode,
  onToggle,
  onMouseDown,
}: TileHandlers & { image: GalleryPageImage; cell: 'grid' | 'free'; aspect: number }) {
  return (
    <GalleryTile
      image={image}
      aspect={aspect}
      cell={cell}
      selected={selectedIds.has(image.id)}
      selectionMode={selectionMode}
      onToggle={onToggle}
      onMouseDown={onMouseDown}
    />
  )
}
