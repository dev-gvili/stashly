import type { Route } from './+types/gallery'
import { Gallery } from '@/components/Gallery'
import { parseSearchParams } from '@/utils/parsers'
import { ItemType } from '@/prisma/enums'
import { buildSrcSet } from '@/components/views/river-view'
import { prisma } from '@/services/db'
import {
  buildItemFilters,
  itemFilterSchema,
} from '@/utils/filters/item.filters'
import { redirect, Outlet } from 'react-router'
import { auth } from '@/.server/auth'
export function meta({ matches }: Route.MetaArgs) {
  return [
    { title: `Stashly - ${matches.at(-1)?.pathname}` },
    { description: 'Gallery' },
  ]
}

export async function loader({ request }: Route.ActionArgs) {
  // TODO: implement action logic
  const session = await auth.api.getSession(request)
  if (!session) throw redirect('/auth/sign-in')
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
        orderBy: { createdAt: 'desc' },
        take: 1,
        where: { NOT: { url: { startsWith: '#' } } },
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

  let images = res.map((item) => {
    let thumb = item.thumbnails[0]
    return {
      id: item.id,
      src:
        thumb?.url ??
        `https://${session.user.bucket}.t3.tigrisfiles.io/${item.parentId}/${item.name}`,
      alt: item?.name,
      view: thumb?.view,
      width: thumb?.width ?? 512,
      height: thumb?.height ?? 512,
      size: thumb?.size!,
      srcSet: buildSrcSet(thumb?.url!, [thumb?.width ?? 512, (thumb?.width ?? 512) * 2]),
      sizes: `${thumb?.width ?? 512}px`,
      name: item.name,
      type: item.type,
      parentId: item.parentId,
      fileKey: item.file?.key,
    }
  })
  return { data: images }
}

export default function Index({ loaderData }: Route.ComponentProps) {
  return (
    <>
      <Gallery images={loaderData.data!} />
      <Outlet />
    </>
  )
}
