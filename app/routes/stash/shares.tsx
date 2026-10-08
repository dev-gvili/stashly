import { sessionContext } from '@/.server/middleware/context'
import { GridLayout } from '@/components/views/grid-view'
import { FileCardDetail } from '@/components/core-components/file-card-variants'
import { FolderCardTab } from '@/components/views/folder-card-components/folder-card-tab'
import { getItemsSharedWithUser } from '@/services/share-actions'
import type { Route } from './+types/shares'
import { redirect } from 'react-router'
import { usePagination } from '@/hooks/usePagination'
import { itemVariants } from '@/components/views/variants'
import { motion } from 'framer-motion'
import { Fragment } from 'react/jsx-runtime'
import { SelectionProvider } from '../../components/stash/selection'
import { LoadMoreItems } from '../../components/core-components/buttons'
import { useId } from 'react'
import { ShareIcon } from '@/components/icons'
import { GenericEmptyState } from '@/components/states/generic-empty-state'

// ---------------------------------------------------------------------------
// Loader — fetch items accessible to the current user via share permissions
// ---------------------------------------------------------------------------

export async function loader({ request, context }: Route.LoaderArgs) {
  const session = context.get(sessionContext)
  const cursor = new URL(request.url).searchParams.get('cursor') ?? undefined
  return getItemsSharedWithUser(session.user.id, { cursor, limit: 50 })
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default ({ loaderData }: Route.ComponentProps) => {
  const id = useId()
  const { items, loadMore, isLoading, hasMore } = usePagination<
    Route.ComponentProps['loaderData']['items'][number]
  >(50, '')

  if (items.length === 0 && !isLoading) {
    return (
      <GenericEmptyState
        icon={<ShareIcon className="size-20" />}
        title="Nothing shared with you yet"
        description="Items shared with you via links or direct invitations will appear here."
      />
    )
  }

  return (
    <Fragment key={id}>
      <SelectionProvider items={items?.map((i) => i.id)}>
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
                <FileCardDetail item={item} showActions={false} />
              )}
            </motion.div>
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
