import { LoadMoreItems } from '@/components/core-components/buttons'
import { FileCardDetail } from '@/components/core-components/file-card-variants'
import { FolderCardTab } from '@/components/views/folder-card-components/folder-card-tab'
import { GridLayout } from '@/components/views/grid-view'
import { usePagination } from '@/hooks/usePagination'
import { auth } from '@/services/auth'
import { breadcrumbs } from '@/services/breadcrumbs'
import { prisma } from '@/services/db'
import {
  getFolderContent,
  getFolderScopeStats,
  getLibraryStats,
  touchOpenedAt,
} from '@/services/item-actions'
import { formatSize } from '@/utils/formaters'
import { StashPageToolbar } from '@/components/views/stash-page-toolbar'
import type { LibraryStats } from '@/components/core-components/page-toolbar'
import {
  buildItemFilters,
  itemFilterSchema,
} from '@/utils/filters/item.filters'
import { parseSearchParams } from '@/utils/parsers'
import { getQueryParamArray } from '@/utils/query-params'
import {
  redirect,
  type ShouldRevalidateFunction
} from 'react-router'
import { SelectionProvider } from '../../components/stash/selection'
import type { Route } from './+types/folder'
export async function loader({ request, params }: Route.LoaderArgs) {
  let session = await auth.api.getSession({
    headers: request.headers
  })
  if (!session) throw redirect('/auth/signin')

  let url = new URL(request.url)
  let searchParams = url.searchParams
  searchParams.set('currentUserId', session.user.id)
  searchParams.set('parentId', params.folderId)

  let parsedParams = parseSearchParams({
    schema: itemFilterSchema,
    searchParams,
  })

  let filters = buildItemFilters(parsedParams)

  const [folderContent, allCrumbs, folder, stats, scope] = await Promise.all([
    getFolderContent({
      cursor: parsedParams.cursor,
      limit: parsedParams.take,
      where: { ...filters, parentId: params.folderId },
      orderBy: parsedParams.orderBy,
    }),
    breadcrumbs(params.folderId),
    prisma.item.findUnique({
      where: { id: params.folderId },
      select: { ownerId: true, name: true, driveId: true },
    }),
    getLibraryStats(session.user.id),
    getFolderScopeStats(params.folderId),
  ])

  Promise.resolve()
    .then(() => touchOpenedAt(params.folderId))
    .catch(() => {})

  const crumbs =
    folder?.ownerId === session.user.id ? allCrumbs : allCrumbs.slice(-1)

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
      favorites: stats.favorites,
      trashed: stats.trashed,
      size: formatSize('byte', 'unit', Number(scope.sizeBytes)),
      quota: formatSize('byte', 'unit', Number(stats.quotaBytes)),
      usedPercent:
        stats.quotaBytes > 0n
          ? Math.round(Number((stats.usedBytes * 100n) / stats.quotaBytes))
          : 0,
    } satisfies LibraryStats,
  }
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
              <FileCardDetail key={item.id} item={item} />
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
