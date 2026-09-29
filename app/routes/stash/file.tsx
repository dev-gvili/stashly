// Loaded only when this stage renders (React 19 hoists & dedupes the link to
import { isSearchIndexSubmission } from '@/utils/revalidation'
// <head> via `precedence`), so the ligature font never ships on non-markdown
// pages. Code blocks use 'JetBrains Mono Variable' — see `.markdown-stage code`.
import { searchActivities } from '@/services/activity-actions'
import { AudioStage } from '@/components/views/item-page/audio-stage'
import { ImageStage } from '@/components/views/item-page/image-stage'
import { ItemPanel } from '@/components/views/item-page/item-panel'
import { MarkdownStage } from '@/components/views/item-page/markdown-stage'
import { PdfStage } from '@/components/views/item-page/pdf-stage'
import { SiblingNav } from '@/components/views/item-page/sibling-nav'
import { TextStage } from '@/components/views/item-page/text-stage'
import { VideoStage } from '@/components/views/item-page/video-stage'
import { breadcrumbs } from '@/services/breadcrumbs'
import {
  getChildIdByName,
  getFileItem,
  getMediaSiblings,
  loadMarkdownDocument,
  loadTextDocument,
} from '@/services/item-actions'
import { getPresignedUrl } from '@/services/s3'
import type { StashItemPanel } from '@/types/stash.types'
import { StashlyPrefixMap } from '@/utils/converters'
import { isMarkdownName } from '@/utils/markdown'
import { isTextRenderableFile } from '@/utils/text-thumbnail'
import { cn } from '@/utils/styles'
import jetbrainsMonoFonts from '@fontsource-variable/jetbrains-mono/index.css?url'
import type { LinksFunction } from 'react-router'
import { href, type ShouldRevalidateFunction } from 'react-router'
import type { Route } from './+types/file'
import { sessionContext } from '@/.server/middleware/context'

export { ErrorBoundary } from '@/components/error-boundary'

export const links: LinksFunction = () => [
  { rel: 'stylesheet', href: jetbrainsMonoFonts },
]

export const shouldRevalidate: ShouldRevalidateFunction = ({
  currentUrl,
  nextUrl,
  formMethod,
  formData,
  formAction,
  defaultShouldRevalidate,
}) => {
  // Background search-index writes (OCR pages, chunk embeddings) change no
  // rendered data. Without this, a 15-page OCR run re-ran this loader ~30
  // times for nothing.
  if (isSearchIndexSubmission(formData)) return false

  // A navigation to the URL we are already on, with no submission behind it,
  // is the post-upload refresh (`upload-thumbnail-runner`, `useThumbnailRevalidation`)
  // — it exists to pull new items into listings, and this page is not one.
  // Letting it through re-ran this loader after every finished upload, and the
  // loader signs the media URL afresh each run, so `<video>`/`<audio>` got a
  // new `src` every few seconds and aborted playback before it could start
  // (HAR: 15 media requests, 13 distinct signed URLs, 14 loader runs in 66 s).
  if (!formMethod && currentUrl.href === nextUrl.href) return false

  if (
    formAction &&
    ['favorites','sidebar', 'theme'].some((action) => formAction.includes(action))
  ) {
    return false
  }

  if (
    formData?.get('intent') === 'move_item' ||
    formData?.get('intent') === 'trash_item' ||
    formData?.get('intent') === 'rename_item'
  ) {
    return true
  }

  return defaultShouldRevalidate
}

type MediaKind = 'pdf' | 'markdown' | 'image' | 'video' | 'audio' | 'text'

/**
 * Which stage renders this item. A facet row is authoritative; the mime type
 * is the fallback for files whose facet hasn't been extracted (yet).
 */
