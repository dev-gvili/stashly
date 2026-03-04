import { LoadMoreItems } from '@/components/core-components/buttons'
import { ItemCard } from '@/components/stash/item-card'
import { GridLayout } from '@/components/views/grid-view'
import { itemVariants } from '@/components/views/variants'
import { usePagination } from '@/hooks/usePagination'
import { auth } from '@/services/auth'
import {
  buildItemFilters,
  itemFilterSchema,
} from '@/utils/filters/item.filters'
import { getFolderContent } from '@/utils/item-actions.server'
import { parseSearchParams } from '@/utils/parsers'
import { getQueryParamArray } from '@/utils/query-params'
import { motion } from 'framer-motion'
import { redirect, type ShouldRevalidateFunction } from 'react-router'
import type { Route } from './+types/folder'
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

  return await getFolderContent(parsedParams.take, parsedParams.cursor, filters)
}

export const shouldRevalidate: ShouldRevalidateFunction = ({
  nextUrl,
  currentUrl,
  defaultShouldRevalidate,
  formAction,
  formData,
}) => {
  let current = currentUrl.searchParams
  let next = nextUrl.searchParams
  console.log(nextUrl.pathname)
  ;['sidebar'].forEach((action) => {
    if (formAction?.includes(action)) {
      return false
    }
  })
  let currentSelectedItems = getQueryParamArray(current, 'selectedItems')
  let nextSelectedItems = getQueryParamArray(next, 'selectedItems')
  if (currentSelectedItems.length !== nextSelectedItems.length) {
    return false
  }
  return true
}

export default () => {
  let { items, loadMore, isLoading, hasMore } = usePagination<
    Route.ComponentProps['loaderData']['items'][number]
  >(100, '')
  return (
    <div className="w-full relative">
      <GridLayout>
        {items.map((item) => (
          <motion.div
            key={item.id}
            variants={itemVariants}
            transition={{ duration: 0.2 }}
          >
            <ItemCard key={item.id} {...item}>
              <ItemCard.Header>
                <ItemCard.Checkbox name="selectedItems" value={item.id} />
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
          </motion.div>
        ))}
      </GridLayout>
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
