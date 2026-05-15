import { LoadMoreItems } from '@/components/core-components/buttons'
import { ItemCard } from '@/components/stash/item-card'
import { GridLayout } from '@/components/views/grid-view'
import { itemVariants } from '@/components/views/variants'
import { usePagination } from '@/hooks/usePagination'
import { auth } from '@/services/auth'
import { getPinnedItems } from '@/services/pin-actions'
import { getQueryParam } from '@/utils/query-params'
import { motion } from 'framer-motion'
import { redirect } from 'react-router'
import type { Route } from './+types/pinned'
import { SelectionProvider } from '../../components/stash/selection'

export async function loader({ request }: Route.LoaderArgs) {
  const session = await auth.api.getSession(request)
  if (!session) throw redirect('/auth/sign-in')

  const url = new URL(request.url)
  const cursor = getQueryParam(url.searchParams, 'cursor') ?? undefined

  return getPinnedItems({ userId: session.user.id, cursor })
}

export default function Pinned() {
  const { items, loadMore, isLoading, hasMore } = usePagination<
    Route.ComponentProps['loaderData']['items'][number]
  >(50)

  return (
    <div className="w-full relative space-y-4">
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
      {items.length === 0 && (
        <p className="text-muted-foreground text-sm text-center py-16">
          No pins yet. Pin an item from its menu to see it here.
        </p>
      )}
      <div className="col-span-full flex justify-center mt-2">
        <LoadMoreItems loadMore={loadMore} isLoading={isLoading} hasMore={hasMore} />
      </div>
    </div>
  )
}
