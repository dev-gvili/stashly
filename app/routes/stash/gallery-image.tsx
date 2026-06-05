import type { Route } from './+types/gallery-image'
import * as React from 'react'
import { useNavigate } from 'react-router'
import { redirect } from 'react-router'
import { VisuallyHidden } from 'radix-ui'

import { prisma } from '@/services/db'
import { auth } from '@/.server/auth'
import { getPresignedUrl } from '@/services/s3'
import { defaultItemSelect, touchOpenedAt } from '@/services/item-actions'
import { findManyActivities } from '@/services/activity-actions'
import { formatSize } from '@/utils/formaters'
import { cn } from '@/utils/styles'

import { ActivityFeed } from '@/components/core-components/activity-feed'
import ShareItemFillIcon, {
  RemoveIcon,
  BackIcon,
  FavoriteIcon,
  ShareIcon,
  DownloadIcon,
  LinkIcon,
  CollectionIcon,
  MoreIcon,
  RenameIcon,
  MoveToFolder,
  RefreshIcon,
  TrashIcon,
  InfoIcon,
  ActivityIcon,
  ImageIcon,
  VideoIcon,
  PinIcon,
  FavoritesFillIcon,
  ShareFillIcon,
  MoreFillIcon,
  DropdownIcon,
} from '@/components/icons'

import { Button } from '@/ui/button'
import { Separator } from '@/ui/separator'
import { ScrollArea } from '@/ui/scroll-area'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/ui/tabs'
import { Tooltip } from '@/ui/tooltip'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/ui/dropdown-menu'
import { ItemCategory } from '@/prisma/enums'

/* -------------------------------------------------------------------------- */
/*  Loader                                                                    */
/* -------------------------------------------------------------------------- */

export async function loader({ request, params }: Route.LoaderArgs) {
  const session = await auth.api.getSession(request)
  if (!session) throw redirect('/auth/sign-in')

  const [_, item] = await Promise.all([
    touchOpenedAt(params.itemId),
    prisma.item.findUniqueOrThrow({
      where: { id: params.itemId },
      select: {
        id: true,
        name: true,
        type: true,
        category: true,
        size: true,
        parentId: true,
        createdAt: true,
        updatedAt: true,
        file: { select: { mimeType: true, extension: true, key: true } },
        image: {
          select: {
            width: true,
            height: true,
            cameraMake: true,
            cameraModel: true,
            iso: true,
            fNumber: true,
            exposureTime: true,
            focalLength: true,
            takenDateTime: true,
            latitude: true,
            longitude: true,
          },
        },
        video: {
          select: {
            width: true,
            height: true,
            duration: true,
            frameRate: true,
          },
        },
      },
    }),
  ])

  const fileKey = item.file?.key ?? `${item.parentId}/${item.name}`

  // Sibling media in the same folder — powers prev / next + the "n of N" counter.
  const [fullUrl, activities, siblings] = await Promise.all([
    getPresignedUrl(session.user.bucket, 'get', fileKey, 3600),
    findManyActivities({
      where: { itemId: item.id },
      orderBy: { id: 'desc' },
      take: 20,
    }),
    prisma.item.findMany({
      where: {
        parentId: item.parentId,
        category: { in: [ItemCategory.video, ItemCategory.image] },
      },
      orderBy: { name: 'asc' },
      select: defaultItemSelect,
    }),
  ])

  return { item, fullUrl, activities, siblings }
}

/* -------------------------------------------------------------------------- */
/*  Route component                                                           */
/* -------------------------------------------------------------------------- */

