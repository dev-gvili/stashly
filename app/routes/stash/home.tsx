import { sessionContext } from '@/.server/middleware/context'
import type { Route } from './+types/home'
import { isSearchIndexSubmission } from '@/utils/revalidation'
import { href, useFetcher } from 'react-router'
import type { ShouldRevalidateFunction } from 'react-router'
import { getQueryParamArray } from '@/utils/query-params'
import { HomeView } from '@/components/views/home-components/home-view'
import {
  toChipQueries,
  toHomeCollection,
  toHomeFile,
  toNeedsYouEntries,
  toQueueEntries,
} from '@/components/views/home-components/home-data'
import type { HomeFile, NeedsYouEntry } from '@/types/home.types'
import type { StashItem } from '@/types/stash.types'
import { getSuggestedItems } from '@/services/item-actions'
import { getPinnedItems } from '@/services/pin-actions'
import {
  findAllCollections,
  getCollectionMosaics,
} from '@/services/collection-actions'
import { listReceivedInvitations } from '@/services/invitation-actions'
import {
  getIndexedItemIds,
  getSearchableCoverage,
} from '@/services/search-actions'

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

  if (['sidebar', 'theme'].some((action) => formAction?.includes(action))) {
    return false
  }

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

export async function loader({ context }: Route.LoaderArgs) {
  const session = context.get(sessionContext)
  const userId = session.user.id

  const [suggestions, pinned, collections, invitations, coverage] =
    await Promise.all([
      getSuggestedItems({
        userId,
        driveId: session.user.driveId,
        rootId: session.user.rootId,
        maxFolders: 0,
        maxFiles: 8,
      }),
      getPinnedItems({ userId, limit: 24 }),
      findAllCollections({
        where: { ownerId: userId, status: 'normal' },
        orderBy: { updatedAt: 'desc' },
        take: 8,
      }),
      listReceivedInvitations(session.user.email),
      getSearchableCoverage(userId),
    ])

  const [mosaics, indexedIds] = await Promise.all([
    getCollectionMosaics(
      userId,
      collections.map((col) => col.id)
    ),
    getIndexedItemIds(userId, [
      ...suggestions.suggestedFiles.map((f) => f.id),
      ...pinned.items.map((f) => f.id),
    ]),
  ])

  const ctx = {
    me: userId,
    indexedIds: new Set(indexedIds),
    pinnedIds: new Set(pinned.items.map((item) => item.id)),
  }
  const recentItems = suggestions.suggestedFiles as StashItem[]
  // Pinned files not already among the recent ones, so the Pinned tab has them.
  const recentIds = new Set(recentItems.map((item) => item.id))
  const extraPinned = (pinned.items as StashItem[]).filter(
    (item) => !recentIds.has(item.id)
  )

  return {
    me: userId,
    firstName: session.user.name.split(' ')[0] ?? session.user.name,
    rootId: session.user.rootId,
    recent: [...recentItems, ...extraPinned].map((item) =>
      toHomeFile(item, ctx)
    ),
    collections: collections.map((col) =>
      toHomeCollection(
        { id: col.id, name: col.name, itemCount: col.members.length },
        mosaics[col.id] ?? [],
        userId
      )
    ),
    chips: toChipQueries(recentItems, indexedIds),
    needsYou: toNeedsYouEntries(invitations, session.user.email),
    searchable: {
      done: coverage.searchableFiles,
      total: coverage.totalFiles,
      queue: toQueueEntries(coverage.queue),
    },
  }
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { me, rootId, firstName, chips, ...data } = loaderData
  const pins = useFetcher()
  const invitations = useFetcher()

  const togglePin = (file: HomeFile) =>
    pins.submit(
      { intent: file.pinned ? 'unpin' : 'pin', itemId: file.id },
      { method: 'POST', action: '/api/pins' }
    )

  const respond = (intent: 'accept_invitation' | 'reject_invitation') =>
    (entry: NeedsYouEntry) =>
      invitations.submit(
        { intent, recipientId: entry.recipientId },
        { method: 'POST', action: '/api/invitations' }
      )

  return (
    <HomeView
      {...data}
      me={me}
      firstName={firstName}
      suggestions={chips.map((query) => ({ query, ai: true }))}
      moreHref={{
        all: href('/:me/stash/folders/:folderId', { me, folderId: rootId }),
        pinned: href('/:me/stash/pinned', { me }),
        collections: href('/:me/stash/collections', { me }),
        shared: href('/:me/stash/shares', { me }),
      }}
      onTogglePin={togglePin}
      onActOnNeed={respond('accept_invitation')}
      onDismissNeed={respond('reject_invitation')}
    />
  )
}
