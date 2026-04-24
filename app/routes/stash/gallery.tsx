import type { Route } from './+types/gallery'
import { Gallery } from '@/components/Gallery'
import { parseSearchParams } from '@/utils/parsers'
import { ItemType, ThumbnailSize, ViewType } from '@/prisma/enums'
import { buildSrcSet } from '@/components/views/river-view'
import { prisma } from '@/services/db'
import {
  buildItemFilters,
  itemFilterSchema,
} from '@/utils/filters/item.filters'
export function meta({ matches }: Route.MetaArgs) {
  return [
    { title: `Stashly - ${matches.at(-1)?.pathname}` },
    { description: 'Gallery' },
  ]
}

export async function loader({ request }: Route.ActionArgs) {
  // TODO: implement action logic
  const url = new URL(request.url)
  const searchParams = url.searchParams
  const layout = searchParams.get('layout')
  searchParams.append('take', '200')

  let params = parseSearchParams({
    schema: itemFilterSchema,
    searchParams,
  })
  let filters = buildItemFilters(params)
  let res: {
    type: ItemType
    id: string
    name: string
    parentId: string | null
    file: {
      key: string
    } | null
    thumbnails: {
      view: ViewType
      size: ThumbnailSize
      id: string
      url: string | null
      height: number | null
      width: number | null
    }[]
  }[] = []

  if (url.pathname.includes('videos')) {
    res = await prisma.item.findMany({
      // cursor: params.cursor ? { id: params.cursor } : undefined,
      where: {
        type: ItemType.file,
        file: {
          mimeType: {
            startsWith: 'video/',
          },
        },
        ...filters,
      },
      take: params.take,
      select: {
        id: true,
        name: true,
        type: true,
        parentId: true,
        file: {
          select: {
            key: true,
          }
        },
        thumbnails: {
          where: {
            AND: [
              {
                view: layout as ViewType,
              },
              { size: ThumbnailSize.medium },
            ],
          },
          select: {
            height: true,
            width: true,
            url: true,
            size: true,
            view: true,
            id: true,
            stage: true,
          },
        },
      },
    })
  }

  if (url.pathname.includes('images')) {
    res = await prisma.item.findMany({
      // cursor: params.cursor ? { id: params.cursor } : undefined,
      where: {
        thumbnails: {
          some: {
            url: {
              not: null,
            },
          },
        },
        ...filters,
      },
      take: params.take,
      select: {
        id: true,
        name: true,
        type: true,
        parentId: true,
        file: {
          select: {
            key: true,
          }
        },
        thumbnails: {
          where: {
            AND: [
              {
                view: layout as ViewType,
              },
              { size: ThumbnailSize.medium },
            ],
          },
          select: {
            height: true,
            width: true,
            url: true,
            size: true,
            view: true,
            id: true,
            stage: true,
          },
        },
      },
    })
  }
  let images = res.map((item) => {
    let thumb = item.thumbnails[0]
    return {
      id: item.id,
      src: thumb && thumb.stage >= 1
        ? `/api/thumbnails/${item.id}?v=${thumb.stage}`
        : thumb?.url ?? `https://stashly-devgvili-sbp7fs6d.t3.tigrisfiles.io/${item.parentId}/${item.name}`,
      alt: item?.name,
      view: thumb?.view,
      width: thumb?.width!,
      height: thumb?.height!,
      size: thumb?.size,
      srcSet: buildSrcSet(thumb?.url!, [
        Math.round(thumb?.width!),
        Math.round(thumb?.width! * 2),
      ]),
      sizes: `${Math.round(thumb?.width!)}px`,
      name: item.name,
      type: item.type,
      parentId: item.parentId,
      fileKey: item.file?.key,
    }
  })
  return { data: images }
}

export default function Index({ loaderData }: Route.ComponentProps) {
  return <Gallery images={loaderData.data} />
}
