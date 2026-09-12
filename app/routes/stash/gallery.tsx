import { sessionContext } from '@/.server/middleware/context'
import type { Route } from './+types/gallery'
import { Gallery } from '@/components/Gallery'
import { parseSearchParams } from '@/utils/parsers'
import { ItemCategory, ItemType } from '@/prisma/enums'
import { buildSrcSet } from '@/utils/gallery-layout'
import { prisma } from '@/services/db'
import {
  buildItemFilters,
  itemFilterSchema,
} from '@/utils/filters/item.filters'
import { redirect } from 'react-router'
import type { View, ViewType } from '@/prisma/client'
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
  searchParams.append('take', '200')

  let params = parseSearchParams({
    schema: itemFilterSchema,
    searchParams,
  })
  let filters = buildItemFilters(params)

  let res = await prisma.item.findMany({
    // cursor: params.cursor ? { id: params.cursor } : undefined,
    where: {
      type: ItemType.file,
      category: {
        in: [ItemCategory.image, ItemCategory.video],
      },
      ownerId: session.user.id,
      thumbnails: {
        some: {
          url: {
            not: null,
          },
          NOT: { url: { startsWith: '#' } },
        },
      },
      ...filters,
    },
    take: params.take,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: {
      id: true,
      name: true,
      type: true,
      parentId: true,
      file: {
        select: {
          key: true,
        },
      },
      thumbnails: {
        orderBy: { stage: 'desc' },
        take: 1,
        where: { NOT: { url: { startsWith: '#' } } },
        select: {
          height: true,
          width: true,
          url: true,
          size: true,
          id: true,
          stage: true,
        },
      },
      image: { select: { width: true, height: true } },
      video: {
        select: {
          width: true,
          height: true,
          duration: true,
          bitrate: true,
          codec: true,
        },
      },
    },
  })

  let images = res.map((item) => {
    let thumb = item.thumbnails[0]
    const storedW =
      thumb?.width ?? item.image?.width ?? item.video?.width ?? null
    const storedH =
      thumb?.height ?? item.image?.height ?? item.video?.height ?? null

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

    // Use the public Tigris URL stored on the thumbnail row directly.
    // Going through /api/thumbnails/:itemId hits a server-side redirect
    // that signs a fresh presigned URL on every image request — that
    // path defeats browser caching and floods the API with sign calls.
    const thumbSrc = thumb?.url ?? ''
    return {
      id: item.id,
      src: thumbSrc,
      alt: item.name,
      view: layout as ViewType,
      width: w,
      height: h,
      size: thumb?.size ?? 'original',
      srcSet: buildSrcSet(thumbSrc, [w, w * 2]),
      sizes: `${w}px`,
      name: item.name,
      type: item.type,
      parentId: item.parentId,
      fileKey: item.file?.key,
    }
  })
  return { data: images }
}

export default function Index({ loaderData }: Route.ComponentProps) {
  return <Gallery images={loaderData.data!} />
}
