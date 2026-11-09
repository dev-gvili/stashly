import { useMemo } from 'react'
import { useRouteLoaderData } from 'react-router'
import { RecentFillIcon, ZoomInFillIcon, ZoomOutFillIcon } from '@/components/icons'
import {
  StashPageToolbar,
  type SelectionAction,
} from '@/components/views/stash-page-toolbar'
import { Slider } from '@/ui/slider'
import { Toggle } from '@/ui/toggle'
import { Tooltip } from '@/ui/tooltip'
import { useGalleryPrefs } from '@/hooks/useGalleryPrefs'
import { useSelection } from '@/hooks/useSelection'
import type { GalleryPageImage } from '@/types/stash.types'
import { formatSize } from '@/utils/formaters'
import { cn } from '@/utils/styles'

/** The Images page's selection actions, in order. */
const GALLERY_ACTIONS: SelectionAction[] = [
  'addToCollection',
  'share',
  'download',
  'trash',
  'clear',
]

/**
 * The Images page's slot in the app header: the view controls, swapped for
 * the stash toolbar's selection actions ("N selected", Move, Download, Share,
 * Trash) while any image is selected — so the page never needs a second row.
 */
export function GalleryHeaderTools({ className }: { className?: string }) {
  const { selectedIds } = useSelection()
  const data = useRouteLoaderData('stash-images') as
    | { data?: GalleryPageImage[] }
    | undefined
  const items = useMemo(
    () =>
      (data?.data ?? []).map((img) => ({
        id: img.id,
        name: img.name,
        type: 'file' as const,
        size: img.bytes,
      })),
    [data?.data]
  )

  if (selectedIds.length > 0) {
    const bytes = items.reduce((sum, item) => sum + item.size, 0)
    return (
      <StashPageToolbar
        variant="actions"
        items={items}
        stats={{ size: formatSize('byte', 'unit', bytes), files: items.length, folders: 0 }}
        actionSet={GALLERY_ACTIONS}
        confirmTrash
      />
    )
  }
  // The controls need the room: below the header's `gallery-header` width
  // they step aside. The selection actions show at every size.
  return (
    <GalleryViewControls
      className={cn('@max-gallery-header/header:hidden', className)}
    />
  )
}

/** Same frame as the header's `LayoutToggle`, so the row reads as one set. */
const frame = 'flex h-9 shrink-0 items-center gap-2 rounded-md bg-card px-2.5 text-muted-foreground ring-2 ring-accent'

/** Two bars spaced `gap-px` or `gap-1`: the "tight" and "wide" gap glyphs. */
function GapGlyph({ wide }: { wide?: boolean }) {
  return (
    <span aria-hidden className={wide ? 'flex gap-1' : 'flex gap-px'}>
      <span className="h-2.5 w-1 rounded-xs bg-current" />
      <span className="h-2.5 w-1 rounded-xs bg-current" />
    </span>
  )
}

/**
 * The Images page's view controls for the app header: By date, gap between
 * images and thumbnail size. Layout is the header's own `LayoutToggle`. The
 * values live in `useGalleryPrefs`, shared with the page's tiles.
 */
export function GalleryViewControls({ className }: { className?: string }) {
  const { prefs, setPref } = useGalleryPrefs()

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Toggle
        size="sm"
        pressed={prefs.byDate}
        onPressedChange={(on) => setPref('byDate', on)}
        className="font-stashly h-9 shrink-0 gap-1.5 rounded-md bg-card px-2.5 text-muted-foreground ring-2 ring-accent data-[state=on]:bg-secondary data-[state=on]:text-foreground"
      >
        <RecentFillIcon aria-hidden />
        By date
      </Toggle>

      <Tooltip content="Gap between images" asChild>
        <div className={frame}>
          <GapGlyph />
          <Slider
            min={0}
            max={20}
            step={2}
            value={[prefs.gap]}
            onValueChange={([v]) => setPref('gap', v)}
            aria-label="Gap between images"
            className="w-16"
          />
          <GapGlyph wide />
          <span className="min-w-6.5 text-right text-xs tabular-nums">
            {prefs.gap}px
          </span>
        </div>
      </Tooltip>

      <Tooltip content="Thumbnail size" asChild>
        <div className={frame}>
          <ZoomOutFillIcon aria-hidden className="size-4" />
          <Slider
            min={1}
            max={5}
            step={1}
            value={[prefs.zoom]}
            onValueChange={([v]) => setPref('zoom', v)}
            aria-label="Thumbnail size"
            className="w-19"
          />
          <ZoomInFillIcon aria-hidden className="size-4" />
        </div>
      </Tooltip>
    </div>
  )
}
