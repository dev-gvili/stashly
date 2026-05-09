import type { Route } from './+types/all'
import { auth } from '@/.server/auth'
import { redirect } from 'react-router'
import { getFolderContent } from '@/services/item-actions'
import {
  buildItemFilters,
  itemFilterSchema,
} from '@/utils/filters/item.filters'
import { parseSearchParams } from '@/utils/parsers'
import { GridLayout } from '@/components/views/grid-view'
import { ItemCard } from '@/components/stash/item-card'
import { Button } from '@/components/ui/button'
import { usePagination } from '@/hooks/usePagination'
import { motion } from 'framer-motion'
import { itemVariants } from '@/components/views/variants'
import { Fragment, useId } from 'react'
import { ListLayout } from '@/components/views/list-view'
import type { ShouldRevalidateFunction } from 'react-router'
import { LoaderIcon, SubmitIcon } from '../../components/icons'
import { cn } from '../../utils/styles'
import { SelectionProvider } from '../../components/stash/selection'
import { LoadMoreItems } from '../../components/core-components/buttons'
import { getQueryParamArray } from '../../utils/query-params'
import { FilesEmptyState } from '../../components/states/files-empty-state'

export { ErrorBoundary } from '@/components/error-boundary'

export function meta({ matches }: Route.MetaArgs) {
  let userName = matches[1].loaderData?.user.name
  return [
    { title: `Stashly - ${userName ? `${userName}'s Stash` : 'Stash'}` },
    { description: 'Stash' },
    {
      name: 'og:title',
      content: `Stashly - ${userName ? `${userName}'s Stash` : 'Stash'}`,
    },
    {
      name: 'og:description',
      content: `Stashly - ${userName ? `${userName}'s Stash` : 'Stash'}`,
    },
  ]
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
  
  ;['trash_items', 'move_items'].forEach((action) => {
    if (formData?.get('intent') === action) {
      return true
    }
  })


  if (
    currentSelectedItems.some((item) => !nextSelectedItems.includes(item)) &&
    currentUrl.pathname === nextUrl.pathname
  ) {
    return false
  }

  return defaultShouldRevalidate
}

export async function loader({ request, params }: Route.ActionArgs) {
  const session = await auth.api.getSession(request)
  if (!session) {
    throw redirect('/auth/signin')
  }

  let searchParams = new URL(request.url).searchParams
  searchParams.set('currentUserId', session.user.id)
  searchParams.set('parentId', session.user.rootId)
  let parsedParams = parseSearchParams({
    schema: itemFilterSchema,
    searchParams,
  })

  let filters = buildItemFilters(parsedParams)

  return await getFolderContent({
    cursor: parsedParams.cursor,
    limit: parsedParams.take,
    where: { ...filters, parentId: session.user.rootId },
    orderBy: parsedParams.orderBy,
  })
}

export default function Index() {
  let id = useId()
  let { items, loadMore, isLoading, hasMore } = usePagination<
    Route.ComponentProps['loaderData']['items'][number]
  >(25, '?index')
  if (items.length === 0) return <FilesEmptyState />

  return (
    <Fragment key={id}>
      <SelectionProvider items={items.map((i) => i.id)}>
        <ListLayout items={items} />
        <GridLayout>
          {items?.map((item) => (
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
      <div className="col-span-full flex justify-center items-center h-full py-4">
        <LoadMoreItems
          loadMore={loadMore}
          isLoading={isLoading}
          hasMore={hasMore}
        />
      </div>
    </Fragment>
  )
}
