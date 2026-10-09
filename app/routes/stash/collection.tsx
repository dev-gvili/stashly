import { sessionContext } from '@/.server/middleware/context'
import { isSearchIndexSubmission } from '@/utils/revalidation'
import {
  getCollectionForUser,
  getCollectionItems,
} from '@/services/collection-actions'
import { paginateItems } from '@/services/item-actions'
import { CollectionView } from '@/components/views/collection-view'
import {
  redirect,
  useParams,
  type ShouldRevalidateFunction,
} from 'react-router'
import type { Route } from './+types/collection'
import { usePagination } from '@/hooks/usePagination'
import { useEffect } from 'react'
import { parseSearchParams } from '@/utils/parsers'
import { toSearchSchema } from '@/utils'
import {
  buildItemFilters,
  itemFilterSchema,
} from '@/utils/filters/item.filters'
import type { Prisma } from '@/prisma/client'

export { ErrorBoundary } from '@/components/error-boundary'

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const session = context.get(sessionContext)

  const { collectionId } = params
  const url = new URL(request.url)
  const searchParams = url.searchParams

  let parsedParams = parseSearchParams({
    schema: toSearchSchema<
      typeof itemFilterSchema,
      Prisma.ItemOrderByWithRelationInput,
      Prisma.ItemInclude
    >({ schema: itemFilterSchema }),
    searchParams,
  })

  let filters = buildItemFilters(parsedParams)

  const [collection, { items, nextCursor }, allItems] = await Promise.all([
    getCollectionForUser(session.user.id, collectionId),
    getCollectionItems(
      session.user.id,
      collectionId,
      parsedParams.take,
      parsedParams.cursor
    ),
    // Fetch the user's items to populate the add-to-collection picker
    paginateItems({
      limit: parsedParams.take,
      cursor: parsedParams.cursor,
      where: {
        ...filters,
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
            bucket: true,
            color: true,
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
    thumbnailUrl:
      item.thumbnails?.find((t) => t.url && !t.url.startsWith('#'))?.url ??
      null,
  }))

  // IDs already in this collection
  const existingItemIds = collection.members.map((cm) => cm.itemId)

  return {
    collection: {
      id: collection.id,
      name: collection.name,
      size: collection.size,
      itemCount: collection._count.members,
    },
    items,
    nextCursor: nextCursor ?? null,
    hasMore: nextCursor !== undefined,
    availableItems,
    existingItemIds,
  }
}

export const shouldRevalidate: ShouldRevalidateFunction = ({
  nextUrl,
  currentUrl,
  formAction,
  formData,
  defaultShouldRevalidate,
}) => {
  // Background search-index writes (OCR pages, chunk embeddings) change no
  // rendered data. Without this, a 15-page OCR run re-ran this loader ~30
  // times for nothing.
  if (isSearchIndexSubmission(formData)) return false

  ;['sidebar', 'theme'].forEach((action) => {
    if (formAction?.includes(action)) {
      return false
    }
  })

  if (
    formData?.get('intent') === 'add_item_to_collection' ||
    formData?.get('intent') === 'add_items_to_collection' ||
    formData?.get('intent') === 'remove_items_from_collection' ||
    formData?.get('intent') === 'remove_item_from_collection'
  ) {
    return true
  }

  return defaultShouldRevalidate
}

export default function Collection({
  loaderData,
  params,
}: Route.ComponentProps) {
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
      collectionsHref={`/${params.me}/stash/collections`}
    />
  )
}
