import { LoadMoreItems } from '@/components/core-components/buttons'
import { isSearchIndexSubmission } from '@/utils/revalidation'
import { FileCardDetail } from '@/components/core-components/file-card-variants'
import { FolderCardTab } from '@/components/views/folder-card-components/folder-card-tab'
import { GridLayout } from '@/components/views/grid-view'
import { usePagination } from '@/hooks/usePagination'
import { requireSession } from '@/services/session-context'
import { breadcrumbs } from '@/services/breadcrumbs'
import { prisma } from '@/services/db'
import {
  getFolderContent,
  retrieveFolderStats,
  updateItemOpenedAt,
} from '@/services/item-actions'
import { formatSize } from '@/utils/formaters'
import { StashPageToolbar } from '@/components/views/stash-page-toolbar'
import type { LibraryStats } from '@/types/stash.types'
import {
  buildItemFilters,
  itemFilterSchema,
} from '@/utils/filters/item.filters'
import { parseSearchParams } from '@/utils/parsers'
import { getQueryParamArray } from '@/utils/query-params'
import { type ShouldRevalidateFunction } from 'react-router'
import { SelectionProvider } from '../../components/stash/selection'
import type { Route } from './+types/folder'
export async function loader({ request, params, context }: Route.LoaderArgs) {
  // Set by the layout middleware, which redirects anonymous requests before any
  // loader runs — so there is nothing to re-check here.
  const session = requireSession(context)

  // This route serves two URL trees: /:me/stash/folders/:folderId and
  // /:me/workspaces/:workspaceId/folders/:folderId. `workspaceId` is present
  // only on the second, and is what decides the scope of everything below.
  // The access check itself lives in getFolderContent — loaders forward scope,
  // actions decide authority.
  const workspaceId = params.workspaceId

  let url = new URL(request.url)
  let searchParams = url.searchParams
  searchParams.set('currentUserId', session.user.id)
  searchParams.set('parentId', params.folderId)

  let parsedParams = parseSearchParams({
    schema: itemFilterSchema,
    searchParams,
  })

  let filters = buildItemFilters(parsedParams)

  const [_, folderContent, crumbs, folder, scope] = await Promise.all([
    updateItemOpenedAt(params.folderId),
    getFolderContent({
      userId: session.user.id,
      workspaceId,
      cursor: parsedParams.cursor,
      limit: parsedParams.take,
      where: { ...filters, parentId: params.folderId, ...(workspaceId ? { workspaceId } : {}) },
      orderBy: parsedParams.orderBy,
      foldersFirst: true
    }),
    breadcrumbs(params.folderId, session.user.id),
    prisma.item.findUnique({
      where: { id: params.folderId },
      select: { name: true, driveId: true },
    }),
    // retrieveUserUsageMetrics(session.user.id),
    retrieveFolderStats(params.folderId),
  ])


  // The owner-vs-recipient trim now lives inside breadcrumbs(), so all three
  // callers get it rather than only this one.

  return {
    ...folderContent,
    crumbs,
    me: params.me,
    folderName: folder?.name ?? null,
    driveId: folder?.driveId ?? '',
    // Formatted server-side so the BigInt byte counts stay out of the payload.
    // Counts are folder-scoped; the storage meter stays drive-wide.
    stats: {
      folders: scope.folders,
      files: scope.files,
      // favorites: stats.favorites,
      // trashed: stats.trashed,
      size: formatSize('byte', 'unit', Number(scope.sizeBytes)),
      // quota: formatSize('byte', 'unit', Number(stats.quotaBytes)),
      // usedPercent:
      //   stats.quotaBytes > 0n
      //     ? Math.round(Number((stats.usedBytes * 100n) / stats.quotaBytes))
      //     : 0,
    } 
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

  return defaultShouldRevalidate
}

export default ({ loaderData, params }: Route.ComponentProps) => {
  let { items, loadMore, isLoading, hasMore } = usePagination<
    Route.ComponentProps['loaderData']['items'][number]
  >(50, '')
  return (
    <div className="w-full h-full relative space-y-4">
      {/* SelectionProvider must wrap the toolbar too — it reads the shared
          selection actor and only enters bulk mode once this route's ids are
          registered. */}
      <SelectionProvider items={items.map((i) => i.id)}>
        <StashPageToolbar
          stats={loaderData.stats}
          items={items}
          parentId={params.folderId}
          parentName={loaderData.folderName}
          driveId={loaderData.driveId}
        />
        <GridLayout>
          {items.map((item) =>
            item.type === 'folder' ? (
              <FolderCardTab key={item.id} {...item} />
            ) : (
              <FileCardDetail key={item.id} item={item} showActions/>
            )
          )}
        </GridLayout>
      </SelectionProvider>
      <div className="col-span-full flex justify-center mt-2">
        <LoadMoreItems
          loadMore={loadMore}
          isLoading={isLoading}
          hasMore={hasMore}
        />
      </div>
    </div>
  )
}
