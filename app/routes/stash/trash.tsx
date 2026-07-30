import { AppToolbar } from '@/components/app-toolbar'
import { FileCard } from '@/components/core-components/file-card'
import { SelectionProvider } from '@/components/stash/selection'
import { TrashEmptyState } from '@/components/states/trash-empty-state'
import { FolderCardTab } from '@/components/views/folder-card-components/folder-card-tab'
import { GridLayout } from '@/components/views/grid-view'
import { usePagination } from '@/hooks/usePagination'
import { auth } from '@/services/auth'
import {
  buildItemFilters,
  itemFilterSchema,
} from '@/utils/filters/item.filters'
import { getPaginatedItems } from '@/services/item-actions'
import { parseSearchParams } from '@/utils/parsers'
import { redirect } from 'react-router'
import { Fragment } from 'react/jsx-runtime'
import type { Route } from './+types/trash'
import { LoadMoreItems } from '@/components/core-components/buttons'

export { ErrorBoundary } from '@/components/error-boundary'

export async function loader({ request }: Route.LoaderArgs) {
  const session = await auth.api.getSession({
    headers: request.headers,
  })
  if (!session) throw redirect('/auth/signin')
  let searchParams = new URL(request.url).searchParams
  searchParams.set('currentUserId', session.user.id)
  searchParams.set('status', 'trashed')
  let layout = searchParams.get('layout')
  let parsedParams = parseSearchParams({
    schema: itemFilterSchema,
    searchParams,
  })
  let filters = buildItemFilters(parsedParams)

  return await getPaginatedItems({
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
        },
      },
    },
  })
}

export async function action({ request, params }: Route.ActionArgs) {
  // TODO: implement action logic
  return null
}

export default () => {
  let { hasMore, items, loadMore, isLoading } =
    usePagination<Route.ComponentProps['loaderData']['items'][number]>(25)

  if (items.length === 0) {
    return <TrashEmptyState />
  }

  return (
    <Fragment>
      <SelectionProvider items={items.map((i) => i.id)}>
        <GridLayout>
          {items.map((item) =>
            item.type === 'folder' ? (
              <FolderCardTab key={item.id} {...item} />
            ) : (
              <FileCard key={item.id} item={item} />
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
