import { auth } from '@/.server/auth'
import {
  getCollectionForUser,
  getCollectionItems,
} from '@/services/collection-actions'
import { paginateItems, touchOpenedAt } from '@/services/item-actions'
import { CollectionView } from '@/components/views/collection-view'
import { redirect, useParams } from 'react-router'
import type { Route } from './+types/collection'
import { usePagination } from '@/hooks/usePagination'

export { ErrorBoundary } from '@/components/error-boundary'

export async function loader({ request, params }: Route.LoaderArgs) {
  const session = await auth.api.getSession(request)
  if (!session) throw redirect('/auth/signin')

  const { collectionId } = params
  const url = new URL(request.url)
  const cursor = url.searchParams.get('cursor') ?? undefined
  const limit = Number(url.searchParams.get('take') ?? 50)

  const [collection, { items, nextCursor }, allItems] = await Promise.all([
    getCollectionForUser(session.user.id, collectionId),
    getCollectionItems(session.user.id, collectionId, limit, cursor),
    // Fetch the user's items to populate the add-to-collection picker
    paginateItems({
      limit: 500,
      cursor,
      where: {
        ownerId: session.user.id,
        status: 'normal',
        type: { not: 'collection' },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        thumbnails: {
          select: {
            height: true,
            width: true,
            url: true,
            size: true,
            id: true,
            stage: true,
          },
        },
      },
    }),
  ])

  // Map to lightweight shape for the picker
  const availableItems = allItems.items.map((item) => ({
    id: item.id,
    name: item.name,
    type: item.type,
    category: item.category,
    size: item.size,
    createdAt: item.createdAt,
    thumbnailUrl: item.thumbnails?.find((t) => t.url && !t.url.startsWith('#'))?.url ?? null,
  }))

  Promise.resolve()
    .then(() => touchOpenedAt(collectionId))
    .catch(() => {})

  // IDs already in this collection
  const existingItemIds = collection.collectionItems.map((cm) => cm.itemId)

  return {
    collection: {
      id: collection.id,
      name: collection.name,
      size: collection.size,
      itemCount: collection.collectionItems.length,
    },
    items,
    nextCursor: nextCursor ?? null,
    hasMore: nextCursor !== undefined,
    availableItems,
    existingItemIds,
  }
}

export default function Collection({ loaderData }: Route.ComponentProps) {
  const params = useParams()
  const me = params.me as string

  const { items, hasMore, isLoading, loadMore } =
    usePagination<Route.ComponentProps['loaderData']['items'][number]>(50)

  return (
    <CollectionView
      collection={loaderData.collection}
      items={items}
      availableItems={loaderData.availableItems}
      existingItemIds={loaderData.existingItemIds}
      hasMore={hasMore}
      isLoading={isLoading}
      loadMore={loadMore}
      collectionsHref={`/${me}/stash/collections`}
    />
  )
}
