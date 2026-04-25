import {
  ActivityIcon,
  CopyIcon,
  DeleteIcon,
  DownloadIcon,
  FileDetailsIcon,
  HeartIcon,
  LockIcon,
  MenuDotsIcon,
  MoveToFolder,
  PreviewIcon,
  RenameIcon,
  RestoreIcon,
  ShareItemIcon,
  TrashIcon,
} from '@/components/icons'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/ui/dropdown-menu'
import { useFetcher } from 'react-router'
import React, { useCallback } from 'react'
import useConfirm from '@/hooks/useConfirm'
import { toFavorite } from '@/utils/converters'
import { useItemCard } from '@/hooks/useItemCard'
import { ItemActivityDrawer } from '@/components/core-components/item-activity-drawer'

export const ItemActions = (
  props: React.ComponentPropsWithoutRef<typeof DropdownMenuTrigger>
) => {
  let fetcher = useFetcher()
  let { id, name, status, favorites, user } = useItemCard()
  let favorited = toFavorite({ favorites, userId: user?.id })
  const [activityOpen, setActivityOpen] = React.useState(false)
  if (fetcher.data) {
    favorited = fetcher.data?.favorited ?? favorited
  }

  let onDelete = useCallback(() => {
    fetcher.submit(
      { intent: 'delete_item', selectedItem: id },
      { method: 'POST', action: '/api/items' }
    )
  }, [id, fetcher])

  let { open } = useConfirm(onDelete)

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Delete') {
        event.preventDefault()
        event.stopPropagation()
        fetcher.submit(
          { intent: 'trash_item', selectedItem: id },
          { method: 'POST', action: '/api/items' }
        )
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <>
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger onClick={(e) => e.stopPropagation()} {...props}>
        <MenuDotsIcon className="size-6!" />
      </DropdownMenuTrigger>

      {status !== 'trashed' && (
        <DropdownMenuContent align="end" className="space-y-4 w-48">
            <DropdownMenuGroup className="mt-2">
              <DropdownMenuItem className="items-start">
                <PreviewIcon className="text-foreground" />
                Preview
              </DropdownMenuItem>
              <DropdownMenuItem className="items-start">
                <DownloadIcon className="text-foreground" />
                Download
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs font-stashly text-muted-foreground">
                Quick actions
              </DropdownMenuLabel>
              <DropdownMenuItem
                className="items-start"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  fetcher.submit(
                    {
                      intent: favorited ? 'unfavorite' : 'favorite',
                      itemId: id,
                    },
                    {
                      method: 'GET',
                      action: '/api/favorites',
                    }
                  )
                }}
              >
                <HeartIcon
                  fill={favorited ? 'currentColor' : 'none'}
                  className="text-foreground"
                />
                {favorited ? 'Unfavorite' : 'Favorite'}
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs font-stashly text-muted-foreground">
                Access
              </DropdownMenuLabel>
              <DropdownMenuItem className="items-start">
                <ShareItemIcon className="text-foreground" />
                Share
              </DropdownMenuItem>
              <DropdownMenuItem className="items-start">
                <LockIcon className="text-foreground" />
                Lock
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs font-stashly text-muted-foreground">
                Organize
              </DropdownMenuLabel>
              <DropdownMenuItem className="items-start">
                <CopyIcon className="text-foreground" />
                Copy
              </DropdownMenuItem>
              <DropdownMenuItem className="items-start">
                <MoveToFolder className="text-foreground" />
                Move
              </DropdownMenuItem>
              <DropdownMenuItem className="items-start">
                <RenameIcon className="text-foreground" />
                Rename
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs font-stashly text-muted-foreground">
                Information
              </DropdownMenuLabel>
              <DropdownMenuItem className="items-start" onClick={() => setActivityOpen(true)}>
                <ActivityIcon className="text-foreground" />
                Activity
              </DropdownMenuItem>
              <DropdownMenuItem className="items-start">
                <FileDetailsIcon className="text-foreground" />
                Details
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuItem
              variant="destructive"
              className="mt-2 items-start"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                fetcher.submit(
                  { intent: 'trash_item', selectedItem: id },
                  { method: 'POST', action: '/api/items' }
                )
              }}
            >
              <TrashIcon className="text-foreground" />
              <span className="text-nowrap shrink-0">Trash</span>
            </DropdownMenuItem>
        </DropdownMenuContent>
      )}
      {status === 'trashed' && (
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            className="items-start"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              fetcher.submit(
                { intent: 'restore_item', selectedItem: id },
                { method: 'POST', action: '/api/items' }
              )
            }}
          >
            <RestoreIcon className="text-foreground" />
            Restore
          </DropdownMenuItem>
          <DropdownMenuItem
            className="items-start"
            variant="destructive"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              open({
                variant: 'destructive',
                title: `Are you sure you want to delete ${name}?`,
                description:
                  'This action cannot be undone, deleted items cannot be restored.',
                confirmText: 'Delete',
              })
            }}
          >
            <DeleteIcon className="text-foreground" />
            <span>Delete</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      )}
    </DropdownMenu>

    <ItemActivityDrawer itemId={id} open={activityOpen} onOpenChange={setActivityOpen} />
    </>
  )
}
