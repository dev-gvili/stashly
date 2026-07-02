// app/components/stash/item-card-actions.tsx
import React from 'react'
import { useFetcher, href } from 'react-router'
import { useItemCard } from '@/hooks/useItemCard'
import { usePinItem } from '@/hooks/usePinItem'
import { useFavorite } from '@/hooks/useFavorite'
import { useLockItem } from '@/hooks/useLockItem'
import useConfirm from '@/hooks/useConfirm'
import { toFavorite } from '@/utils/converters'
import { cn } from '@/utils/styles'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/ui/dropdown-menu'
import { ScrollArea } from '@/ui/scroll-area'
import { Button } from '@/ui/button'
import { MoveToFolderDialog } from '@/components/core-components/move-to-folder-dialog'
import { ShareDialog } from '@/components/core-components/share-dialog'
import { ItemActivityDrawer } from '@/components/core-components/item-activity-drawer'
import {
  ShareItemFillIcon,
  ActivityFillIcon,
  CopyFillIcon,
  DownloadFillIcon,
  DetailsFillIcon,
  GroupFillIcon,
  HeartFillIcon,
  LockFillIcon,
  MoreMenuFillIcon,
  MinusFillIcon,
  MoveFillIcon,
  PinFillIcon,
  PreviewIcon,
  RemoveIcon,
  RenameFillIcon,
  RestoreIcon,
  TrashFillIcon,
  UnlockFillIcon,
} from '@/components/icons'

// -- Group primitive ---------------------------------------------------------

interface GroupProps extends React.ComponentPropsWithoutRef<
  typeof DropdownMenuGroup
> {
  label?: React.ReactNode
}

function Group({ label, children, className, ...props }: GroupProps) {
  return (
    <DropdownMenuGroup className={className} {...props}>
      {label && (
        <DropdownMenuLabel className="text-xs font-stashly text-muted-foreground">
          {label}
        </DropdownMenuLabel>
      )}
      {children}
    </DropdownMenuGroup>
  )
}

// -- Item primitive ----------------------------------------------------------

type ItemProps = React.ComponentPropsWithoutRef<typeof DropdownMenuItem>

const Item = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuItem>,
  ItemProps
>(({ className, ...props }, ref) => (
  <DropdownMenuItem
    ref={ref}
    className={cn(
      'items-start hover:cursor-pointer [&_svg]:size-5!',
      className
    )}
    {...props}
  />
)) as React.ForwardRefExoticComponent<
  ItemProps & React.RefAttributes<React.ComponentRef<typeof DropdownMenuItem>>
>
Item.displayName = 'Actions.Item'

// -- Stateless sub-components ------------------------------------------------

function Preview(props: ItemProps) {
  return (
    <Item {...props}>
      <PreviewIcon className="text-current" />
      Preview
    </Item>
  )
}

function Download(props: ItemProps) {
  return (
    <Item {...props}>
      <DownloadFillIcon className="text-current" />
      Download
    </Item>
  )
}

function Copy(props: ItemProps) {
  return (
    <Item {...props}>
      <CopyFillIcon className="text-current" />
      Copy
    </Item>
  )
}

function Move(props: ItemProps) {
  const [open, setOpen] = React.useState(false)
  const { id, name, type, parentId, driveId, thumbnails, parent } = useItemCard()
  const thumbnailUrl = thumbnails?.[0]?.url?.startsWith('#')
    ? null
    : (thumbnails?.[0]?.url ?? null)

  return (
    <>
      <Item
        {...props}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen(true)
          props.onClick?.(e)
        }}
      >
        <MoveFillIcon className="text-current" />
        Move
      </Item>
      <MoveToFolderDialog
        open={open}
        onOpenChange={setOpen}
        itemId={id}
        itemName={name}
        itemType={type === 'folder' ? 'folder' : 'file'}
        sourceParentId={parentId}
        sourceParentName={parent?.name ?? null}
        driveId={driveId}
        thumbnailUrl={thumbnailUrl}
      />
    </>
  )
}

function Rename(props: ItemProps) {
  return (
    <Item {...props}>
      <RenameFillIcon className="text-current" />
      Rename
    </Item>
  )
}

function Details(props: ItemProps) {
  return (
    <Item {...props}>
      <DetailsFillIcon className="text-current" />
      Details
    </Item>
  )
}

// -- Favorite ----------------------------------------------------------------

