import { sessionContext } from '@/.server/middleware/context'
import type { Route } from './+types/home'
import { isSearchIndexSubmission } from '@/utils/revalidation'
import { redirect } from 'react-router'
import type { ShouldRevalidateFunction } from 'react-router'
import { getQueryParamArray } from '@/utils/query-params'
import { OverviewView } from '@/components/views/overview-components'
import type { StashItem } from '@/types/stash.types'
import { getSuggestedItems, retrieveUserUsageMetrics } from '@/services/item-actions'
import { getPinnedItems } from '@/services/pin-actions'
import { getFavoritedItems } from '@/services/item-actions'
import { getRecentActivityForUser } from '@/services/activity-actions'
import { getStorageSummary } from '@/services/storage-actions'

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
  // Background search-index writes (OCR pages, chunk embeddings) change no
  // rendered data. Without this, a 15-page OCR run re-ran this loader ~30
  // times for nothing.
  if (isSearchIndexSubmission(formData)) return false

  let currentSelectedItems = getQueryParamArray(
    currentUrl.searchParams,
    'selectedItems'
  )
  let nextSelectedItems = getQueryParamArray(
    nextUrl.searchParams,
    'selectedItems'
  )

  ;['sidebar', 'theme'].forEach((action) => {
    if (formAction?.includes(action)) {
      return false
    }
  })

  if (
    formData?.get('intent') === 'move_items' ||
    formData?.get('intent') === 'trash_items' ||
    formData?.get('intent') === 'create_folder'
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

export async function loader({ request, context }: Route.LoaderArgs) {
  const session = context.get(sessionContext)

  // The overview asks for eleven cards under "Recently opened" (the first is
  // the hero, two columns wide and two rows tall, with ten filling the five
  // columns beside it) and eight favorites, so raise the fetch limits to match
  // the layout.
  const [suggestions, pinned, favorites, activity, stats, storage] =
    await Promise.all([
      getSuggestedItems({
        userId: session.user.id,
        driveId: session.user.driveId,
        rootId: session.user.rootId,
        maxFolders: 6,
        maxFiles: 11,
      }),
      getPinnedItems({ userId: session.user.id, limit: 4 }),
      getFavoritedItems({ userId: session.user.id, limit: 8 }),
      getRecentActivityForUser({ userId: session.user.id, limit: 12 }),
      retrieveUserUsageMetrics(session.user.id),
      getStorageSummary(session.user.id),
    ])

  return {
    suggestedFolders: suggestions.suggestedFolders,
    suggestedFiles: suggestions.suggestedFiles,
    pinned: pinned.items,
    favorites: favorites.items,
    activity,
    stats,
    storage,
    user: session.user,
  }
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const {
    user,
    suggestedFolders,
    suggestedFiles,
    pinned,
    favorites,
    activity,
    stats,
    storage,
  } = loaderData

  return (
    <OverviewView
      user={{ id: user.id, name: user.name }}
      subline={`${stats.folders.toLocaleString()} folders · ${stats.files.toLocaleString()} files`}
      suggestedFolders={suggestedFolders}
      suggestedFiles={suggestedFiles}
      pinned={pinned as StashItem[]}
      favorites={favorites as unknown as StashItem[]}
      activity={activity}
      storage={storage ?? undefined}
      trash={stats.trashed > 0 ? { count: stats.trashed } : undefined}
    />
  )
}
