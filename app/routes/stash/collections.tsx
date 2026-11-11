import { sessionContext } from '@/.server/middleware/context'
import {
  getCollectionCovers,
  listCollectionsForUser,
} from '@/services/collection-actions'
import { CollectionsView } from '@/components/views/collections-view'
import { redirect, data } from 'react-router'
import type { Route } from './+types/collections'
import { parseSearchParams } from '@/utils/parsers'
import { parseOrRespond } from '@/utils/api.errors'
import { toSearchSchema } from '@/utils'
import type { Prisma } from '@/prisma/client'
import { itemFilterSchema } from '@/utils/filters/item.filters'

export { ErrorBoundary } from '@/components/error-boundary'

export async function loader({ request, context }: Route.LoaderArgs) {
  const session = context.get(sessionContext)

  const parsedParams = parseOrRespond(() => parseSearchParams({
    schema: toSearchSchema<
      typeof itemFilterSchema,
      Prisma.ItemOrderByWithRelationInput,
      Prisma.ItemInclude
    >({ schema: itemFilterSchema }),
    request
  }), 'text')

  const raw = await listCollectionsForUser(session.user.id, parsedParams.orderBy)

  const covers = await getCollectionCovers(
    session.user.id,
    raw.map((col) => col.id)
  )

  const collections = raw.map((col) => ({
    id: col.id,
    name: col.name,
    size: col.size,
    itemCount: col.members.length,
    covers: covers[col.id] ?? [],
  }))

  return { collections }
}

export default function Collections({ loaderData }: Route.ComponentProps) {
  return <CollectionsView collections={loaderData.collections} />
}