function detectMediaKind(item: {
  name: string
  file: { mimeType: string | null } | null
  pdf: unknown
  markdown: unknown
  image: unknown
  video: unknown
  audio: unknown
}): MediaKind | null {
  const mimeType = item.file?.mimeType
  if (item.pdf != null || mimeType === 'application/pdf') return 'pdf'
  if (item.markdown != null || isMarkdownName(item.name, mimeType))
    return 'markdown'
  if (item.image != null || mimeType?.startsWith('image/')) return 'image'
  if (item.video != null || mimeType?.startsWith('video/')) return 'video'
  if (item.audio != null || mimeType?.startsWith('audio/')) return 'audio'
  // Last: markdown/image (svg) matched above, so this only catches the rest
  // of the text-renderable set (plain text, code, config, logs).
  if (isTextRenderableFile({ name: item.name, type: mimeType ?? undefined }))
    return 'text'
  return null
}

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const session = context.get(sessionContext)
  // A relative link inside a Markdown document (`[spec](./upload-multipart.md)`)
  // resolves against the current URL, so `:fileId` arrives as a *file name*
  // rather than an `item_…` id. Every query below is id-keyed, so map the name
  // back to its id first. The URL is left as-is (no redirect), so use `fileId`
  // — never `params.fileId` — for anything id-keyed from here down. A name that
  // resolves to nothing keeps its original value and falls through to
  // `getFileItem`, which throws the proper not-found.
  const fileId = params.fileId.startsWith(`${StashlyPrefixMap.Item}_`)
    ? params.fileId
    : ((await getChildIdByName(
        params.folderId,
        decodeURIComponent(params.fileId)
      )) ?? params.fileId)

  const [allCrumbs, acts, item, siblings] = await Promise.all([
    breadcrumbs(fileId, session.user.id),
    searchActivities({
      ownerId: { equals: session.user.id },
      itemId: { equals: fileId },
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
    getFileItem(session.user.id, fileId, params.folderId),
    // Media items in the same folder, for the prev/next stage navigation. For
    // non-media files (or folders the user doesn't own) the current item just
    // won't be in the list and the nav stays hidden.
    getMediaSiblings(session.user.id, params.folderId),
  ])

  const crumbs =
    item.ownerId === session.user.id ? allCrumbs : allCrumbs.slice(-1)

  const kind = detectMediaKind(item)
  const src =
    kind && item.file?.key
      ? // `no-store` keeps the media out of Chrome's HTTP cache. Tigris sends
        // no Cache-Control of its own, so Chrome cached the audio heuristically
        // as a partial entry, and later range reads stalled inside the browser:
        // a 304 answered in 86 ms, then 242 s of 0-byte `receive`, and a later
        // disk-cache read that hung 497 s (HAR, 2026-09-24). The element keeps
        // its own in-memory buffer either way.
        await getPresignedUrl(item.file.bucket, 'get', item.file.key, 3600, {
          responseCacheControl: 'no-store',
        })
      : ''

  // Markdown body is loaded server-side and streamed via deferred data: the
  // promise is returned unawaited so the page shell (panel, breadcrumbs,
  // siblings) paints immediately while the document flows in behind a
  // <Suspense> boundary in MarkdownStage.
  const markdownDoc =
    kind === 'markdown' && item.file?.key
      ? loadMarkdownDocument(item.file.bucket, item.file.key)
      : null

  // Text bodies stream the same way as markdown (see above).
  const textDoc =
    kind === 'text' && item.file?.key
      ? loadTextDocument(item.file.bucket, item.file.key)
      : null

  return { item, crumbs, activities: acts.data, src, siblings, kind, markdownDoc, textDoc }
}

export default function FilePage({ loaderData, params }: Route.ComponentProps) {
  const { item, kind } = loaderData

  // Fallback for file types without a stage yet.
  if (!kind) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-8 text-muted-foreground">
        <p className="font-stashly text-sm">
          {item.name} — viewer not yet implemented for this file type
        </p>
      </div>
    )
  }

  return (
    // Viewport-pinned (like ItemPanel's h-[calc(100vh-4rem)] top-14): the
    // document itself must not scroll — scrolling happens inside the stage,
    // so rails and floating toolbars stay put.
    // minmax(0,1fr): a bare 1fr track has min-width auto, so wide zoomed
    // pages would grow the track (and the measured stage width) instead of
    // scrolling — which feeds back into the fit-width scale and runs away.
    <div
      className={cn(
        'absolute inset-0 grid h-screen min-h-0 w-full grid-cols-[minmax(0,1fr)_auto] gap-2 pb-10'
      )}
    >
      <Stage kind={kind} loaderData={loaderData} params={params} />
      <ItemPanel item={buildPanelItem(loaderData)} />
    </div>
  )
}

function Stage({
  kind,
  loaderData,
  params,
}: { kind: MediaKind } & Pick<Route.ComponentProps, 'loaderData' | 'params'>) {
  const { item, siblings } = loaderData

  switch (kind) {
    case 'pdf':
      return <PdfStage {...loaderData} />
    case 'markdown':
      return <MarkdownStage {...loaderData} />
    case 'text':
      return <TextStage {...loaderData} />
    case 'audio':
      return <AudioStage {...loaderData} />
    case 'image':
    case 'video': {
      // Prev/next between media siblings in the same folder. Only images and
      // videos appear in `siblings`, so SiblingNav hides itself for anything
      // else (or when the item is the only media file in its folder).
      const index = siblings.findIndex((s) => s.id === item.id)
      const siblingHref = (id: string) =>
        href('/:me/stash/folders/:folderId/files/:fileId', {
          me: params.me,
          folderId: params.folderId,
          fileId: id,
        })

      return (
        <div className="relative h-full min-h-0 min-w-0">
          {kind === 'image' ? (
            <ImageStage {...loaderData} />
          ) : (
            <VideoStage {...loaderData} />
          )}
          <SiblingNav
            prevHref={index > 0 ? siblingHref(siblings[index - 1].id) : null}
            nextHref={
              index >= 0 && index < siblings.length - 1
                ? siblingHref(siblings[index + 1].id)
                : null
            }
            index={index}
            total={siblings.length}
          />
        </div>
      )
    }
  }
}

/** Narrows the loader item to the subset ItemPanel renders. */
function buildPanelItem({
  item,
  activities,
  src,
}: Route.ComponentProps['loaderData']): StashItemPanel {
  return {
    id: item.id,
    name: item.name,
    size: item.size,
    category: item.category,
    url: src,
    tags: item.tags,
    type: item.type,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    openedAt: item.openedAt,
    status: item.status,
    owner: item.owner,
    file: item.file
      ? {
          mimeType: item.file.mimeType ?? null,
          extension: item.file.extension ?? null,
        }
      : null,
    audio: item.audio,
    pdf: item.pdf,
    markdown: item.markdown,
    video: item.video,
    image: item.image,
    favorites: item.favorites,
    permissions: item.permissions,
    collections: item.memberOfCollections.map((m) => m.collection),
    activities,
  }
}
