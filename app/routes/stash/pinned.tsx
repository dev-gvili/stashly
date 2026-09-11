import { sessionContext } from '@/context'
import { LoadMoreItems } from '@/components/core-components/buttons'
import { FileCardDetail } from '@/components/core-components/file-card-variants'
import { FolderCardTab } from '@/components/views/folder-card-components/folder-card-tab'
import { GridLayout } from '@/components/views/grid-view'
import { itemVariants } from '@/components/views/variants'
import { usePagination } from '@/hooks/usePagination'
import { getPinnedItems } from '@/services/pin-actions'
import { getQueryParam } from '@/utils/query-params'
import { motion } from 'framer-motion'
import { redirect } from 'react-router'
import type { Route } from './+types/pinned'
import { SelectionProvider } from '../../components/stash/selection'

export async function loader({ request, context }: Route.LoaderArgs) {
  const session = context.get(sessionContext)

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
              {item.type === 'folder' ? (
                <FolderCardTab {...item} />
              ) : (
                <FileCardDetail item={item} />
              )}
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
