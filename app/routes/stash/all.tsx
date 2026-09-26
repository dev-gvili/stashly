import { sessionContext } from '@/.server/middleware/context'
import type { Route } from './+types/all'
import { isSearchIndexSubmission } from '@/utils/revalidation'
import { redirect, useLocation } from 'react-router'
import { getFolderContent, retrieveUserUsageMetrics } from '@/services/item-actions'
import { formatSize } from '@/utils/formaters'
import { StashPageToolbar } from '@/components/views/stash-page-toolbar'
import type { LibraryStats } from '@/types/stash.types'
import {
  buildItemFilters,
  itemFilterSchema,
} from '@/utils/filters/item.filters'
import { parseSearchParams } from '@/utils/parsers'
import { toSearchSchema } from '@/utils'
import type { Prisma } from '@/prisma/client'
import { GridLayout } from '@/components/views/grid-view'
import { FileCardDetail } from '@/components/core-components/file-card-variants'
import { FolderCardTab } from '@/components/views/folder-card-components/folder-card-tab'
import { Button } from '@/components/ui/button'
import { usePagination } from '@/hooks/usePagination'
import { motion } from 'framer-motion'
import { itemVariants } from '@/components/views/variants'
import { Fragment, useId } from 'react'
import { ListLayout } from '@/components/views/list-view'
import type { ShouldRevalidateFunction } from 'react-router'
import { LoaderIcon, SubmitIcon } from '../../components/icons'
import { cn } from '../../utils/styles'
import { SelectionProvider } from '../../components/stash/selection'
import { LoadMoreItems } from '../../components/core-components/buttons'
import { getQueryParamArray } from '../../utils/query-params'
import { FilesEmptyState } from '../../components/states/files-empty-state'
import { breadcrumbs } from '@/services/breadcrumbs';

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
    currentSelectedItems.some((item) => !nextSelectedItems.includes(item)) &&
    currentUrl.pathname === nextUrl.pathname
  ) {
    return false
  }

  return defaultShouldRevalidate
}

export async function loader({ request, params, context }: Route.ActionArgs) {
  const session = context.get(sessionContext)

  let searchParams = new URL(request.url).searchParams
  searchParams.set('currentUserId', session.user.id)
  searchParams.set('parentId', session.user.rootId)
  let parsedParams = parseSearchParams({
    schema: toSearchSchema<
      typeof itemFilterSchema,
      Prisma.ItemOrderByWithRelationInput,
      Prisma.ItemInclude
    >({ schema: itemFilterSchema }),
    searchParams,
  })

  let filters = buildItemFilters(parsedParams)

  let [folderContent, stats, crumbs] = await Promise.all([
    getFolderContent({
      userId: session.user.id,
      cursor: parsedParams.cursor,
      limit: parsedParams.take,
      where: { ...filters, parentId: session.user.rootId },
      orderBy: parsedParams.orderBy,
      foldersFirst: true,
    }),
    retrieveUserUsageMetrics(session.user.id),
    breadcrumbs(session.user.rootId, session.user.id),
  ])

  // Format on the server: `LibraryStats` is all strings/numbers, which keeps
  // the BigInt byte counts out of the serialized loader payload.
  return {
    ...folderContent,
    crumbs,
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

export default function Index({ loaderData }: Route.ComponentProps) {
  let id = useId()
  let location = useLocation()
  let { items, loadMore, isLoading, hasMore } = usePagination<
    Route.ComponentProps['loaderData']['items'][number]
  >(50, '?index')
  if (items.length === 0) return <FilesEmptyState />

  return (
    <Fragment key={id}>
      {/* SelectionProvider must wrap the toolbar too — PageToolbarPathRail reads
          the shared selection actor and only enters bulk mode when this route's
          ids are registered. */}
      <SelectionProvider items={items.map((i) => i.id)}>
        <StashPageToolbar stats={loaderData.stats} items={items} parentName={location.state?.name ?? location.pathname.split('/').pop()} />
        <ListLayout items={items} />
        <GridLayout>
          {items?.map((item) =>
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