export default function GalleryImageDetail({
  loaderData,
}: Route.ComponentProps) {
  const { item, fullUrl, activities, siblings } = loaderData
  const navigate = useNavigate()

  const isVideo: boolean = item.category === ItemCategory.video
  const [isFavorite, setIsFavorite] = React.useState(false) // wire to item.favorite

  /* ----- sibling navigation ------------------------------------------------ */
  const index = siblings.findIndex((s) => s.id === item.id)
  const total = siblings.length
  const prevId = index > 0 ? siblings[index - 1].id : null
  const nextId = index < total - 1 ? siblings[index + 1].id : null

  const close = React.useCallback(() => navigate(-1), [navigate])
  const goTo = React.useCallback(
    (id: string | null) => {
      // Route is `.../gallery/:itemId`, so the sibling sits one segment up.
      if (id) navigate(`../${id}`, { replace: true, viewTransition: true })
    },
    [navigate]
  )

  /* ----- zoom & pan -------------------------------------------------------- */
  const zoom = useZoomPan()

  /* ----- keyboard ---------------------------------------------------------- */
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goTo(nextId)
      else if (e.key === 'ArrowLeft') goTo(prevId)
      else if (e.key === '+' || e.key === '=') zoom.zoomIn()
      else if (e.key === '-') zoom.zoomOut()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goTo, nextId, prevId, zoom])

  // Reset zoom whenever the displayed media changes.
  React.useEffect(() => zoom.reset(), [item.id]) // eslint-disable-line

  /* ----- derived metadata -------------------------------------------------- */
  const meta = deriveMeta(item)

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent
        showCloseButton={false}
        className="grid grid-cols-[1fr_320px] gap-0 w-screen h-screen max-w-none sm:max-w-none top-0 left-0 translate-x-0 translate-y-0 rounded-none border-0 shadow-none bg-muted/10 p-0"
        style={{ viewTransitionName: 'gallery-overlay' }}
      >
        <VisuallyHidden.Root>
          <DialogTitle>{item.name}</DialogTitle>
          <DialogDescription>
            Media preview, details and activity
          </DialogDescription>
        </VisuallyHidden.Root>

        {/* ===================== Stage ===================== */}
        <div className="relative flex h-full min-w-0 flex-col overflow-hidden">
          {/* slim top bar */}
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-input px-4 py-2.5">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                {isVideo ? (
                  <VideoIcon className="size-4" />
                ) : (
                  <ImageIcon className="size-4" />
                )}
              </span>
              <h1 className="truncate text-sm font-medium">{item.name}</h1>
              {isFavorite && <FavoriteIcon className="size-4 text-primary" />}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium tabular-nums text-muted-foreground">
                {index + 1} of {total}
              </span>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={close}
                aria-label="Close"
                className="rounded-md bg-card border-input"
              >
                <RemoveIcon className="size-5" />
              </Button>
            </div>
          </header>

          {/* media region */}
          <div
            className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-transparent p-6"
            onWheel={zoom.onWheel}
            onMouseDown={zoom.onMouseDown}
            onMouseMove={zoom.onMouseMove}
            onMouseUp={zoom.onMouseUp}
            onMouseLeave={zoom.onMouseUp}
            style={{ cursor: zoom.scale > 1 ? 'grab' : 'default' }}
          >
            {/* floating action toolbar */}
            <div className="pointer-events-none absolute inset-x-0 top-0 z-40 flex justify-center p-4">
              <div className="pointer-events-auto flex items-center gap-0.5 rounded-md border border-input bg-sidebar p-1 shadow-md backdrop-blur-sm">
                <ToolButton
                  label={
                    isFavorite ? 'Remove from Favorites' : 'Add to Favorites'
                  }
                  active={isFavorite}
                  onClick={() => setIsFavorite((v) => !v)}
                >
                  <FavoritesFillIcon className="size-5" />
                </ToolButton>
                <ToolButton label="Share">
                  <ShareFillIcon className="size-5" />
                </ToolButton>
                <ToolButton label="Download" asChild>
                  <a href={fullUrl} download={item.name}>
                    <DownloadIcon className="size-5" />
                  </a>
                </ToolButton>
                <ToolButton
                  label="Copy link"
                  onClick={() =>
                    navigator.clipboard?.writeText(window.location.href)
                  }
                >
                  <LinkIcon className="size-5" />
                </ToolButton>


                <ToolButton label="Add to collection">
                  <CollectionIcon className="size-5" />
                </ToolButton>


                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="rounded-md"
                      aria-label="More"
                    >
                      <MoreFillIcon className="size-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    sideOffset={8}
                    className="w-52"
                  >
                    <DropdownMenuItem>
                      <RenameIcon className="size-4" /> Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <MoveToFolder className="size-4" /> Move to…
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <RefreshIcon className="size-4" /> Rotate 90°
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive">
                      <TrashIcon className="size-4" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* prev / next */}
            {prevId && <EdgeNav side="left" onClick={() => goTo(prevId)} />}
            {nextId && <EdgeNav side="right" onClick={() => goTo(nextId)} />}

            {/* the media */}
            <div className="relative flex h-full w-full items-center justify-center">
              {isVideo ? (
                <video
                  key={item.id}
                  src={fullUrl}
                  controls
                  autoPlay={false}
                  className="max-h-full max-w-full rounded-md border border-input shadow-xl"
                  style={{ viewTransitionName: `img-${item.id}` }}
                />
              ) : (
                <img
                  key={item.id}
                  src={fullUrl}
                  alt={item.name}
                  draggable={false}
                  className="max-h-full max-w-full select-none rounded-md border border-input object-contain shadow-xl transition-transform duration-150"
                  style={{
                    viewTransitionName: `img-${item.id}`,
                    transform: `translate(${zoom.tx}px, ${zoom.ty}px) scale(${zoom.scale})`,
                  }}
                />
              )}
            </div>  
            {/* zoom controls (images only) */}
            {!isVideo && (
              <div className="absolute bottom-5 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-lg border border-border bg-popover/90 p-1 shadow-sm backdrop-blur-sm">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={zoom.zoomOut}
                  disabled={zoom.scale <= 1}
                  aria-label="Zoom out"
                >
                  <ZoomOutGlyph />
                </Button>
                <span className="w-11 text-center text-xs font-medium tabular-nums text-muted-foreground">
                  {Math.round(zoom.scale * 100)}%
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={zoom.zoomIn}
                  disabled={zoom.scale >= 5}
                  aria-label="Zoom in"
                >
                  <ZoomInGlyph />
                </Button>
                <Separator orientation="vertical" className="mx-0.5 h-5" />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={zoom.reset}
                  aria-label="Fit to screen"
                >
                  <FitGlyph />
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* ===================== Info panel ===================== */}
        <aside
          className="flex h-full flex-col border-l border-border bg-card"
          onClick={(e) => e.stopPropagation()}
        >
          <Tabs defaultValue="info" className="flex h-full flex-col gap-0">
            <div className="border-b border-border p-2">
              <TabsList className="w-full">
                <TabsTrigger value="info">
                  <InfoIcon className="size-4" /> Info
                </TabsTrigger>
                <TabsTrigger value="activity">
                  <ActivityIcon className="size-4" /> Activity
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="info" className="min-h-0 flex-1">
              <ScrollArea className="h-full">
                <div className="space-y-8 p-4">
                  {/* Details */}
                  <section>
                    <SectionLabel>Details</SectionLabel>
                    <dl className="space-y-2 text-sm">
                      <Row label="Type" value={item.file?.mimeType} mono />
                      <Row
                        label="Extension"
                        value={
                          item.file?.extension
                            ? `.${item.file.extension}`
                            : null
                        }
                        mono
                      />
                      <Row
                        label="Size"
                        value={
                          item.size
                            ? formatSize('byte', 'unit', Number(item.size))
                            : null
                        }
                      />
                      <Row label="Dimensions" value={meta.dims} mono />
                      {meta.duration && (
                        <Row label="Duration" value={meta.duration} mono />
                      )}
                      <Row label="Taken" value={meta.taken} />
                      <Row label="Added" value={fmtDate(item.createdAt)} />
                      <Row label="Modified" value={fmtDate(item.updatedAt)} />
                    </dl>
                  </section>

                  {/* Camera (merged into Info) */}
                  {meta.hasCamera && (
                    <section>
                      <SectionLabel icon={<ImageIcon className="size-3.5" />}>
                        Camera
                      </SectionLabel>
                      <dl className="space-y-2 text-sm">
                        <Row label="Camera" value={meta.camera} />
                        <Row label="Aperture" value={meta.aperture} mono />
                        <Row label="ISO" value={meta.iso} mono />
                        <Row label="Shutter" value={meta.shutter} mono />
                        <Row label="Focal length" value={meta.focal} mono />
                        <Row label="GPS" value={meta.gps} mono />
                      </dl>

                      {meta.gps && (
                        <div className="mt-3 overflow-hidden rounded-lg border border-border">
                          <div className="flex items-center gap-1.5 border-b border-border bg-muted/60 px-3 py-2 text-xs font-medium text-muted-foreground">
                            <PinIcon className="size-3.5" /> Location
                          </div>
                          <MiniMap />
                          <div className="px-3 py-2 font-stashly text-[11px] text-muted-foreground">
                            {meta.gps}
                          </div>
                        </div>
                      )}
                    </section>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="activity" className="min-h-0 flex-1">
              <ScrollArea className="h-full">
                <div className="p-4">
                  <ActivityFeed activities={activities} />
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </aside>
      </DialogContent>
    </Dialog>
  )
}

/* -------------------------------------------------------------------------- */
/*  Pieces                                                                    */
/* -------------------------------------------------------------------------- */

function ToolButton({
  label,
  children,
  onClick,
  active,
  asChild,
}: {
  label: string
  children: React.ReactNode
  onClick?: () => void
  active?: boolean
  asChild?: boolean
}) {
  return (
    <Tooltip content={label} >
      <Button
        variant="ghost"
        size="icon-sm"
        asChild={asChild}
        onClick={onClick}
        aria-label={label}
        aria-pressed={active}
        className={cn(
          'hover:bg-transparent data-[state=open]:bg-transparent',
          active && 'text-primary!!'
        )}
      >
        {children}
      </Button>
    </Tooltip>
  )
}

function EdgeNav({
  side,
  onClick,
}: {
  side: 'left' | 'right'
  onClick: () => void
}) {
  return (
    <Button
      variant="outline"
      size="icon"
      onClick={onClick}
      aria-label={side === 'left' ? 'Previous' : 'Next'}
      className={cn(
        'absolute top-1/2 z-20 size-10 -translate-y-1/2 rounded-md  backdrop-blur-sm transition-all hover:scale-105 hover:opacity-100',
        side === 'left' ? 'left-4' : 'right-4'
      )}
    >
      <DropdownIcon className={cn('size-5', side === 'right' && '-rotate-90', side === 'left' && 'rotate-90')} />
    </Button>
  )
}

function SectionLabel({
  children,
  icon,
}: {
  children: React.ReactNode
  icon?: React.ReactNode
}) {
  return (
    <h3 className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      {icon}
      {children}
    </h3>
  )
}

function Row({
  label,
  value,
  mono,
}: {
  label: string
  value: string | null | undefined
  mono?: boolean
}) {
  if (!value) return null
  return (
    <div className="flex justify-between gap-4">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className={cn('truncate text-right text-xs', mono && 'font-stashly')}>
        {value}
      </dd>
    </div>
  )
}

/** Abstract location tile — swap for a real map embed when available. */
function MiniMap() {
  return (
    <div className="relative h-28 bg-muted">
      <svg
        className="h-full w-full text-border"
        preserveAspectRatio="none"
        viewBox="0 0 200 100"
        aria-hidden
      >
        <defs>
          <pattern
            id="map-grid"
            width="14"
            height="14"
            patternUnits="userSpaceOnUse"
          >
            <path d="M0 7h14M7 0v14" stroke="currentColor" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="200" height="100" fill="url(#map-grid)" />
        <path
          d="M0 60 Q60 40 120 58 T200 50"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          opacity="0.6"
        />
      </svg>
      <PinIcon className="absolute left-1/2 top-1/2 size-6 -translate-x-1/2 -translate-y-full text-primary" />
    </div>
  )
}

/* zoom glyphs — Stash has no magnifier icon, so these are local 1.6-stroke SVGs */
const ZoomInGlyph = () => (
  <svg
    viewBox="0 0 24 24"
    className="size-5"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3-3M11 8v6M8 11h6" />
  </svg>
)
const ZoomOutGlyph = () => (
  <svg
    viewBox="0 0 24 24"
    className="size-5"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3-3M8 11h6" />
  </svg>
)
const FitGlyph = () => (
  <svg
    viewBox="0 0 24 24"
    className="size-5"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3" />
  </svg>
)

/* -------------------------------------------------------------------------- */
/*  Hooks & helpers                                                           */
/* -------------------------------------------------------------------------- */

function useZoomPan() {
  const [scale, setScale] = React.useState(1)
  const [tx, setTx] = React.useState(0)
  const [ty, setTy] = React.useState(0)
  const drag = React.useRef<{ x: number; y: number } | null>(null)

  const reset = React.useCallback(() => {
    setScale(1)
    setTx(0)
    setTy(0)
  }, [])

  const zoomTo = React.useCallback((next: number) => {
    const s = Math.min(5, Math.max(1, next))
    setScale(s)
    if (s === 1) {
      setTx(0)
      setTy(0)
    }
  }, [])

  return {
    scale,
    tx,
    ty,
    reset,
    zoomIn: () => zoomTo(scale + 0.5),
    zoomOut: () => zoomTo(scale - 0.5),
    onWheel: (e: React.WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      zoomTo(scale - e.deltaY * 0.01)
    },
    onMouseDown: (e: React.MouseEvent) => {
      if (scale === 1) return
      drag.current = { x: e.clientX - tx, y: e.clientY - ty }
    },
    onMouseMove: (e: React.MouseEvent) => {
      if (!drag.current) return
      setTx(e.clientX - drag.current.x)
      setTy(e.clientY - drag.current.y)
    },
    onMouseUp: () => {
      drag.current = null
    },
  }
}

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function deriveMeta(item: Awaited<ReturnType<typeof loader>>['item']) {
  const img = item.image
  const vid = item.video

  const dims =
    img?.width && img?.height
      ? `${img.width} × ${img.height}`
      : vid?.width && vid?.height
        ? `${vid.width} × ${vid.height}`
        : null

  const camera =
    img?.cameraMake || img?.cameraModel
      ? [img.cameraMake, img.cameraModel].filter(Boolean).join(' ')
      : null

  const shutter =
    img?.exposureTime != null
      ? img.exposureTime < 1
        ? `1/${Math.round(1 / img.exposureTime)}s`
        : `${img.exposureTime}s`
      : null

  const aperture = img?.fNumber != null ? `f/${img.fNumber}` : null
  const iso = img?.iso != null ? `ISO ${img.iso}` : null
  const focal = img?.focalLength != null ? `${img.focalLength}mm` : null
  const taken = img?.takenDateTime ? fmtDate(img.takenDateTime) : null
  const gps =
    img?.latitude != null && img?.longitude != null
      ? `${img.latitude.toFixed(5)}, ${img.longitude.toFixed(5)}`
      : null
  const duration =
    vid?.duration != null
      ? `${Math.floor(vid.duration / 60)}:${String(Math.round(vid.duration % 60)).padStart(2, '0')}`
      : null

  return {
    dims,
    camera,
    aperture,
    iso,
    shutter,
    focal,
    taken,
    gps,
    duration,
    hasCamera: Boolean(camera || aperture || iso || shutter || focal || gps),
  }
}
