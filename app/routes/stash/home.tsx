import type { Route } from './+types/home'
import { auth } from '@/services/auth'
import { redirect } from 'react-router'
import type { ShouldRevalidateFunction } from 'react-router'
import { getQueryParamArray } from '@/utils/query-params'
import { OverviewView } from '@/components/views/overview-view'
import type { StashItem } from '@/types/stash.types'
import { getSuggestedItems } from '@/services/item-actions'
import { getPinnedItems } from '@/services/pin-actions'
import { getFavoritedItems } from '@/services/item-actions'
import { getRecentActivityForUser } from '@/services/activity-actions'

export { ErrorBoundary } from '@/components/error-boundary'

export function meta({ matches }: Route.MetaArgs) {
  let userName = matches[1].loaderData?.user.name
  return [
    { title: `Stashly - ${userName ? `${userName}'s Stash` : 'Stash'}` },
    { description: 'Stash' },
    {
      name: 'og:title',
      content: `Stashly - ${userName ? `${userName}'s Stash` : 'Stash'}`,
    },
    {
      name: 'og:description',
      content: `Stashly - ${userName ? `${userName}'s Stash` : 'Stash'}`,
    },
  ]
}

export const shouldRevalidate: ShouldRevalidateFunction = ({
  nextUrl,
  currentUrl,
  formAction,
  formData,
  defaultShouldRevalidate,
}) => {
  let currentSelectedItems = getQueryParamArray(
    currentUrl.searchParams,
    'selectedItems'
  )
  let nextSelectedItems = getQueryParamArray(
    nextUrl.searchParams,
    'selectedItems'
  )

  ;['favorites', 'sidebar', 'theme'].forEach((action) => {
    if (formAction?.includes(action)) {
      return false
    }
  })

  if (
    formData?.get('intent') === 'move_items' ||
    formData?.get('intent') === 'trash_items' ||
    formData?.get('intent') === 'create_folder' ||
    formData?.get('intent') === 'create_upload_item'
  ) {
    return true
  }

  if (
    currentSelectedItems.length !== nextSelectedItems.length &&
    currentUrl.pathname === nextUrl.pathname
  ) {
    return false
  }

  return true
}

export async function loader({ request }: Route.LoaderArgs) {
    const session = await auth.api.getSession({
    headers: request.headers,
  })
  if (!session) {
    throw redirect('/auth/signin')
  }

  const [suggestions, pinned, favorites, activity] = await Promise.all([
    getSuggestedItems({
      userId: session.user.id,
      driveId: session.user.driveId,
      rootId: session.user.rootId,
      maxFolders: 6,
      maxFiles: 10,
    }),
    getPinnedItems({ userId: session.user.id, limit: 6 }),
    getFavoritedItems({ userId: session.user.id, limit: 6 }),
    getRecentActivityForUser({ userId: session.user.id, limit: 8 }),
  ])

  return {
    suggestedFolders: suggestions.suggestedFolders,
    suggestedFiles: suggestions.suggestedFiles,
    pinned: pinned.items,
    favorites: favorites.items,
    activity,
    user: session.user,
  }
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { user, suggestedFolders, suggestedFiles, pinned, favorites, activity } = loaderData
  return (
    <OverviewView
      user={{ id: user.id, name: user.name }}
      suggestedFolders={suggestedFolders}
      suggestedFiles={suggestedFiles}
      pinned={pinned as StashItem[]}
      favorites={favorites as unknown as StashItem[]}
      activity={activity}
    />
  )
}
