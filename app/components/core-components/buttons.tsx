import {
  DeleteIcon,
  FavoriteIcon,
  LoaderIcon,
  LoadMoreFillIcon,
  RestoreIcon,
  TrashIcon,
} from '@/components/icons'
import useConfirm from '@/hooks/useConfirm'
import { Button } from '@/ui/button'
import { getQueryParam } from '@/utils/query-params'
// import { LoaderIcon } from 'lucide-react'
import { Tooltip } from '@/ui/tooltip'
import { cn } from '@/utils/styles'
import { useCallback } from 'react'
import { href, useFetcher, useLocation, useSearchParams } from 'react-router'

const Delete = (props: React.ComponentProps<typeof Button>) => {
  let location = useLocation()
  if (!location.pathname.includes('trash')) return null
  let [searchParams] = useSearchParams()
  let fetcher = useFetcher()
  let selectedItems = getQueryParam(searchParams, 'selectedItems')

  const onDelete = useCallback(() => {
    fetcher.submit(
      { intent: 'delete_items', selectedItems: selectedItems },
      { method: 'POST', action: href('/api/items') }
    )
  }, [searchParams, fetcher])

  let { open } = useConfirm(onDelete)
  return (
    <Tooltip content="Permanently delete items">
      <Button
        variant="destructive"
        size="icon-sm"
        disabled={!selectedItems}
        onClick={() =>
          open({
            variant: 'destructive',
            title: 'Are you sure you want to delete these items?',
            description:
              'This action cannot be undone, deleted items cannot be restored.',
            confirmText: 'Delete',
            cancelProps: { variant: 'secondary', size: 'sm' },
            confirmProps: { variant: 'destructive', size: 'sm' },
          })
        }
        {...props}
      >
        <DeleteIcon className="size-5!" />
      </Button>
    </Tooltip>
  )
}

const MoveToTrash = (props: React.ComponentProps<typeof Button>) => {
  let fetcher = useFetcher()
  let [searchParams] = useSearchParams()
  let location = useLocation()
  if (location.pathname.includes('trash')) return null

  let selectedItems = getQueryParam(searchParams, 'selectedItems')
  return (
    <Tooltip content="Move to Trash">
      <Button
        variant="destructive"
        onClick={() => {
          fetcher.submit(
            { intent: 'trash_items', selectedItems },
            { method: 'POST', action: href('/api/items') }
          )
        }}
        disabled={!selectedItems}
        {...props}
      >
        <TrashIcon className="size-5!" />
      </Button>
    </Tooltip>
  )
}

const Restore = (props: React.ComponentProps<typeof Button>) => {
  let fetcher = useFetcher()
  let location = useLocation()
  let [searchParams] = useSearchParams()
  if (!location.pathname.includes('trash')) return null

  let selectedItems = getQueryParam(searchParams, 'selectedItems')
  return (
    <Tooltip content="Restore items">
      <Button
        size="icon-sm"
        disabled={!selectedItems}
        onClick={() => {
          fetcher.submit(
            { intent: 'restore_items', selectedItems },
            { method: 'POST', action: href('/api/items') }
          )
        }}
        {...props}
      >
        <RestoreIcon className="size-5!" />
      </Button>
    </Tooltip>
  )
}

const FavoriteItems = (props: React.ComponentProps<typeof Button>) => {
  let fetcher = useFetcher()
  let [searchParams] = useSearchParams()
  let selectedItems = getQueryParam(searchParams, 'selectedItems')
  return (
    <Tooltip content="Favorite items">
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={!selectedItems}
        onClick={() => {
          fetcher.submit(
            { intent: 'favorite_items', selectedItems },
            { method: 'POST', action: href('/api/favorites') }
          )
        }}
        {...props}
      >
        <FavoriteIcon className="size-5!" />
      </Button>
    </Tooltip>
  )
}

const LoadMoreItems = ({
  loadMore,
  isLoading,
  hasMore,
  className,
  children,
  ...props
}: React.ComponentProps<typeof Button> & {
  loadMore: () => void
  isLoading: boolean
  hasMore: boolean
}) => {
  return (
    <Button
      onClick={() => loadMore()}
      disabled={isLoading}
      hidden={!hasMore}
      variant="default"
      className={cn('mx-auto', className)}
      {...props}
    >
      {children || (
        <>
          <LoadMoreFillIcon
            className={cn('size-5 rotate-45 mr-1', isLoading && 'hidden')}
          />
          <LoaderIcon
            className={cn('size-5 animate-spin', !isLoading && 'hidden')}
          />
        </>
      )}
      Load More
    </Button>
  )
}
export { Delete, FavoriteItems, LoadMoreItems, MoveToTrash, Restore }
