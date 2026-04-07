import { auth } from '@/.server/auth'
import { findAllCollections } from '@/services/collection-actions'
import { CollectionsView } from '@/components/views/collections-view'
import { redirect, data } from 'react-router'
import type { Route } from './+types/collections'

export { ErrorBoundary } from '@/components/error-boundary'

export async function loader({ request }: Route.LoaderArgs) {
  const session = await auth.api.getSession(request)
  if (!session) throw redirect('/auth/signin')

  const collections = await findAllCollections({
    where: {
      item: { ownerId: session.user.id, status: 'normal' },
    },
    orderBy: { item: { createdAt: 'desc' } },
  })

  return { collections }
}

export default function Collections({ loaderData }: Route.ComponentProps) {
  return <CollectionsView collections={loaderData.collections} />
}
