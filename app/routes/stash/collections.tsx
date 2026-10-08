import { sessionContext } from '@/.server/middleware/context'
import {
  findAllCollections,
  getCollectionCovers,
} from '@/services/collection-actions'
import { CollectionsView } from '@/components/views/collections-view'
import { redirect, data } from 'react-router'
import type { Route } from './+types/collections'
import { parseSearchParams } from '@/utils/parsers'
import { toSearchSchema } from '@/utils'
import type { Prisma } from '@/prisma/client'
import { itemFilterSchema } from '@/utils/filters/item.filters'

export { ErrorBoundary } from '@/components/error-boundary'

export async function loader({ request, context }: Route.LoaderArgs) {
  const session = context.get(sessionContext)

  const parsedParams = parseSearchParams({
    schema: toSearchSchema<
      typeof itemFilterSchema,
      Prisma.ItemOrderByWithRelationInput,
      Prisma.ItemInclude
    >({ schema: itemFilterSchema }),
    request
  })

  const raw = await findAllCollections({
    where: { ownerId: session.user.id, status: 'normal' },
    orderBy: parsedParams.orderBy ?? { createdAt: 'desc' },
  })

  const covers = await getCollectionCovers(
    session.user.id,
    raw.map((col) => col.id)
  )

  const collections = raw.map((col) => ({
    id: col.id,
    name: col.name,
    size: col.size,
    itemCount: col.collectionItems.length,
    covers: covers[col.id] ?? [],
  }))

  return { collections }
}

export default function Collections({ loaderData }: Route.ComponentProps) {
  return <CollectionsView collections={loaderData.collections} />
}
