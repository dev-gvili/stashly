import { LoadMoreItems } from '@/components/core-components/buttons'
import { Breadcrumbs } from '@/components/core-components/breadcrumb-navigation'
import { ItemCard } from '@/components/stash/item-card'
import { GridLayout } from '@/components/views/grid-view'
import { usePagination } from '@/hooks/usePagination'
import { auth } from '@/services/auth'
import {
  buildItemFilters,
  itemFilterSchema,
} from '@/utils/filters/item.filters'
import { getFolderContent, touchOpenedAt } from '@/services/item-actions'
import { breadcrumbs } from '@/services/breadcrumbs'
import { prisma } from '@/services/db'
import { parseSearchParams } from '@/utils/parsers'
import { getQueryParam, getQueryParamArray } from '@/utils/query-params'
import { motion } from 'framer-motion'
import {
  redirect,
  type ShouldRevalidateFunction,
  useLoaderData,
} from 'react-router'
import type { Route } from './+types/folder'
import { SelectionProvider } from '../../components/stash/selection'
export async function loader({ request, params }: Route.LoaderArgs) {
  let session = await auth.api.getSession({
    headers: request.headers
  })
  if (!session) throw redirect('/auth/signin')

  let url = new URL(request.url)
  let searchParams = url.searchParams
  searchParams.set('currentUserId', session.user.id)
  searchParams.set('parentId', params.folderId)

  let parsedParams = parseSearchParams({
    schema: itemFilterSchema,
    searchParams,
  })

  let filters = buildItemFilters(parsedParams)

  const [folderContent, allCrumbs, folder] = await Promise.all([
    getFolderContent({
      cursor: parsedParams.cursor,
      limit: parsedParams.take,
      where: { ...filters, parentId: params.folderId },
      orderBy: parsedParams.orderBy,
    }),
    breadcrumbs(params.folderId),
    prisma.item.findUnique({
      where: { id: params.folderId },
      select: { ownerId: true },
    }),
  ])

  Promise.resolve()
    .then(() => touchOpenedAt(params.folderId))
    .catch(() => {})

  const crumbs =
    folder?.ownerId === session.user.id ? allCrumbs : allCrumbs.slice(-1)
  return { ...folderContent, crumbs, me: params.me }
}

export const shouldRevalidate: ShouldRevalidateFunction = ({
  nextUrl,
  currentUrl,
  formAction,
  formData,
  defaultShouldRevalidate,
}) => {
  let currentSelectedItems = getQueryParamArray(
    currentUrl.searchParams,
    'selectedItems'
  )
  let nextSelectedItems = getQueryParamArray(
    nextUrl.searchParams,
    'selectedItems'
  )

  ;['favorites', 'sidebar', 'theme'].forEach((action) => {
    if (formAction?.includes(action)) {
      return false
    }
  })

  if (
    formData?.get('intent') === 'move_items' ||
    formData?.get('intent') === 'trash_items' ||
    formData?.get('intent') === 'create_folder' ||
    formData?.get('intent') === 'create_upload_item'
  ) {
    return true
  }

  if (
    currentSelectedItems.length !== nextSelectedItems.length &&
    currentUrl.pathname === nextUrl.pathname
  ) {
    return false
  }

  return defaultShouldRevalidate
}

export default () => {
  let { items, loadMore, isLoading, hasMore } = usePagination<
    Route.ComponentProps['loaderData']['items'][number]
  >(50, '')
  return (
    <div className="w-full h-full relative space-y-4">
      <SelectionProvider items={items.map((i) => i.id)}>
        <GridLayout>
          {items.map((item) => (
            <ItemCard key={item.id} {...item}>
              <ItemCard.Header>
                <ItemCard.Checkbox name="selectedItems" value={item.id} />
                <ItemCard.Actions className="place-self-end" />
              </ItemCard.Header>
              <ItemCard.Content>
                <ItemCard.Thumbnail />
                <ItemCard.Name />
              </ItemCard.Content>
              <ItemCard.Footer>
                <ItemCard.Size />
                <ItemCard.Count />
              </ItemCard.Footer>
            </ItemCard>
          ))}
        </GridLayout>
      </SelectionProvider>
      <div className="col-span-full flex justify-center mt-2">
        <LoadMoreItems
          loadMore={loadMore}
          isLoading={isLoading}
          hasMore={hasMore}
        />
      </div>
    </div>
  )
}
