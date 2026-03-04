import type { Route } from './+types/gallery'
import { Gallery } from '../../components/Gallery'
import { itemRepository } from '../../.server/repositories/ItemRepository'
import { parseSearchParams } from '@/utils/parsers'
import { itemFilterSchema } from '@/.server/search/item.filters'
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll'
import {
  PaginationTrigger,
  PaginationTriggerIndicator,
} from '@/hooks/usePagination'
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

  searchParams.append('take', '500')

  let params = parseSearchParams({
    schema: itemFilterSchema,
    searchParams,
  })

  const res = await itemRepository.search({
    ...params,
    take: params.take + 1,
    strategy: 'cursor',
    orderBy: {
      id: 'asc',
    },
    include: {
      thumbnails: {
        where: {
          size: {
            equals: 'custom',
          },
        },
        select: {
          url: true,
          width: true,
          height: true,
          size: true,
        },
      },
    },
  })

  let images = res.data.map((item) => {
    const thumb = item.thumbnails[0]
    return {
      id: item.id,
      src: thumb?.url || '',
      alt: item.name,
      width: thumb?.width || 1024,
      height: thumb?.height || 1024,
    }
  })
  // console.log(images)
  return { data: images, metadata: res.metadata }
}

export default function Index({ loaderData }: Route.ComponentProps) {
  return <Gallery images={loaderData.data} />
}
