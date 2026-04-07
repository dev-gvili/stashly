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
import { getFolderContent } from '@/services/item-actions'
import { parseSearchParams } from '@/utils/parsers'
import { getQueryParam, getQueryParamArray } from '@/utils/query-params'
import { motion } from 'framer-motion'
import { redirect, type ShouldRevalidateFunction } from 'react-router'
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

  return await getFolderContent({
    cursor: parsedParams.cursor,
    where: { ...filters, parentId: params.folderId },
  })
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
  let { items, loadMore, isLoading, hasMore } = usePagination<
    Route.ComponentProps['loaderData']['items'][number]
  >(100, '')
  return (
    <div className="w-full relative">
      <SelectionProvider items={items.map((i) => i.id)}>
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
            </motion.div>
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