function Favorite(props: ItemProps) {
  const { id, favorites, user } = useItemCard()
  const initiallyFavorited = toFavorite({ favorites, userId: user?.id })
  const { favorited, toggle, isPending } = useFavorite(id, initiallyFavorited)

  return (
    <Item
      {...props}
      disabled={isPending}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        toggle()
        props.onClick?.(e)
      }}
    >
      <HeartFillIcon className="text-current" />
      {favorited ? 'Unfavorite' : 'Favorite'}
    </Item>
  )
}

// -- Pin ---------------------------------------------------------------------

function Pin(props: ItemProps) {
  const { id, pins, user } = useItemCard()
  console.log('Pin component', { id, pins, user })
  const initiallyPinned =
    Array.isArray(pins) && pins.some((p) => p.pinnedById === user?.id)
  const { pinned, toggle, isPending } = usePinItem(id, initiallyPinned)

  return (
    <Item
      {...props}
      disabled={isPending}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        toggle()
        props.onClick?.(e)
      }}
    >
      <PinFillIcon className="text-current" />
      {pinned ? 'Unpin' : 'Pin'}
    </Item>
  )
}

// -- Lock --------------------------------------------------------------------

function Lock(props: ItemProps) {
  const { id, locked: itemLock, user } = useItemCard()
  const initiallyLocked = itemLock?.lockedById === user?.id
  const { locked, toggle, isPending } = useLockItem(id, initiallyLocked)

  return (
    <Item
      {...props}
      disabled={isPending}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        toggle()
        props.onClick?.(e)
      }}
    >
      {locked ? (
        <LockFillIcon className="text-current" />
      ) : (
        <UnlockFillIcon className="text-current" />
      )}
      {locked ? 'Unlock' : 'Lock'}
    </Item>
  )
}

// -- Share -------------------------------------------------------------------

function Share(props: ItemProps) {
  const [open, setOpen] = React.useState(false)
  const { id, name, type } = useItemCard()
  const itemType = type === 'folder' ? 'folder' : 'file'

  return (
    <>
      <Item
        {...props}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen(true)
          props.onClick?.(e)
        }}
      >
        <ShareItemFillIcon className="text-current" />
        Share
      </Item>
      <ShareDialog
        open={open}
        onOpenChange={setOpen}
        itemId={id}
        itemName={name}
        itemType={itemType}
      />
    </>
  )
}

// -- Invite ------------------------------------------------------------------

function Invite(props: ItemProps) {
  const [open, setOpen] = React.useState(false)
  const { id, name } = useItemCard()

  return (
    <>
      <Item
        {...props}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen(true)
          props.onClick?.(e)
        }}
      >
        <GroupFillIcon className="text-current" />
        Invite
      </Item>
      <ShareDialog
        itemId={id}
        itemName={name}
        itemType="file"
        open={open}
        onOpenChange={setOpen}
      />
    </>
  )
}

// -- Activity ----------------------------------------------------------------

function Activity(props: ItemProps) {
  const [open, setOpen] = React.useState(false)
  const { id } = useItemCard()

  return (
    <>
      <Item
        {...props}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen(true)
          props.onClick?.(e)
        }}
      >
        <ActivityFillIcon className="text-current" />
        Activity
      </Item>
      <ItemActivityDrawer itemId={id} open={open} onOpenChange={setOpen} />
    </>
  )
}

// -- Trash -------------------------------------------------------------------

function Trash(props: ItemProps) {
  const fetcher = useFetcher()
  const { id } = useItemCard()

  return (
    <Item
      variant="destructive"
      {...props}
      className={cn('mt-2 items-start hover:cursor-pointer', props.className)}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        fetcher.submit(
          { intent: 'trash_item', selectedItem: id },
          { method: 'POST', action: href('/api/items') }
        )
        props.onClick?.(e)
      }}
    >
      <TrashFillIcon className="text-current" />
      <span className="text-nowrap shrink-0">Trash</span>
    </Item>
  )
}

// -- Restore -----------------------------------------------------------------

function Restore(props: ItemProps) {
  const fetcher = useFetcher()
  const { id } = useItemCard()

  return (
    <Item
      {...props}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        fetcher.submit(
          { intent: 'restore_item', selectedItem: id },
          { method: 'POST', action: href('/api/items') }
        )
        props.onClick?.(e)
      }}
    >
      <RestoreIcon className="text-current" />
      Restore
    </Item>
  )
}

// -- Delete ------------------------------------------------------------------

