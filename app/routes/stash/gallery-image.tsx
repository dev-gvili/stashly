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

export async function loader({ request, params }: Route.LoaderArgs) {
  const session = await auth.api.getSession(request)
  if (!session) throw redirect('/auth/sign-in')

  const item = await prisma.item.findUniqueOrThrow({
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

  Promise.resolve().then(() => touchOpenedAt(params.itemId)).catch(() => {})

  const fileKey = item.file?.key ?? `${item.parentId}/${item.name}`
  const fullUrl = await getPresignedUrl(session.user.bucket, 'get', fileKey, 3600)

  const activities = await findManyActivities({
    where: { itemId: item.id },
    orderBy: { id: 'desc' },
    take: 20,
  })

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
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/75"
        style={{ viewTransitionName: 'gallery-overlay' }}
        onClick={() => navigate(-1)}
      />

      <div className="relative flex h-full">
        {/* Left: image — 75% */}
        <div
          className="flex flex-3 items-center justify-center p-8"
          onClick={(e) => e.stopPropagation()}
        >
          <img
            src={fullUrl}
            alt={item.name}
            style={{ viewTransitionName: `img-${item.id}` }}
            className="max-h-full max-w-full rounded-xl object-contain shadow-2xl"
          />
        </div>

        {/* Right: sidebar — 25% */}
        <div
          className="flex flex-1 flex-col overflow-y-auto border-l bg-background"
          style={{ viewTransitionName: 'gallery-sidebar' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <button
              onClick={() => navigate(-1)}
              className="rounded-md p-1 hover:bg-accent"
              aria-label="Close"
            >
              <BackIcon className="size-4" />
            </button>
            <p className="flex-1 truncate text-sm font-medium">{item.name}</p>
          </div>

          <div className="flex-1 space-y-6 p-4">
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
            )}

            <section>
              <h3 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Activity
              </h3>
              <ActivityFeed activities={activities} />
            </section>
          </div>
        </div>
      </div>
    </div>
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
          mono ? 'truncate font-mono text-xs' : 'truncate text-xs text-right'
        }
      >
        {value}
      </dd>
    </div>
  )
}
