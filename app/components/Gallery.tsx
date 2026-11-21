import { AnimatePresence, motion } from 'framer-motion'
import { useSearchParams, Link } from 'react-router'
import { RiverView } from './views/river-view'
import { WaterfallLayout } from './views/waterfall-view'
import type { GalleryImage, GalleryPageImage } from '@/types/stash.types'
import { GridLayout } from './views/grid-view'
import { itemVariants } from './views/variants'
import { useFileHref } from '../hooks/useFileHref'
import { useScrollRestoration } from '@/hooks/useScrollRestoration'
import { useCallback, useEffect, useMemo, useRef, useState, ViewTransition, type CSSProperties, type ReactNode } from 'react'
import { useLocation } from 'react-router'
import { generateVideoThumbnail } from '@/utils/video'
import { cn } from '@/utils'
import { AIcon, MediaIcon, PauseFillIcon } from './icons'
import {
  EmptyGalleryImagesVector,
  EmptyGalleryVideosVector,
  FilteredEmptyVector,
} from '@/components/states/vectors/empty-vectors'
import { Button } from '@/ui/button'
import { GallerySection } from '@/components/gallery/gallery-section'
import { SelectionProvider } from '@/components/stash/selection'
import { useSelection } from '@/hooks/useSelection'
import { useGalleryPrefs } from '@/hooks/useGalleryPrefs'
import { useItemSearch } from '@/hooks/useItemSearch'
import { RANK_DEPTH } from '@/utils/search-query'
import { useFilters } from '@/hooks/useFilters'
import { formatSize } from '@/utils/formaters'
import {
  DEFAULT_GALLERY_LAYOUT,
  GALLERY_LAYOUTS,
  GALLERY_ZOOM_SIZES,
  groupByDate,
  type DateGroup,
  type GalleryLayout,
  type GalleryPrefs,
} from '@/utils/gallery-layout'

function VideoItem({ src, className }: { src: string; className?: string }) {
  const [poster, setPoster] = useState<string | undefined>(undefined)
  const [hovered, setHovered] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const ref = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    generateVideoThumbnail(src).then((thumb) => {
      if (thumb) setPoster(thumb)
    })
  }, [src])

  const toggle = () => {
    const video = ref.current
    if (!video) return
    if (video.paused) {
      video.play()
      setIsPlaying(true)
    } else {
      video.pause()
      setIsPlaying(false)
    }
  }

  return (
    <div
      className="relative w-full h-full"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <video
        ref={ref}
        src={src}
        poster={poster}
        className={cn(className)}
        preload="metadata"
        disableRemotePlayback
        playsInline
      />
      {hovered && (
        <button
          onClick={toggle}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          className="absolute inset-0 flex items-center justify-center"
        >
          {isPlaying ? (
            <PauseFillIcon className="size-12 drop-shadow-md" />
          ) : (
            <MediaIcon className="size-12 drop-shadow-md" />
          )}
        </button>
      )}
    </div>
  )
}

function GridItem({ item, showVideo }: { item: GalleryImage; showVideo: boolean }) {
  const to = useFileHref(item) ?? '.'
  return (
    <motion.div
      variants={itemVariants}
      initial="hidden"
      animate="show"
      className="w-full h-full aspect-4/3 overflow-hidden"
    >
      {showVideo ? (
        <VideoItem
          src={item.src ?? ''}
          className="rounded-md object-cover w-full h-full"
        />
      ) : (
        <Link to={to} prefetch="intent">
          <ViewTransition name={`img-${item.id}`} default="none" share="auto">
          <motion.img
            data-prefetch="true"
            layoutId={item.id}
            src={item.src ?? undefined}
            alt={item.alt}
            width={item.width}
            height={item.height}
            sizes={item.sizes}
            srcSet={item.srcSet}
            className="rounded-md object-cover w-full h-full cursor-pointer"
            decoding="async"
            loading="lazy"
          />
          </ViewTransition>
        </Link>
      )}
    </motion.div>
  )
}

