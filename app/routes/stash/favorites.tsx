import { sessionContext } from '@/.server/middleware/context'
import { LoadMoreItems } from '@/components/core-components/buttons'
import { isSearchIndexSubmission } from '@/utils/revalidation'
import { FolderCardTab } from '@/components/views/folder-card-components/folder-card-tab'
import { GridLayout } from '@/components/views/grid-view'
import { itemVariants } from '@/components/views/variants'
import { usePagination } from '@/hooks/usePagination'
import { getFavoritedItems } from '@/services/item-actions'
import { getQueryParam } from '@/utils/query-params'
import { motion } from 'framer-motion'
import { redirect, type ShouldRevalidateFunction } from 'react-router'
import type { Route } from './+types/favorites'
import { SelectionProvider } from '../../components/stash/selection'
import { FileCardDetail } from '@/components/core-components/file-card-variants';



export const shouldRevalidate: ShouldRevalidateFunction = ({
  formData,
  formAction,
  defaultShouldRevalidate,
}) => {
  // Background search-index writes (OCR pages, chunk embeddings) change no
  // rendered data. Without this, a 15-page OCR run re-ran this loader ~30
  // times for nothing.
  if (isSearchIndexSubmission(formData)) return false

  if (
    formAction &&
    ['sidebar', 'theme'].some((action) => formAction.includes(action))
  ) {
    return false
  }
  
  if (
    formData?.get('intent') === 'move_item' ||
    formData?.get('intent') === 'favorite' ||
    formData?.get('intent') === 'unfavorite' ||
    formData?.get('intent') === 'trash_item' ||
    formData?.get('intent') === 'rename_item'
  ) {
    return true
  }

  return defaultShouldRevalidate
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const session = context.get(sessionContext)

  const url = new URL(request.url)
  const cursor = getQueryParam(url.searchParams, 'cursor') ?? undefined

  return getFavoritedItems({ userId: session.user.id, cursor })
}

export default function Favorites() {
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
          No favorites yet. Heart an item to see it here.
        </p>
      )}
      <div className="col-span-full flex justify-center mt-2">
        <LoadMoreItems loadMore={loadMore} isLoading={isLoading} hasMore={hasMore} />
      </div>
    </div>
  )
}
