import { sessionContext } from '@/.server/middleware/context'
import type { Route } from './+types/gallery'
import { Gallery } from '@/components/Gallery'
import { parseSearchParams } from '@/utils/parsers'
import { toSearchSchema } from '@/utils'
import type { Prisma } from '@/prisma/client'
import { ItemCategory, ItemType } from '@/prisma/enums'
import { prisma } from '@/services/db'
import { signThumbnails } from '@/services/thumbnail-actions'
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
    schema: toSearchSchema<
      typeof itemFilterSchema,
      Prisma.ItemOrderByWithRelationInput,
      Prisma.ItemInclude
    >({ schema: itemFilterSchema }),
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

  let images = (await signThumbnails(res)).map((item) => {
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
