import { sessionContext } from '@/.server/middleware/context'
import type { Route } from './+types/gallery'
import { Gallery } from '@/components/Gallery'
import { parseSearchParams } from '@/utils/parsers'
import { parseOrRespond } from '@/utils/api.errors'
import { toSearchSchema } from '@/utils'
import type { Prisma } from '@/prisma/client'
import { getGalleryMedia } from '@/services/thumbnail-actions'
import {
  buildItemFilters,
  itemFilterSchema,
} from '@/utils/filters/item.filters'
import { redirect, type ShouldRevalidateFunctionArgs } from 'react-router'
import type { View, ViewType } from '@/prisma/client'
import { parseGalleryPrefs } from '@/utils/gallery-layout'
import { QUERY_KEY, SEARCH_MODE_KEY } from '@/utils/filter-data'
export function meta({ matches }: Route.MetaArgs) {
  return [
    { title: `Stashly - ${matches.at(-1)?.pathname}` },
    { description: 'Gallery' },
  ]
}

export async function loader({ request, context }: Route.ActionArgs) {
  // TODO: implement action logic
  const session = context.get(sessionContext)
  const url = new URL(request.url)
  const searchParams = url.searchParams
  const layout = searchParams.get('layout')
  const isImagesPage = url.pathname.endsWith('/images')
  // The Images page runs the header search on the client (hybrid search over
  // the loaded images); left in, `query` would also narrow this list to name
  // matches and hide images found by content.
  if (isImagesPage) {
    searchParams.delete(QUERY_KEY)
    searchParams.delete(SEARCH_MODE_KEY)
  }
  searchParams.append('take', '200')

  let params = parseOrRespond(() => parseSearchParams({
    schema: toSearchSchema<
      typeof itemFilterSchema,
      Prisma.ItemOrderByWithRelationInput,
      Prisma.ItemInclude
    >({ schema: itemFilterSchema }),
    searchParams,
  }), 'text')
  let filters = buildItemFilters(params)
  // `getGalleryMedia` lists images and videos; the Images page shows images
  // only (videos have their own route).
  if (isImagesPage) {
    filters = { ...filters, category: 'image' }
  }

  let media = await getGalleryMedia(session.user.id, filters, params.take)

  let images = media.map((item) => {
    let thumb = item.thumbnails[0]
    // The media's own size first: every stored thumbnail is a 512×512 square,
    // so reading it first gave every tile an aspect ratio of 1.
    const storedW =
      item.image?.width ?? item.video?.width ?? thumb?.width ?? null
    const storedH =
      item.image?.height ?? item.video?.height ?? thumb?.height ?? null

    // Resolve dimensions — always need valid width + height for buildRows aspect-ratio math.
    let w: number
    let h: number
    if (storedW && storedH) {
      w = storedW
      h = storedH
    } else {
      // No dimension info at all — assume 16:9 at a reasonable display size
      w = 320
      h = 180
    }

    // Signed GET URL, produced once per loader run by `signThumbnails`. It is
    // stable for the signing window, so re-renders hit the browser cache.
    const thumbSrc = thumb?.url ?? ''
    return {
      id: item.id,
      src: thumbSrc,
      alt: item.name,
      view: layout as ViewType,
      width: w,
      height: h,
      size: thumb?.size ?? 'original',
      // One candidate only: every stage is a fixed-width WebP, so the old
      // `?w=` variants fetched the same bytes twice — and a `w` param appended
      // to a signed URL is outside its signature, which Tigris rejects with 403.
      srcSet: thumbSrc,
      sizes: `${thumb?.width ?? w}px`,
      name: item.name,
      type: item.type,
      parentId: item.parentId,
      fileKey: item.file?.key,
      // Read by the Images page (`GalleryPageImage`); `size` is a BigInt
      // column, which JSON can't carry.
      bytes: Number(item.size),
      createdAt: item.createdAt.toISOString(),
      pinned: item.pins.length > 0,
      folderName: item.parent?.name ?? null,
    }
  })
  // Read here so the server render already uses the viewer's gap / size /
  // grouping, and nothing shifts on hydrate.
  const prefs = parseGalleryPrefs(request.headers.get('cookie'))
  // One crumb, the page itself: the header's `<Breadcrumbs />` renders it as
  // the current page, the same trail the file page shows.
  const crumbs = isImagesPage
    ? [{ id: 'images', name: 'Images', parentId: null, type: 'folder' as const }]
    : undefined
  // The clock the date groups are built against: the server render and the
  // browser both use this one, so they build the same groups.
  return { data: images, prefs, crumbs, now: Date.now() }
}

/**
 * Params the Images page handles on the client: layout, the header search
 * (`query`, `searchMode`) and the selection.
 */
const CLIENT_ONLY_PARAMS = new Set([
  'layout',
  QUERY_KEY,
  SEARCH_MODE_KEY,
  'selectedItems',
])

/**
 * Skip the loader (200 rows plus thumbnail signing) when a navigation only
 * changed a client-side param. Submissions (trash, restore, pin) still
 * revalidate as usual.
 */
export function shouldRevalidate({
  currentUrl,
  nextUrl,
  formMethod,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  if (formMethod || currentUrl.pathname !== nextUrl.pathname) {
    return defaultShouldRevalidate
  }
  const keys = new Set([...currentUrl.searchParams.keys(), ...nextUrl.searchParams.keys()])
  for (const key of keys) {
    if (CLIENT_ONLY_PARAMS.has(key)) continue
    if (
      currentUrl.searchParams.getAll(key).join() !== nextUrl.searchParams.getAll(key).join()
    ) {
      return defaultShouldRevalidate
    }
  }
  return false
}

export default function Index({ loaderData }: Route.ComponentProps) {
  return (
    <Gallery images={loaderData.data!} prefs={loaderData.prefs} now={loaderData.now} />
  )
}
