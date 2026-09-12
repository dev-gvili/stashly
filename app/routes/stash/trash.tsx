import { sessionContext } from '@/.server/middleware/context'
import { FileCardDetail } from '@/components/core-components/file-card-variants'
import { SelectionProvider } from '@/components/stash/selection'
import { TrashEmptyState } from '@/components/states/trash-empty-state'
import { FolderCardTab } from '@/components/views/folder-card-components/folder-card-tab'
import { GridLayout } from '@/components/views/grid-view'
import { usePagination } from '@/hooks/usePagination'
import {
  buildItemFilters,
  itemFilterSchema,
} from '@/utils/filters/item.filters'
import {
  getPaginatedItems,
  retrieveUserUsageMetrics,
} from '@/services/item-actions'
import { parseSearchParams } from '@/utils/parsers'
import { formatSize } from '@/utils/formaters'
import { isSearchIndexSubmission } from '@/utils/revalidation'
import type { LibraryStats } from '@/types/stash.types'
import { StashPageToolbar } from '@/components/views/stash-page-toolbar'
import { redirect, type ShouldRevalidateFunction } from 'react-router'
import { Fragment } from 'react/jsx-runtime'
import type { Route } from './+types/trash'
import { LoadMoreItems } from '@/components/core-components/buttons'

/** Intents that actually change what this page lists. */
const TRASH_MUTATION_INTENTS: ReadonlySet<string> = new Set([
  'delete_item',
  'delete_items',
  'restore_item',
  'restore_items',
  'trash_item',
  'trash_items',
])

/**
 * Everything on this page is a fetcher away from a loader re-run: React Router
 * revalidates every active loader after any fetcher submission, and
 * `useSelectionURLSync` writes `?selectedItems=` as a navigation. Unguarded,
 * emptying a folder with hundreds of descendants fired hundreds of
 * `stash/trash.data` GETs — one per selection write and one per background
 * thumbnail/index submission. The delete itself was always a single POST
 * (`Item.parentId` is `onDelete: Cascade`, so the DB removes the subtree).
 */
export const shouldRevalidate: ShouldRevalidateFunction = ({
  currentUrl,
  nextUrl,
  formMethod,
  formAction,
  formData,
  defaultShouldRevalidate,
}) => {
  // Background search-index writes (OCR pages, chunk embeddings) can't change
  // a trashed card.
  if (isSearchIndexSubmission(formData)) return false

  const intent = formData?.get('intent')
  if (typeof intent === 'string' && TRASH_MUTATION_INTENTS.has(intent)) {
    return true
  }

  // Anything submission-driven — including the navigation the `/api/items`
  // redirect turns into — keeps the default. Only plain GET navigations fall
  // through to the selection check below, so a mutation can never be skipped.
  const isSubmission = Boolean(formMethod || formAction || formData)
  if (isSubmission) return defaultShouldRevalidate

  // Selection-only churn: same path, same filters, only `selectedItems` moved.
  // `useSelectionURLSync` writes that param on every check/uncheck, and each
  // write is a navigation — without this the loader ran on all of them.
  if (currentUrl.pathname === nextUrl.pathname) {
    const withoutSelection = (url: URL) => {
      const params = new URLSearchParams(url.searchParams)
      params.delete('selectedItems')
      params.sort()
      return params.toString()
    }
    if (withoutSelection(currentUrl) === withoutSelection(nextUrl)) return false
  }

  return defaultShouldRevalidate
}

export { ErrorBoundary } from '@/components/error-boundary'

export async function loader({ request, context }: Route.LoaderArgs) {
  const session = context.get(sessionContext)
  let searchParams = new URL(request.url).searchParams
  searchParams.set('currentUserId', session.user.id)
  searchParams.set('status', 'trashed')
  let layout = searchParams.get('layout')
  let parsedParams = parseSearchParams({
    schema: itemFilterSchema,
    searchParams,
  })
  let filters = buildItemFilters(parsedParams)

  let [page, stats] = await Promise.all([
    getPaginatedItems({
      where: filters,
      ...parsedParams,
      orderBy: parsedParams.orderBy ?? { name: 'asc' },
      include: {
        file: true,
        folder: {
          select: {
            id: true,
            childCount: true,
            inclusiveChildCount: true,
            itemId: true,
          },
        },
        parent: {
          include: {
            file: true,
            folder: true,
            favorites: {
              select: {
                id: true,
                favoritedBy: {
                  select: {
                    displayName: true,
                    image: true,
                    name: true,
                    id: true,
                  },
                },
              },
            },
            locked: true,
            thumbnails: {
              where: {
                size: {
                  equals: 'large',
                },
                view: layout,
              },
              select: {
                url: true,
                width: true,
                height: true,
                size: true,
                view: true,
                id: true,
                stage: true,
              },
            },
          },
        },
        favorites: {
          select: {
            id: true,
            favoritedBy: {
              select: {
                displayName: true,
                image: true,
                name: true,
                id: true,
              },
            },
          },
        },
        locked: true,
        thumbnails: {
          where: {
            size: {
              equals: 'large',
            },
            view: layout,
          },
          select: {
            url: true,
            width: true,
            height: true,
            size: true,
            view: true,
            id: true,
            stage: true,
          },
        },
      },
    }),
    retrieveUserUsageMetrics(session.user.id),
  ])

  // Formatted server-side so the BigInt byte counts never reach the client
  // payload — same contract `all.tsx` uses.
  return {
    ...page,
    stats: {
      folders: stats.folders,
      files: stats.files,
      favorites: stats.favorites,
      trashed: stats.trashed,
      size: formatSize('byte', 'unit', Number(stats.usedBytes)),
      quota: formatSize('byte', 'unit', Number(stats.quotaBytes)),
      usedPercent:
        stats.quotaBytes > 0n
          ? Math.round(Number((stats.usedBytes * 100n) / stats.quotaBytes))
          : 0,
    } satisfies LibraryStats,
  }
}

export async function action({ request, params, context }: Route.ActionArgs) {
  // TODO: implement action logic
  return null
}

export default ({ loaderData }: Route.ComponentProps) => {
  let { hasMore, items, loadMore, isLoading } =
    usePagination<Route.ComponentProps['loaderData']['items'][number]>(25)

  if (items.length === 0) {
    return <TrashEmptyState />
  }

  return (
    <Fragment>
      {/* SelectionProvider must wrap the toolbar too — the rail reads the
          shared selection actor and only enters bulk mode once this route's
          ids are registered. */}
      <SelectionProvider items={items.map((i) => i.id)}>
        <StashPageToolbar
          context="trash"
          stats={loaderData.stats}
          items={items}
        />
        <GridLayout>
          {items.map((item) =>
            item.type === 'folder' ? (
              <FolderCardTab key={item.id} {...item} />
            ) : (
              <FileCardDetail key={item.id} item={item} />
            )
          )}
        </GridLayout>
      </SelectionProvider>
      <div className="col-span-full flex justify-center items-center h-full py-4">
        <LoadMoreItems
          loadMore={loadMore}
          isLoading={isLoading}
          hasMore={hasMore}
        />
      </div>
    </Fragment>
  )
}
