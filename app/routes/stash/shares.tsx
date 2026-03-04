import { auth } from '@/.server/auth'
import { GridLayout } from '@/components/views/grid-view'
import { ItemCard } from '@/components/stash/item-card'
import {
  buildItemFilters,
  itemFilterSchema,
} from '@/utils/filters/item.filters'
import { getFolderContent } from '@/utils/item-actions.server'
import { parseSearchParams } from '@/utils/parsers'
import type { Route } from './+types/shares'
import { redirect } from 'react-router'
import { usePagination } from '@/hooks/usePagination'
import { itemVariants } from '@/components/views/variants'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'

export async function loader({ request, params }: Route.LoaderArgs) {
  let session = await auth.api.getSession(request)
  if (!session) throw redirect('/auth/signin')

  let searchParams = new URL(request.url).searchParams
  searchParams.set('currentUserId', session.user.id)

  let parsedParams = parseSearchParams({
    schema: itemFilterSchema,
    searchParams,
  })

  let filters = buildItemFilters(parsedParams)
  return await getFolderContent(parsedParams.take, parsedParams.cursor, {
    ...filters,
  })
}

export default ({ loaderData }: Route.ComponentProps) => {
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
              <ItemCard.Header />
              <ItemCard.Content>
                <ItemCard.Thumbnail />
                <ItemCard.Name />
              </ItemCard.Content>
              <ItemCard.Footer>
                <ItemCard.Size />
                <ItemCard.Count />
              </ItemCard.Footer>
              <ItemCard.Link />
            </ItemCard>
          </motion.div>
        ))}
      </GridLayout>
      <div className="col-span-full flex justify-center mt-2">
        <Button
          onClick={() => loadMore()}
          disabled={isLoading}
          hidden={!hasMore}
          variant="secondary"
        >
          Load More
        </Button>
      </div>
      {/* <InfiniteList<Route.ComponentProps["loaderData"]> */}
      {/* renderItem={(item) => <ItemCard key={item.id} {...item} />} */}
      {/* take={10} */}
      {/* /> */}
    </div>
  )
}
