import type { Route } from './+types/gallery-image'
import { useNavigate } from 'react-router'
import { prisma } from '@/services/db'
import { auth } from '@/.server/auth'
import { redirect } from 'react-router'
import { BackIcon, InfoIcon } from '@/components/icons'
import { formatSize } from '@/utils/formaters'
import { findManyActivities } from '@/services/activity-actions'
import { ActivityFeed } from '@/components/core-components/activity-feed'
import { getPresignedUrl } from '@/services/s3'
import { touchOpenedAt } from '@/services/item-actions'
import { Button } from '@/ui/button'
import { Separator } from '@/ui/separator'
import { ScrollArea } from '@/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/ui/dialog'
import { VisuallyHidden } from 'radix-ui'

export async function loader({ request, params }: Route.LoaderArgs) {
  const session = await auth.api.getSession(request)
  if (!session) throw redirect('/auth/sign-in')

  const [_,item] = await Promise.all([
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
        file: {
          select: { mimeType: true, extension: true, key: true },
        },
        thumbnails: {
          where: { NOT: { url: { startsWith: '#' } } },
          orderBy: { stage: 'desc' },
          take: 1,
          select: { url: true, width: true, height: true, stage: true, id: true },
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
          select: { width: true, height: true, duration: true, frameRate: true },
        },
      },
    })
  ])

  const fileKey = item.file?.key ?? `${item.parentId}/${item.name}`
  const [fullUrl, activities] = await Promise.all([
    getPresignedUrl(session.user.bucket, 'get', fileKey, 3600),
    findManyActivities({
      where: { itemId: item.id },
      orderBy: { id: 'desc' },
      take: 20,
    }),
  ])

  return { item, fullUrl, activities }
}

export default function GalleryImageDetail({
  loaderData,
}: Route.ComponentProps) {
  const { item, fullUrl, activities } = loaderData
  const navigate = useNavigate()

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

  const exposure = img?.fNumber != null ? `f/${img.fNumber}` : null
  const isoVal = img?.iso != null ? `ISO ${img.iso}` : null
  const shutterVal =
    img?.exposureTime != null
      ? img.exposureTime < 1
        ? `1/${Math.round(1 / img.exposureTime)}s`
        : `${img.exposureTime}s`
      : null
  const focalVal = img?.focalLength != null ? `${img.focalLength}mm` : null
  const takenVal = img?.takenDateTime
    ? new Date(img.takenDateTime).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : null
  const gpsVal =
    img?.latitude != null && img?.longitude != null
      ? `${img.latitude.toFixed(5)}, ${img.longitude.toFixed(5)}`
      : null
  const durationVal =
    vid?.duration != null
      ? `${Math.floor(vid.duration / 60)}:${String(Math.round(vid.duration % 60)).padStart(2, '0')}`
      : null

  return (
    <Dialog open onOpenChange={(open) => !open && navigate(-1)} >
      <DialogContent
        showCloseButton={false}
        className="grid grid-cols-[5fr_1fr] gap-0 p-0 w-screen h-screen max-w-none sm:max-w-none top-0 left-0 translate-x-0 translate-y-0 rounded-none border-0 shadow-none bg-transparent backdrop-blur-sm"
        style={{ viewTransitionName: 'gallery-overlay' }}
      >
        <VisuallyHidden.Root>
          <DialogTitle>{item.name}</DialogTitle>
          <DialogDescription>Image preview and details</DialogDescription>
        </VisuallyHidden.Root>

        {/* Left: image — 75% */}
        <div className="@container flex items-center justify-center p-4 overflow-hidden bg-transparent" >
          <img
            src={fullUrl}
            alt={item.name}
            style={{
              viewTransitionName: `img-${item.id}`,
            }}
            className="@landscape:max-h-full @landscape:w-full @portrait:h-full @portrait:max-w-full rounded-xl shadow-stashly @min-lg:max-w-[90%] @min-lg:max-h-[90%] object-contain"
          />
        </div>

        {/* Right: sidebar — 25% */}
        <aside
          className="flex flex-col max-w-80 place-self-stretch  bg-background"
          style={{ viewTransitionName: 'gallery-sidebar' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <header className="flex items-center gap-2 px-4 py-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              aria-label="Close"
            >
              <BackIcon className="size-5" />
            </Button>
            <p className="flex-1 truncate text-sm font-medium">{item.name}</p>
          </header>
          <Separator />

          <ScrollArea className="flex-1">
            <div className="space-y-6 p-4">
              {/* File info */}
              <section>
                <h3 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <InfoIcon className="size-3.5" />
                  Details
                </h3>
                <dl className="space-y-2 text-sm">
                  <Row label="Type" value={item.file?.mimeType} mono />
                  <Row
                    label="Extension"
                    value={
                      item.file?.extension ? `.${item.file.extension}` : null
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
                  <Row label="Dimensions" value={dims} mono />
                  {durationVal && (
                    <Row label="Duration" value={durationVal} mono />
                  )}
                  <Row label="Taken" value={takenVal} />
                  <Row
                    label="Added"
                    value={new Date(item.createdAt).toLocaleDateString(
                      undefined,
                      {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      }
                    )}
                  />
                  <Row
                    label="Modified"
                    value={new Date(item.updatedAt).toLocaleDateString(
                      undefined,
                      {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      }
                    )}
                  />
                </dl>
              </section>

              {(camera ||
                exposure ||
                isoVal ||
                shutterVal ||
                focalVal ||
                gpsVal) && (
                <>
                  <Separator />
                  <section>
                    <h3 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Camera
                    </h3>
                    <dl className="space-y-2 text-sm">
                      <Row label="Camera" value={camera} />
                      <Row label="Aperture" value={exposure} mono />
                      <Row label="ISO" value={isoVal} mono />
                      <Row label="Shutter" value={shutterVal} mono />
                      <Row label="Focal length" value={focalVal} mono />
                      <Row label="GPS" value={gpsVal} mono />
                    </dl>
                  </section>
                </>
              )}

              <Separator />
              <section>
                <h3 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Activity
                </h3>
                <ActivityFeed activities={activities} />
              </section>
            </div>
          </ScrollArea>
        </aside>
      </DialogContent>
    </Dialog>
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
      <dd
        className={
          mono ? 'truncate font-stashly text-xs' : 'truncate text-xs text-right'
        }
      >
        {value}
      </dd>
    </div>
  )
}