/** Dashed empty box shared by the gallery pages: drawing, title, line, action. */
function GalleryEmpty({
  media,
  title,
  description,
  children,
}: {
  media: ReactNode
  title: string
  description: string
  children?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-input px-5 py-20 text-center">
      {media}
      <p className="text-base font-medium">{title}</p>
      <p className="max-w-80 text-sm text-muted-foreground">{description}</p>
      {children}
    </div>
  )
}

/** The videos and workspace galleries, unchanged. */
function LegacyGallery({ images, showVideo }: { images: GalleryImage[]; showVideo: boolean }) {
  const [searchParams] = useSearchParams()
  const layoutType = searchParams.get('layout') ?? 'grid'
  const { chips } = useFilters()
  // Only when no filter narrows the list, or "no videos yet" would be false.
  if (showVideo && images.length === 0 && chips.length === 0) {
    return (
      <GalleryEmpty
        media={<EmptyGalleryVideosVector />}
        title="No videos yet"
        description="Upload videos and they show up here."
      />
    )
  }
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      {layoutType === 'waterfall' ? (
        <WaterfallLayout images={images!} />
      ) : layoutType === 'river' ? (
        <RiverView images={images!} />
      ) : (
        <GridLayout>
          {images.map((item) => (
            <GridItem key={item.id} item={item} showVideo={showVideo} />
          ))}
        </GridLayout>
      )}
    </AnimatePresence>
  )
}

function toLayout(value: string | null): GalleryLayout {
  return (GALLERY_LAYOUTS as readonly string[]).includes(value ?? '')
    ? (value as GalleryLayout)
    : DEFAULT_GALLERY_LAYOUT
}

/**
 * The Images page: title row and date groups of positioned tiles. Selection
 * actions show in the app header (`GalleryHeaderTools`). Layout, gap, size, grouping and search
 * are driven from the app header; this reads the same URL params and shared
 * preferences. Opening an image is a navigation to the file page, with the
 * existing `img-${id}` view transition.
 */
