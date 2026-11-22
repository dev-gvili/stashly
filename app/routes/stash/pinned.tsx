import { sessionContext } from '@/.server/middleware/context'
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
import { GenericEmptyState } from '@/components/states/generic-empty-state'
import { EmptyPinsVector } from '@/components/states/vectors/empty-vectors'

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
        <GenericEmptyState
          icon={<EmptyPinsVector />}
          title="No pins yet"
          description="Pin an item from its menu to see it here."
          className="h-auto py-16"
        />
      )}
      <div className="col-span-full flex justify-center mt-2">
        <LoadMoreItems loadMore={loadMore} isLoading={isLoading} hasMore={hasMore} />
      </div>
    </div>
  )
}