function Delete(props: ItemProps) {
  const fetcher = useFetcher()
  const { id, name } = useItemCard()
  const onDelete = React.useCallback(() => {
    fetcher.submit(
      { intent: 'delete_item', selectedItem: id },
      { method: 'POST', action: href('/api/items') }
    )
  }, [id, fetcher])
  const { open } = useConfirm(onDelete)

  return (
    <Item
      variant="destructive"
      {...props}
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
        props.onClick?.(e)
      }}
    >
      <TrashFillIcon className="text-current" />
      <span>Delete</span>
    </Item>
  )
}

// -- RemoveFromCollection ----------------------------------------------------

interface RemoveFromCollectionProps extends ItemProps {
  collectionId: string
}

function RemoveFromCollection({
  collectionId,
  ...props
}: RemoveFromCollectionProps) {
  const fetcher = useFetcher()
  const { id, name } = useItemCard()
  const onRemove = React.useCallback(() => {
    fetcher.submit(
      { intent: 'remove_item_from_collection', itemId: id, collectionId },
      { method: 'POST', action: href('/api/collections') }
    )
  }, [id, collectionId, fetcher])
  const { open } = useConfirm(onRemove)

  return (
    <Item
      variant="destructive"
      {...props}
      className={cn('mt-2 items-center hover:cursor-pointer', props.className)}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        open({
          variant: 'destructive',
          title: `Remove ${name} from this collection?`,
          description:
            'The item stays in your stash; it just leaves this collection.',
          confirmText: 'Remove',
        })
        props.onClick?.(e)
      }}
    >
      <MinusFillIcon className="text-current" />
      <span className="text-nowrap shrink-0">Remove</span>
    </Item>
  )
}

// -- Root --------------------------------------------------------------------

interface ActionsRootProps extends React.ComponentPropsWithoutRef<
  typeof Button
> {
  children?: React.ReactNode
}

function ActionsRoot({ children, ...triggerProps }: ActionsRootProps) {
  const fetcher = useFetcher()
  const { id, status } = useItemCard()
  const hasChildren = React.Children.count(children) > 0

  React.useEffect(() => {
    if (hasChildren) return
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Delete') {
        event.preventDefault()
        event.stopPropagation()
        fetcher.submit(
          { intent: 'trash_item', selectedItem: id },
          { method: 'POST', action: href('/api/items') }
        )
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [hasChildren, id, fetcher])

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        onClick={(e) => e.stopPropagation()}
        {...triggerProps}
      >
        <MoreMenuFillIcon className="size-6!" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        hideWhenDetached
        align="end"
        avoidCollisions
        className="space-y-4 w-48 bg-sidebar z-40"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <ScrollArea className="h-full pr-2" type="auto">
          <section className="max-h-80 space-y-2">
            {hasChildren ? children : <DefaultMenu status={status} />}
          </section>
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function DefaultMenu({ status }: { status: string }) {
  if (status === 'trashed') {
    return (
      <>
        <Restore />
        <Delete />
      </>
    )
  }

  return (
    <>
      <Group>
        <Preview />
        <Download />
      </Group>
      <Group label="Quick actions">
        <Favorite />
        <Pin />
      </Group>
      <Group label="Access">
        <Share />
        <Lock />
      </Group>
      <Group label="Organize">
        <Copy />
        <Move />
        <Rename />
      </Group>
      <Group label="Information">
        <Activity />
        <Details />
      </Group>
      <Trash />
    </>
  )
}

// -- Public API --------------------------------------------------------------

export const Actions: typeof ActionsRoot & {
  Group: typeof Group
  Item: typeof Item
  Preview: typeof Preview
  Download: typeof Download
  Copy: typeof Copy
  Move: typeof Move
  Rename: typeof Rename
  Details: typeof Details
  Favorite: typeof Favorite
  Pin: typeof Pin
  Lock: typeof Lock
  Share: typeof Share
  Invite: typeof Invite
  Activity: typeof Activity
  Trash: typeof Trash
  Restore: typeof Restore
  Delete: typeof Delete
  RemoveFromCollection: typeof RemoveFromCollection
} = Object.assign(ActionsRoot, {
  Group,
  Item,
  Preview,
  Download,
  Copy,
  Move,
  Rename,
  Details,
  Favorite,
  Pin,
  Lock,
  Share,
  Invite,
  Activity,
  Trash,
  Restore,
  Delete,
  RemoveFromCollection,
})
