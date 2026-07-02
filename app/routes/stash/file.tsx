import type { Route } from './+types/file'
import { redirect, type ShouldRevalidateFunction } from 'react-router'
import { auth } from '@/services/auth'
import { getFileItem, touchOpenedAt } from '@/services/item-actions'
import { breadcrumbs } from '@/services/breadcrumbs'
import { getPresignedUrl } from '@/services/s3'
import { AudioStage } from '@/components/views/item-page/audio-stage'
import { PdfStage } from '@/components/views/item-page/pdf-stage'
import { MarkdownStage } from '@/components/views/item-page/markdown-stage'
import { VideoStage } from '@/components/views/item-page/video-stage'
import { ImageStage } from '@/components/views/item-page/image-stage'
import { ItemPanel } from '@/components/views/item-page/item-panel'
import { isMarkdownName } from '@/utils/markdown'
import { searchActivities } from '@/.server/activity-actions'
import { useEffect } from 'react'
import { useSearchParams } from 'react-router'

export {ErrorBoundary} from '@/components/error-boundary'
export const shouldRevalidate: ShouldRevalidateFunction = ({
  formAction,
  defaultShouldRevalidate,
}) => {
  if (
    formAction &&
    ['favorites', 'sidebar', 'theme'].some((action) =>
      formAction.includes(action)
    )
  ) {
    return false
  }

  return defaultShouldRevalidate
}
export async function loader({ request, params }: Route.LoaderArgs) {
    const session = await auth.api.getSession({
    headers: request.headers,
  })
  if (!session) throw redirect('/auth/sign-in')

  const [, allCrumbs, acts, item] = await Promise.all([
    touchOpenedAt(params.fileId),
    breadcrumbs(params.fileId),
    searchActivities({
      ownerId: {equals: session.user.id},
      itemId: { equals: params.fileId },
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
    getFileItem(session.user.id, params.fileId, params.folderId),
  ])

  const crumbs =
    item.ownerId === session.user.id ? allCrumbs : allCrumbs.slice(-1)

  const isAudio =
    item.audio != null || item.file?.mimeType?.startsWith('audio/')
  const isVideo =
    item.video != null || item.file?.mimeType?.startsWith('video/')
  const isPdf = item.pdf != null || item.file?.mimeType === 'application/pdf'
  const isMarkdown =
    item.markdown != null || isMarkdownName(item.name, item.file?.mimeType)
  const isImage =
    item.image != null || item.file?.mimeType?.startsWith('image/')
  const mediaSrc =
    (isAudio || isVideo || isPdf || isMarkdown || isImage) && item.file?.key
      ? await getPresignedUrl(item.file.bucket, 'get', item.file.key, 3600)
      : null

  return { item, crumbs, activities: acts.data, mediaSrc }
}

export async function action({ request, params }: Route.ActionArgs) {
  return null
}

export default function FilePage({ loaderData }: Route.ComponentProps) {
  const { item, mediaSrc, activities } = loaderData
  const isAudio =
    item.audio != null || item.file?.mimeType?.startsWith('audio/')
  const isVideo =
    item.video != null || item.file?.mimeType?.startsWith('video/')
  const isPdf = item.pdf != null || item.file?.mimeType === 'application/pdf'
  const isMarkdown =
    item.markdown != null || isMarkdownName(item.name, item.file?.mimeType)
  const isImage =
    item.image != null || item.file?.mimeType?.startsWith('image/')

  const panelItem = {
    activities: activities,
    id: item.id,
    name: item.name,
    size: item.size,
    category: item.category,
    url: mediaSrc ?? '',
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    openedAt: item.openedAt,
    status: item.status,
    file: item.file
      ? {
          mimeType: item.file.mimeType ?? null,
          extension: item.file.extension ?? null,
        }
      : null,
    audio: item.audio
      ? {
          title: item.audio.title,
          artist: item.audio.artist,
          album: item.audio.album,
          albumArtist: item.audio.albumArtist,
          track: item.audio.track,
          trackCount: item.audio.trackCount,
          duration: item.audio.duration,
          bitrate: item.audio.bitrate,
        }
      : null,
    pdf: item.pdf
      ? {
          pageCount: item.pdf.pageCount,
          title: item.pdf.title,
          author: item.pdf.author,
          subject: item.pdf.subject,
          creator: item.pdf.creator,
          producer: item.pdf.producer,
          pdfVersion: item.pdf.pdfVersion,
          language: item.pdf.language,
          hasFormFields: item.pdf.hasFormFields,
          hasSignatures: item.pdf.hasSignatures,
          pageWidth: item.pdf.pageWidth,
          pageHeight: item.pdf.pageHeight,
          docCreatedAt: item.pdf.docCreatedAt,
          docModifiedAt: item.pdf.docModifiedAt,
        }
      : null,
    markdown: item.markdown
      ? {
          title: item.markdown.title,
          author: item.markdown.author,
          description: item.markdown.description,
          tags: item.markdown.tags,
          wordCount: item.markdown.wordCount,
          readingTime: item.markdown.readingTime,
          headingCount: item.markdown.headingCount,
          linkCount: item.markdown.linkCount,
          imageCount: item.markdown.imageCount,
          codeBlockCount: item.markdown.codeBlockCount,
          taskCount: item.markdown.taskCount,
          hasFrontmatter: item.markdown.hasFrontmatter,
          docCreatedAt: item.markdown.docCreatedAt,
          docModifiedAt: item.markdown.docModifiedAt,
        }
      : null,
    video: item.video
      ? {
          width: item.video.width,
          height: item.video.height,
          duration: item.video.duration,
          bitrate: item.video.bitrate,
          codec: item.video.codec,
          container: item.video.container,
          frameRate: item.video.frameRate,
        }
      : null,
    image: item.image
      ? {
          width: item.image.width,
          height: item.image.height,
          horizontalResolution: item.image.horizontalResolution,
          verticalResolution: item.image.verticalResolution,
          bitDepth: item.image.bitDepth,
          cameraMake: item.image.cameraMake,
          cameraModel: item.image.cameraModel,
          iso: item.image.iso,
          fNumber: item.image.fNumber,
          exposureTime: item.image.exposureTime,
          focalLength: item.image.focalLength,
          takenDateTime: item.image.takenDateTime,
          latitude: item.image.latitude,
          longitude: item.image.longitude,
        }
      : null,
    favorites: item.favorites.map((f) => ({
      favoritedBy: {
        id: f.favoritedBy.id,
        name: f.favoritedBy.name,
        image: f.favoritedBy.image,
      },
    })),
    permissions: item.permissions.map((p) => ({
      roles: p.roles,
      users: p.users.map((u) => ({
        id: u.id,
        name: u.name,
        image: u.image,
      })),
    })),
  }

  if (isPdf) {
    return (
      // Viewport-pinned (like ItemPanel's h-[calc(100vh-4rem)] top-14): the
      // document itself must not scroll — scrolling happens inside the stage,
      // so the thumbnail rail and floating toolbar stay put.
      // minmax(0,1fr): a bare 1fr track has min-width auto, so wide zoomed
      // pages would grow the track (and the measured stage width) instead of
      // scrolling — which feeds back into the fit-width scale and runs away.
      <div className="absolute inset-0 grid h-screen min-h-0 w-full grid-cols-[minmax(0,1fr)_auto]">
        {/* Stage */}
        <PdfStage
          key={item.id}
          src={mediaSrc ?? ''}
          item={{
            id: item.id,
            name: item.name,
            pdf: item.pdf
              ? { title: item.pdf.title, pageCount: item.pdf.pageCount }
              : null,
          }}
        />

        {/* Details panel */}
        <ItemPanel item={panelItem} />
      </div>
    )
  }

  if (isMarkdown) {
    return (
      <div className="absolute inset-0 grid h-screen min-h-0 w-full grid-cols-[minmax(0,1fr)_auto] gap-2 pb-10">
        {/* Stage */}
        <MarkdownStage
          key={item.id}
          src={mediaSrc ?? ''}
          item={{
            id: item.id,
            name: item.name,
            markdown: item.markdown
              ? {
                  title: item.markdown.title,
                  headingCount: item.markdown.headingCount,
                }
              : null,
          }}
        />

        {/* Details panel */}
        <ItemPanel item={panelItem} />
      </div>
    )
  }

  if (isImage) {
    return (
      <div className="absolute inset-0 grid h-screen min-h-0 w-full grid-cols-[minmax(0,1fr)_auto]">
        {/* Stage */}
        <ImageStage
          key={item.id}
          src={mediaSrc ?? ''}
          item={{
            id: item.id,
            name: item.name,
            image: item.image
              ? { width: item.image.width, height: item.image.height }
              : null,
          }}
        />

        {/* Details panel */}
        <ItemPanel item={panelItem} />
      </div>
    )
  }

  if (isVideo) {
    return (
      <div className="absolute inset-0 grid h-screen min-h-0 w-full grid-cols-[minmax(0,1fr)_auto]">
        {/* Stage */}
        <VideoStage
          key={item.id}
          src={mediaSrc ?? ''}
          item={{
            id: item.id,
            name: item.name,
            thumbnails: item.thumbnails,
            video: item.video
              ? {
                  width: item.video.width,
                  height: item.video.height,
                  duration: item.video.duration,
                }
              : null,
          }}
        />

        {/* Details panel */}
        <ItemPanel item={panelItem} />
      </div>
    )
  }

  if (isAudio) {
    return (
      <div className="absolute inset-0 grid h-screen min-h-0 w-full grid-cols-[minmax(0,1fr)_auto]">
        {/* Stage */}
        <AudioStage
          key={item.id}
          src={mediaSrc ?? ''}
          item={{
            id: item.id,
            name: item.name,
            thumbnails: item.thumbnails,
            audio: item.audio
              ? {
                  title: item.audio.title,
                  artist: item.audio.artist,
                  album: item.audio.album,
                  albumArtist: item.audio.albumArtist,
                  duration: item.audio.duration,
                  track: item.audio.track,
                  trackCount: item.audio.trackCount,
                  bitrate: item.audio.bitrate,
                }
              : null,
          }}
        />

        {/* Details panel */}
        <ItemPanel item={panelItem} />
      </div>
    )
  }

  // Fallback for non-audio files (placeholder until other stages are built)
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center p-8 text-muted-foreground">
      <p className="font-stashly text-sm">
        {item.name} — viewer not yet implemented for this file type
      </p>
    </div>
  )
}
