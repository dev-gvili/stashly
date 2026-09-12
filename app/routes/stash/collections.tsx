import { sessionContext } from '@/.server/middleware/context'
import { findAllCollections } from '@/services/collection-actions'
import { CollectionsView } from '@/components/views/collections-view'
import { redirect, data } from 'react-router'
import type { Route } from './+types/collections'
import { parseSearchParams } from '@/utils/parsers'
import { itemFilterSchema } from '@/utils/filters/item.filters'

export { ErrorBoundary } from '@/components/error-boundary'

export async function loader({ request, context }: Route.LoaderArgs) {
  const session = context.get(sessionContext)

  const parsedParams = parseSearchParams({
    schema: itemFilterSchema,
    request
  })

  const raw = await findAllCollections({
    where: { ownerId: session.user.id, status: 'normal' },
    orderBy: parsedParams.orderBy ?? { createdAt: 'desc' },
  })

  const collections = raw.map((col) => ({
    id: col.id,
    name: col.name,
    size: col.size,
    itemCount: col.collectionItems.length,
  }))

  return { collections }
}

export default function Collections({ loaderData }: Route.ComponentProps) {
  return <CollectionsView collections={loaderData.collections} />
}
