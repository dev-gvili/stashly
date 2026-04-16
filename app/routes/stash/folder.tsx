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
import { getFolderContent } from '@/services/item-actions'
import { breadcrumbs } from '@/services/breadcrumbs'
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
  let session = await auth.api.getSession(request)
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

  const [folderContent, crumbs] = await Promise.all([
    getFolderContent({
      cursor: parsedParams.cursor,
      limit: parsedParams.take,
      where: { ...filters, parentId: params.folderId },
    }),
    breadcrumbs(params.folderId),
  ])

  return { ...folderContent, crumbs, me: params.me }
}

export const shouldRevalidate: ShouldRevalidateFunction = ({
  nextUrl,
  currentUrl,
  formAction,
  formData,
}) => {
  let current = currentUrl.searchParams
  let next = nextUrl.searchParams
  ;['sidebar'].forEach((action) => {
    if (formAction?.includes(action)) {
      return false
    }
  })
  let currentSelectedItems = getQueryParamArray(current, 'selectedItems')
  let nextSelectedItems = getQueryParamArray(next, 'selectedItems')

  if (formData?.get('intent') === 'move_items') {
    return true
  }

  if (currentSelectedItems.length !== nextSelectedItems.length) {
    return false
  }
  return true
}

export default () => {
  const { crumbs, me } = useLoaderData() as Route.ComponentProps['loaderData']
  let { items, loadMore, isLoading, hasMore } = usePagination<
    Route.ComponentProps['loaderData']['items'][number]
  >(25, '')
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
