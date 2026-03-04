import type { Route } from './+types/gallery'
import { Gallery } from '@/components/Gallery'
import { parseSearchParams } from '@/utils/parsers'
import { ThumbnailSize, ViewType } from '@/prisma/enums'
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
  let res = await prisma.item.findMany({
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
      thumbnails: {
        where: {
          AND: [
            {
              view: layout as ViewType,
            },
            { size: ThumbnailSize.small },
          ],
        },
        select: {
          height: true,
          width: true,
          url: true,
          size: true,
          view: true,
          id: true,
        },
      },
    },
  })
  // const res = await itemRepository.search({
  //   ...params,
  //   take: params.take + 1,
  //   strategy: 'cursor',
  //   orderBy: {
  //     id: 'asc',
  //   },
  //   include: {
  //     thumbnails: {
  //       where: {
  //         size: {
  //           equals: ThumbnailSize.large,
  //         },
  //       },
  //       select: {
  //         url: true,
  //         width: true,
  //         height: true,
  //         size: true,
  //         view: true,
  //       },
  //     },
  //   },
  // })

  let images = res.map((item) => {
    let thumb = item.thumbnails[0]
    return {
      id: item.id,
      src: thumb?.url || '',
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
    }
  })
  // console.log(images)
  return { data: images }
}

export default function Index({ loaderData }: Route.ComponentProps) {
  return <Gallery images={loaderData.data} />
}