function ImagesGallery({ images, now }: { images: GalleryPageImage[]; now: number }) {
  const [searchParams] = useSearchParams()
  const layout = toLayout(searchParams.get('layout'))
  const { prefs } = useGalleryPrefs()
  const filters = useFilters()
  const query = filters.state.query

  // --- search (the header's field) ------------------------------------------
  // The page filters its own tiles by the match set and never pages, so it
  // asks for the whole ranking at once: the server fuses at most RANK_DEPTH
  // ids, and the route refuses a larger page (it answered 400 to `take: 200`).
  const search = useItemSearch({
    query,
    mode: filters.state.searchMode,
    filters: { category: ['image'] },
    take: RANK_DEPTH,
  })
  const matchIds = useMemo(() => new Set(search.items.map((i) => i.id)), [search.items])
  const searching = query.trim().length > 0
  const searchSettled = search.status === 'ready' || search.status === 'error'

  const visible = useMemo(
    () => (searching ? images.filter((img) => matchIds.has(img.id)) : images),
    [images, searching, matchIds]
  )
  const visibleBytes = visible.reduce((sum, img) => sum + img.bytes, 0)

  // Groups are UTC days of `createdAt` against the loader's clock, so the
  // server render, hydration and a client navigation all build the same ones.
  const groups = useMemo(
    () => groupByDate(visible, prefs.byDate, new Date(now)),
    [visible, prefs.byDate, now]
  )

  const orderedIds = useMemo(
    () => groups.flatMap((g) => g.items.map((i) => i.id)),
    [groups]
  )

  return (
    <SelectionProvider items={orderedIds}>
      <div className="flex flex-col gap-4.5 px-4 pt-7 pb-36 sm:px-7">
        {/* Title row */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline gap-2.5">
            <h1 className="text-3xl font-semibold tracking-tighter">Images</h1>
            <span className="text-xs text-muted-foreground tabular-nums">
              {visible.length} of {images.length} · {formatSize('byte', 'unit', visibleBytes)}
            </span>
          </div>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <AIcon aria-hidden className="size-3.5 text-primary" />
            Search by what's in an image, not what it's called.
          </p>
        </div>

        {searching && searchSettled && visible.length > 0 && (
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="inline-flex h-6 items-center gap-1 rounded-md bg-primary/15 px-2 text-xs font-medium text-primary tabular-nums">
              <AIcon aria-hidden className="size-3.5" />
              {visible.length} {visible.length === 1 ? 'match' : 'matches'}
            </span>
            <span>for “{query}” in names, tags and text inside images</span>
          </p>
        )}

        {searching && searchSettled && visible.length === 0 && (
          <GalleryEmpty
            media={<FilteredEmptyVector />}
            title="No images match"
            description="Try describing what's in the picture — people, places, objects or text."
          >
            <Button variant="outline" size="sm" onClick={() => filters.setQuery('')}>
              Clear search
            </Button>
          </GalleryEmpty>
        )}

        {/* Only when nothing narrows the list: under a filter, "no images yet"
            would be false. */}
        {!searching && images.length === 0 && filters.chips.length === 0 && (
          <GalleryEmpty
            media={<EmptyGalleryImagesVector />}
            title="No images yet"
            description="Upload photos or screenshots and they show up here, grouped by date."
          />
        )}

        <GalleryBody groups={groups} layout={layout} gap={prefs.gap} zoom={prefs.zoom} />
      </div>
    </SelectionProvider>
  )
}

/** The date groups, inside `SelectionProvider` so tiles read the selection. */
function GalleryBody({
  groups,
  layout,
  gap,
  zoom,
}: {
  groups: DateGroup<GalleryPageImage>[]
  layout: GalleryLayout
  gap: number
  zoom: number
}) {
  const { selectedIds, onMouseDown, onCheckedChange, unselectAll } = useSelection()
  const selected = useMemo(() => new Set(selectedIds), [selectedIds])
  const selectionMode = selected.size > 0

  const onToggle = useCallback(
    (id: string, checked: boolean) => onCheckedChange(id, checked, 'selectedItems'),
    [onCheckedChange]
  )

  // Esc clears the selection — after any open dialog or menu has had it, and
  // never from inside a text field (the search input clears itself first).
  useEffect(() => {
    if (!selectionMode) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      const target = e.target as HTMLElement | null
      if (target?.closest('input, textarea, [contenteditable="true"]')) return
      if (document.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"]')) return
      unselectAll('selectedItems')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectionMode, unselectAll])

  return (
    // The layout's sizes as CSS variables: the browser does the rest.
    <div
      data-slot="gallery-body"
      style={
        {
          '--gallery-gap': `${gap}px`,
          '--gallery-col': `${GALLERY_ZOOM_SIZES[layout === 'river' ? 'grid' : layout][Math.min(Math.max(zoom, 1), 5) - 1]}px`,
        } as CSSProperties
      }
      className="flex flex-col gap-7"
    >
      {groups.map((group) => (
        <GallerySection
          key={group.key}
          group={group}
          layout={layout}
          zoom={zoom}
          selectedIds={selected}
          selectionMode={selectionMode}
          onToggle={onToggle}
          onMouseDown={onMouseDown}
        />
      ))}
    </div>
  )
}

export const Gallery = ({
  images,
  prefs,
  now,
}: {
  images: GalleryImage[]
  prefs?: GalleryPrefs
  /** The loader's clock (ms), which the Images page groups dates against. */
  now?: number
}) => {
  const location = useLocation()
  const showVideo = location.pathname.includes('videos')
  const isImagesPage = location.pathname.endsWith('/images') && !!prefs

  // Opening an item is a real navigation now (the gallery unmounts), so the
  // list's scroll position must be restored when the user navigates back.
  const containerRef = useRef<HTMLDivElement>(null)
  const getScrollElement = useCallback(
    () =>
      (containerRef.current?.closest(
        '[data-slot="scroll-area-viewport"]'
      ) as HTMLElement | null) ?? null,
    []
  )
  useScrollRestoration(getScrollElement)

  return (
    <div ref={containerRef}>
      {isImagesPage && now !== undefined ? (
        <ImagesGallery images={images as GalleryPageImage[]} now={now} />
      ) : (
        <LegacyGallery images={images} showVideo={showVideo} />
      )}
    </div>
  )
}
