import type { Route } from './+types/gallery-image'
import * as React from 'react'
import { href, useFetcher, useNavigate, Link } from 'react-router'
import { redirect } from 'react-router'
import { VisuallyHidden } from 'radix-ui'

import { prisma } from '@/services/db'
import { auth } from '@/.server/auth'
import { getPresignedUrl } from '@/services/s3'
import { defaultItemSelect, touchOpenedAt } from '@/services/item-actions'
import {
  searchActivities,
} from '@/services/activity-actions'
import { breadcrumbs as getBreadcrumbs } from '@/services/breadcrumbs'
import type { Breadcrumb } from '@/services/breadcrumbs'
import { formatSize } from '@/utils/formaters'
import { cn } from '@/utils/styles'

import { ActivityFeed } from '@/components/core-components/activity-feed'
import {
  ShareItemFillIcon,
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
  ZoomOutFillIcon,
  ZoomInFillIcon,
  MinimizeFillIcon,
  VideoFillIcon,
  ImageFillIcon,
  DownloadFillIcon,
  CollectionFillIcon,
  MoreMenuFillIcon,
  MoveFillIcon,
  RenameFillIcon,
  TrashFillIcon,
  HeartIcon,
} from '@/components/icons'

import { Button } from '@/ui/button'
import { Badge } from '@/ui/badge'
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
import { useZoom } from '../../hooks/useZoom'
import { useClipboard } from '@/hooks/useClipboard'
import { ShareDialog } from '@/components/core-components/share-dialog'
import { RenameDialog } from '@/components/core-components/rename-dialog'

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
        memberOfCollections: {
          select: { collection: { select: { id: true, name: true } } },
        },
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
  const [fullUrl, acts, siblings, path] = await Promise.all([
    getPresignedUrl(session.user.bucket, 'get', fileKey, 3600),
    // findManyActivities({
    //   where: { itemId: item.id },
    //   orderBy: { time: { observedAt: 'desc' } },
    //   take: 20,
    // }),
    await searchActivities({
      itemId: { equals: item.id },
      take: 20,
      include: {
        time: true,
        item: true,
        action: {
          include: {
            create: true,
            rename: true,
            move: true,
            delete: true,
            restore: true,
            copy: true,
            share: true,
            version: true,
            comment: true,
            permission: true,
            upload: true,
            pin: true,
            edit: true,
            collection: true,
            favorite: true,
            bucket: true,
          },
        },
        access: true,
      },
      cursor: new URL(request.url)?.searchParams?.get('cursor') || '',
      orderBy: { time: { observedAt: 'desc' } },
      strategy: 'cursor',
    }),

    prisma.item.findMany({
      where: {
        parentId: item.parentId,
        category: { in: [ItemCategory.video, ItemCategory.image] },
      },
      orderBy: { name: 'asc' },
      select: defaultItemSelect,
    }),
    item.parentId ? getBreadcrumbs(item.parentId) : Promise.resolve([]),
  ])

  return { item, fullUrl, activities: acts.data, siblings, path }
}

/* -------------------------------------------------------------------------- */
/*  Route component                                                           */
/* -------------------------------------------------------------------------- */

export default function GalleryImageDetail({
  loaderData,
  params,
}: Route.ComponentProps) {
  const { item, fullUrl, activities, siblings, path } = loaderData
  const { me } = params
  const navigate = useNavigate()
  const fetcher = useFetcher()
  const isVideo: boolean = item.category === ItemCategory.video
  const [isFavorite, setIsFavorite] = React.useState(false) // wire to item.favorite
  const [open, setOpen] = React.useState(false) // share dialog
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

  /* ----- download ---------------------------------------------------------- */
  const [isDownloading, setIsDownloading] = React.useState(false)
  const handleDownload = React.useCallback(async () => {
    if (isDownloading) return
    setIsDownloading(true)
    try {
      const res = await fetch(fullUrl)
      const blob = await res.blob()
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = item.name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(objectUrl)
    } finally {
      setIsDownloading(false)
    }
  }, [fullUrl, item.name, isDownloading])

  /* ----- zoom & pan -------------------------------------------------------- */
  const zoom = useZoom()

  /* ----- clipboard --------------------------------------------------------- */
  const { copy: copyLink, copied: linkCopied } = useClipboard()

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
                  <VideoFillIcon className="size-5" />
                ) : (
                  <ImageFillIcon className="size-5" />
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
              <div className="pointer-events-auto flex items-center gap-0.5 rounded-md border border-input bg-sidebar p-1 shadow-stashly backdrop-blur-sm">
                <ToolButton
                  label={
                    isFavorite ? 'Remove from Favorites' : 'Add to Favorites'
                  }
                  active={isFavorite}
                  onClick={() => setIsFavorite((v) => !v)}
                >
                  <HeartIcon
                    className={cn(
                      'size-5',
                      isFavorite && 'fill-primary text-primary'
                    )}
                  />
                </ToolButton>
                <ToolButton label="Share" onClick={() => setOpen(true)}>
                  <ShareFillIcon className="size-5" />
                  <ShareDialog
                    open={open}
                    onOpenChange={setOpen}
                    itemId={item.id}
                    itemName={item.name}
                    itemType={item.type}
                  />
                </ToolButton>
                <ToolButton
                  label="Download"
                  onClick={handleDownload}
                  disabled={isDownloading}
                >
                  <DownloadFillIcon className="size-5" />
                </ToolButton>
                <ToolButton
                  label={linkCopied ? 'Copied!' : 'Copy link'}
                  onClick={() => copyLink(fullUrl)}
                >
                  <LinkIcon className="size-5" />
                </ToolButton>

                <ToolButton label="Add to collection">
                  <CollectionFillIcon className="size-5" />
                </ToolButton>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="rounded-md hover:bg-transparent data-[state=open]:bg-transparent data-[state=open]:text-accent-foreground "
                      aria-label="More"
                    >
                      <MoreMenuFillIcon className="size-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    sideOffset={8}
                    alignOffset={-3}
                    className="w-52 rounded-md border border-input bg-sidebar shadow-stashly"
                  >
                    <RenameDialog
                      defaultName={item.name}
                      intent="rename_item"
                      extraData={{ itemId: item.id }}
                      action="/api/items"
                      title="Rename item"
                    >
                      <DropdownMenuItem
                        className="hover:bg-transparent!"
                        onSelect={(e) => e.preventDefault()}
                      >
                        <RenameFillIcon className="text-current" /> Rename
                      </DropdownMenuItem>
                    </RenameDialog>
                    <DropdownMenuItem className="hover:bg-transparent!">
                      <MoveFillIcon className=" text-current" /> Move
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        fetcher.submit(
                          { intent: 'trash_item', selectedItem: item.id },
                          { method: 'POST', action: href('/api/items') }
                        )
                      }}
                    >
                      <TrashFillIcon /> Trash
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
                  onWheel={zoom.onWheel}
                />
              )}
            </div>
            {/* zoom controls (images only) */}
            {!isVideo && (
              <div className="absolute bottom-2 left-1/2 z-30 flex -translate-x-1/2 pointer-events-auto items-center gap-0.5 rounded-md border border-input bg-sidebar p-1 shadow-stashly backdrop-blur-sm">
                <ToolButton
                  label="Zoom out"
                  onClick={zoom.zoomOut}
                  disabled={zoom.scale <= 1}
                  aria-label="Zoom out"
                  active={false}
                >
                  <ZoomOutFillIcon />
                </ToolButton>
                <span className="w-11 text-center text-xs font-medium tabular-nums text-muted-foreground">
                  {Math.round(zoom.scale * 100)}%
                </span>

                <ToolButton
                  label="Zoom in"
                  onClick={zoom.zoomIn}
                  disabled={zoom.scale >= 5}
                  aria-label="Zoom in"
                  active={false}
                >
                  <ZoomInFillIcon className="size-5 text-current" />
                </ToolButton>
                <ToolButton
                  label="Reset zoom"
                  onClick={zoom.reset}
                  disabled={zoom.scale === 1}
                  aria-label="Reset zoom"
                  active={false}
                >
                  <MinimizeFillIcon />
                </ToolButton>
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

                  {/* Location */}
                  <section>
                    <SectionLabel>Location</SectionLabel>
                    <PathDisplay crumbs={path} me={me} />
                  </section>

                  {/* Collections */}
                  {item.memberOfCollections.length > 0 && (
                    <section>
                      <SectionLabel
                        icon={<CollectionFillIcon className="size-5" />}
                      >
                        Collections
                      </SectionLabel>
                      <div className="flex flex-wrap gap-1.5">
                        {item.memberOfCollections.map(({ collection }) => (
                          <Badge
                            key={collection.id}
                            variant="default"
                            className="rounded!"
                            asChild
                          >
                            <Link
                              to={`${href(
                                '/:me/stash/collections/:collectionId',
                                { me, collectionId: collection.id }
                              )}?layout=grid`}
                              className="font-stashly"
                            >
                              {collection.name}
                            </Link>
                          </Badge>
                        ))}
                      </div>
                    </section>
                  )}

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

            <TabsContent value="activity" className=" flex-1">
              <ScrollArea className="h-[calc(100vh-4rem)]">
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
  disabled,
  asChild,
}: {
  label: string
  children: React.ReactNode
  onClick?: () => void
  active?: boolean
  disabled?: boolean
  asChild?: boolean
}) {
  return (
    <Tooltip
      content={label}
      side="bottom"
      align="center"
      aria-disabled={disabled}
      asChild
    >
      <Button
        variant="ghost"
        size="icon-sm"
        asChild={asChild}
        onClick={onClick}
        disabled={disabled}
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
      <DropdownIcon
        className={cn(
          'size-5',
          side === 'right' && '-rotate-90',
          side === 'left' && 'rotate-90'
        )}
      />
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

function PathDisplay({ crumbs, me }: { crumbs: Breadcrumb[]; me: string }) {
  if (crumbs.length === 0) {
    return (
      <Link
        to={href('/:me/stash/all', { me })}
        className="text-xs font-stashly text-foreground hover:text-primary transition-colors"
      >
        Home
      </Link>
    )
  }
  return (
    <div className="flex flex-wrap items-center gap-1 text-xs font-stashly">
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1
        const to =
          crumb.name === 'root'
            ? href('/:me/stash/all', { me })
            : href('/:me/stash/folders/:folderId', { me, folderId: crumb.id })
        return (
          <React.Fragment key={crumb.id}>
            <Link
              to={`${to}?layout=grid&take=50`}
              className="shrink-0 text-foreground hover:text-primary transition-colors"
            >
              {crumb.name === 'root' ? 'Home' : crumb.name}
            </Link>
            {!isLast && (
              <span className="select-none text-muted-foreground">/</span>
            )}
          </React.Fragment>
        )
      })}
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
