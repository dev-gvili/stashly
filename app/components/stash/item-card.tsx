// ItemCard.tsx
import * as AvatarPrimitive from '@radix-ui/react-avatar'
import type { StashItem } from '@/types/stash.types'
import {
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/ui/card'
import { toFavorite, toIcon, toItemUrl } from '@/utils/converters'
import { formatSize } from '@/utils/formaters'
import { cn } from '@/utils/styles'
import React, { useCallback } from 'react'
import {
  Link,
  useFetcher,
  useNavigate,
  useRouteLoaderData,
  useSearchParams,
} from 'react-router'
import { Favorite } from '@/components/favorite'
import { Slot } from '@radix-ui/react-slot'
import {
  addQueryParamValue,
  hasQueryParamValue,
  removeQueryParamValue,
} from '@/utils/query-params'
import { Checkbox } from '@/ui/checkbox'
import { useSelection } from './selection'
import type { Route } from '../../routes/+types/layout'
import { ItemCardContext, useItemCard } from '@/hooks/useItemCard'
import { useItemDragDrop, DRAG_ITEM_KEY } from '@/hooks/useItemDragDrop'
import {
  FolderIcon,
  ActivityIcon,
  CopyIcon,
  DeleteIcon,
  DownloadIcon,
  FileDetailsIcon,
  HeartIcon,
  LockIcon,
  MenuDotsIcon,
  MoveToFolder,
  PinIcon,
  PinFillIcon,
  PreviewIcon,
  RenameIcon,
  RestoreIcon,
  ShareItemIcon,
  TrashIcon,
  GroupIcon,
} from '@/components/icons'
import { ShareDialog } from '@/components/core-components/share-dialog'
import { InviteDialog } from '@/components/core-components/invite-dialog'
import { ItemActivityDrawer } from '@/components/core-components/item-activity-drawer'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/ui/dropdown-menu'
import useConfirm from '@/hooks/useConfirm'
import { usePinItem } from '@/hooks/usePinItem'
import { Button } from '../ui/button'
import { ScrollArea } from '../ui/scroll-area'

export interface ItemCardProps extends StashItem {
  asChild?: boolean
  children?: React.ReactNode
  className?: string
}

const ItemHeader = React.forwardRef<
  React.ComponentRef<typeof CardHeader>,
  React.ComponentPropsWithoutRef<typeof CardHeader>
>((props, ref) => {
  const { children, className, ...rest } = props

  return (
    <CardHeader
      ref={ref}
      data-slot="item-header"
      className={cn(
        'p-2! mx-0 grid grid-cols-2! place-content-between',
        className
      )}
      {...rest}
    >
      {children}
    </CardHeader>
  )
})
ItemHeader.displayName = 'ItemHeader'

const ItemCardActions = (
  props: React.ComponentPropsWithoutRef<typeof Button>
) => {
  let fetcher = useFetcher()
  let { id, name, type, status, favorites, pins, user } = useItemCard()
  let favorited = toFavorite({ favorites, userId: user?.id })
  let initiallyPinned = Array.isArray(pins) && pins.some((p) => p.pinnedById === user?.id)
  let { pinned, toggle: togglePin, isPending: isPinPending } = usePinItem(id, initiallyPinned)
  let [shareOpen, setShareOpen] = React.useState(false)
  let [dmo, setDMOpen] = React.useState(false)
  let [activityOpen, setActivityOpen] = React.useState(false)
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

  const itemType = type === 'folder' ? 'folder' : 'file'

  return (
    <>
      <ShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        itemId={id}
        itemName={name}
        itemType={itemType}
      />
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger onClick={(e) => e.stopPropagation()} {...props}>
          <MenuDotsIcon className="size-6!" />
        </DropdownMenuTrigger>

        {status !== 'trashed' && (
          <DropdownMenuContent
            hideWhenDetached={true}
            align="end"
            avoidCollisions={true}
            className="space-y-4 w-48 bg-sidebar z-40"
            onCloseAutoFocus={(e) => e.preventDefault()}
          >
            <ScrollArea className="h-full pr-2" type="auto">
              <section className="max-h-80 space-y-2">
                <DropdownMenuGroup className="mt-2">
                  <DropdownMenuItem className="items-start hover:cursor-pointer">
                    <PreviewIcon className="text-current" />
                    Preview
                  </DropdownMenuItem>
                  <DropdownMenuItem className="items-start hover:cursor-pointer">
                    <DownloadIcon className="text-current" />
                    Download
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-xs font-stashly text-muted-foreground">
                    Quick actions
                  </DropdownMenuLabel>
                  <DropdownMenuItem
                    className="items-start hover:cursor-pointer"
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
                      className="text-current"
                    />
                    {favorited ? 'Unfavorite' : 'Favorite'}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="items-start hover:cursor-pointer"
                    disabled={isPinPending}
                    onSelect={(e) => {
                      e.preventDefault()
                      togglePin()
                    }}
                  >
                    {pinned ? (
                      <PinFillIcon className="text-current" />
                    ) : (
                      <PinIcon className="text-current" />
                    )}
                    {pinned ? 'Unpin' : 'Pin'}
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-xs font-stashly text-muted-foreground">
                    Access
                  </DropdownMenuLabel>
                  <DropdownMenuItem
                    className="items-start hover:cursor-pointer"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setShareOpen(true)
                    }}
                  >
                    <ShareItemIcon className="text-current" />
                    Share
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      setDMOpen(true)
                    }}
                    className="hover:cursor-pointer"
                  >
                    <GroupIcon className="text-current" />
                    Invite
                  </DropdownMenuItem>
                  <DropdownMenuItem className="items-start hover:cursor-pointer">
                    <LockIcon className="text-current" />
                    Lock
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-xs font-stashly text-muted-foreground">
                    Organize
                  </DropdownMenuLabel>
                  <DropdownMenuItem className="items-start hover:cursor-pointer">
                    <CopyIcon className="text-current" />
                    Copy
                  </DropdownMenuItem>
                  <DropdownMenuItem className="items-start hover:cursor-pointer">
                    <MoveToFolder className="text-current" />
                    Move
                  </DropdownMenuItem>
                  <DropdownMenuItem className="items-start hover:cursor-pointer">
                    <RenameIcon className="text-current" />
                    Rename
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-xs font-stashly text-muted-foreground">
                    Information
                  </DropdownMenuLabel>
                  <DropdownMenuItem className="items-start hover:cursor-pointer" onClick={() => setActivityOpen(true)}>
                    <ActivityIcon className="text-current" />
                    Activity
                  </DropdownMenuItem>
                  <DropdownMenuItem className="items-start hover:cursor-pointer">
                    <FileDetailsIcon className="text-current" />
                    Details
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuItem
                  variant="destructive"
                  className="mt-2 items-start hover:cursor-pointer"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    fetcher.submit(
                      { intent: 'trash_item', selectedItem: id },
                      { method: 'POST', action: '/api/items' }
                    )
                  }}
                >
                  <TrashIcon className="text-current" />
                  <span className="text-nowrap shrink-0">Trash</span>
                </DropdownMenuItem>
              </section>
            </ScrollArea>
          </DropdownMenuContent>
        )}
        {status === 'trashed' && (
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              className="items-start hover:cursor-pointer"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                fetcher.submit(
                  { intent: 'restore_item', selectedItem: id },
                  { method: 'POST', action: '/api/items' }
                )
              }}
            >
              <RestoreIcon className="text-current" />
              Restore
            </DropdownMenuItem>
            <DropdownMenuItem
              className="items-start hover:cursor-pointer"
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
              <DeleteIcon className="text-current" />
              <span>Delete</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        )}
      </DropdownMenu>
      <InviteDialog
        itemId={id}
        itemName={name}
        open={dmo}
        onOpenChange={setDMOpen}
      />
      <ItemActivityDrawer itemId={id} open={activityOpen} onOpenChange={setActivityOpen} />
    </>
  )
}
ItemCardActions.displayName = 'ItemCardActions'
// 'z-10 hover:cursor-pointer font-stashly max-w-max place-self-end',

const ItemFavorite = React.forwardRef<
  React.ComponentRef<typeof Favorite>,
  Omit<React.ComponentPropsWithoutRef<typeof Favorite>, 'itemId'>
>((props, ref) => {
  const { className, ...rest } = props
  const { id } = useItemCard()

  return (
    <Favorite
      className={cn(
        'size-6 z-10 place-self-start hover:cursor-pointer',
        className
      )}
      itemId={id}
      {...rest}
    />
  )
})

ItemFavorite.displayName = 'ItemFavorite'

function ItemCardCheckBox({
  name,
  value,
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof Checkbox>) {
  const { searchParams, setSearchParams, id } = useItemCard()
  const selection = useSelection()
  const curValue = `${value ?? id}`
  const localShiftRef = React.useRef(false)

  const isChecked = selection
    ? selection.isChecked(curValue, name)
    : hasQueryParamValue(searchParams, name ?? 'selectedItems', curValue)

  const handleMouseDown = (e: React.MouseEvent) => {
    // capture whether Shift was held at the time of press
    e.stopPropagation()
    if (selection) {
      selection.onMouseDown(e)
    } else {
      localShiftRef.current = e.shiftKey
    }
  }

  const handleClick = (e: React.MouseEvent) => {
    // prevent card click navigation
    e.stopPropagation()
  }

  const handleCheckedChange = (checked: boolean | 'indeterminate') => {
    const paramName = name ?? 'selectedItems'

    if (selection) {
      selection.onCheckedChange(curValue, checked, paramName)
      return
    }

    // fallback single item toggle when provider isn't available
    if (checked) {
      setSearchParams(addQueryParamValue(searchParams, paramName, curValue), {
        replace: true,
      })
    } else {
      setSearchParams(
        removeQueryParamValue(searchParams, paramName, curValue),
        {
          replace: true,
        }
      )
    }
    localShiftRef.current = false
  }

  return (
    <Checkbox
      checked={isChecked}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      onCheckedChange={handleCheckedChange}
      data-slot="item-checkbox"
      className={cn(
        'size-6 z-10 place-self-start hover:cursor-pointer bg-input',
        className
      )}
      name={name}
      value={value || id}
      {...props}
    />
  )
}
ItemCardCheckBox.displayName = 'ItemCardCheckBox'

const ItemThumbnail = React.forwardRef<
  React.ComponentRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>((props, ref) => {
  const { className, children, ...rest } = props
  return (
    <AvatarPrimitive.Root
      ref={ref}
      data-slot="item-thumbnail"
      className={cn(
        'relative flex w-full shrink-0 overflow-hidden rounded-md aspect-video',
        className
      )}
      {...rest}
    >
      {children ?? (
        <>
          <ItemThumbnailImage />
          <ItemThumbnailFallback />
        </>
      )}
    </AvatarPrimitive.Root>
  )
})
ItemThumbnail.displayName = 'ItemThumbnail'

const ItemThumbnailImage = React.forwardRef<
  React.ComponentRef<typeof AvatarPrimitive.Image>,
  Omit<React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>, 'src'>
>((props, ref) => {
  const { thumbnails, name } = useItemCard()
  const thumbnail = thumbnails?.find((t) => t.url && !t.url.startsWith('#'))
  const { className, alt, ...rest } = props
  if (!thumbnail?.url) return null
  return (
    <AvatarPrimitive.Image
      ref={ref}
      src={thumbnail.url}
      alt={alt ?? name}
      width={thumbnail.width ?? undefined}
      height={thumbnail.height ?? undefined}
      data-slot="item-thumbnail-image"
      className={cn('w-full h-full object-cover rounded-md', className)}
      {...rest}
    />
  )
})
ItemThumbnailImage.displayName = 'ItemThumbnailImage'

const ItemThumbnailFallback = React.forwardRef<
  React.ComponentRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>((props, ref) => {
  const { type, category } = useItemCard()
  const { className, children, ...rest } = props
  const Icon = type === 'folder' ? FolderIcon : toIcon(category)
  return (
    <AvatarPrimitive.Fallback
      ref={ref}
      data-slot="item-thumbnail-fallback"
      className={cn(
        'flex w-full h-full items-center justify-center rounded-md p-4',
        className
      )}
      {...rest}
    >
      {children ?? (Icon && <Icon className={cn('size-14', type === 'folder' && 'fill-current')} />)}
    </AvatarPrimitive.Fallback>
  )
})
ItemThumbnailFallback.displayName = 'ItemThumbnailFallback'

const ItemName = React.forwardRef<
  React.ComponentRef<typeof CardTitle>,
  React.ComponentPropsWithoutRef<typeof CardTitle>
>((props, ref) => {
  const { name, file, type } = useItemCard()
  const { className, ...rest } = props

  return (
    <CardTitle
      ref={ref}
      title={name}
      className={cn(
        'in-data-[slot=item-content]:text-md text-sidebar-foreground truncate w-[90%] text-center h-full max-h-max z-10 max-w-max',
        className
      )}
      {...rest}
    >
      {name}
    </CardTitle>
  )
})
ItemName.displayName = 'ItemName'

const ItemFooter = React.forwardRef<
  React.ComponentRef<typeof CardFooter>,
  React.ComponentPropsWithoutRef<typeof CardFooter>
>((props, ref) => {
  const { children, className, ...rest } = props

  return (
    <CardFooter
      data-slot="item-footer"
      ref={ref}
      className={cn(
        'grid grid-cols-2 m-0 p-2 place-content-end font-stashly *:text-muted-foreground *:text-xs w-full h-auto ',
        className
      )}
      {...rest}
    >
      {children}
    </CardFooter>
  )
})
ItemFooter.displayName = 'ItemFooter'

const ItemCount = React.forwardRef<
  React.ComponentRef<typeof CardDescription>,
  React.ComponentPropsWithoutRef<typeof CardDescription>
>((props, ref) => {
  const { folder, type } = useItemCard()
  const { className, ...rest } = props
  if (type !== 'folder') return null

  return (
    <CardDescription
      ref={ref}
      className={cn(
        'text-card-foreground text-sm font-stashly place-self-end col-span-1 h-full flex items-end',
        className
      )}
      {...rest}
    >
      {folder?.inclusiveChildCount ?? folder?.childCount} items
    </CardDescription>
  )
})
ItemCount.displayName = 'ItemCount'

const ItemSize = React.forwardRef<
  React.ComponentRef<typeof CardDescription>,
  React.ComponentPropsWithoutRef<typeof CardDescription>
>((props, ref) => {
  const { size } = useItemCard()
  const { className, ...rest } = props
  return (
    <CardDescription
      ref={ref}
      className={cn(
        'text-card-foreground text-sm font-stashly place-self-end w-full col-span-1 h-full',
        className
      )}
      {...rest}
    >
      {formatSize('byte', 'unit', size)}
    </CardDescription>
  )
})
ItemSize.displayName = 'ItemSize'

const ItemLink = React.forwardRef<
  React.ComponentRef<typeof Link>,
  Omit<React.ComponentPropsWithoutRef<typeof Link>, 'to'>
>((props, ref) => {
  const { parentId, type, id, user, searchParams } = useItemCard()
  const layout = searchParams.get('layout')
  const { className, ...rest } = props

  const to = toItemUrl({
    parentId: parentId || '',
    type: type,
    id: id,
    ownerId: user.id,
  })

  return (
    <Link
      ref={ref}
      id={id}
      to={`${to}?layout=${layout}`}
      data-slot="item-link"
      className={cn('z-0', className)}
      onClick={(e) => e.stopPropagation()}
      {...rest}
    />
  )
})
ItemLink.displayName = 'ItemLink'

const ItemCardRoot = ({
  children,
  className,
  asChild = false,
  ...props
}: ItemCardProps) => {
  let user =
    useRouteLoaderData<Route.ComponentProps['loaderData']>('layout')!.user
  let navigate = useNavigate()

  let [searchParams, setSearchParams] = useSearchParams()
  const layout = searchParams.get('layout')
  const take = searchParams.get('take')

  const { size, ...rest } = props

  const {
    isDragOver,
    isFolder,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  } = useItemDragDrop({ id: rest.id, type: rest.type })

  const value = React.useMemo(
    () => ({
      ...props,
      user,
      searchParams,
      setSearchParams,
    }),
    [props, user, searchParams]
  )

  const to = toItemUrl({
    parentId: rest.parentId || '',
    type: rest.type,
    id: rest.id,
    ownerId: user!.id,
  })

  const Comp = asChild ? Slot : 'div'

  return (
    <ItemCardContext.Provider value={value}>
      <Comp
        data-slot="item-card"
        data-item-status={props.status}
        data-item-type={props.type}
        draggable
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'rounded-md p-2 grid gap-0  border-input font-stashly surface-glass overflow-hidden group/card card select-none relative z-0 transition-colors',
          isFolder &&
            isDragOver &&
            'ring-2 ring-muted bg-grid surface-elevated',
          className
        )}
        onClick={(e) => {
          // Ignore clicks from portaled elements (dialogs, dropdowns)
          if (!e.currentTarget.contains(e.target as Node)) return false
          e.stopPropagation()
          navigate(layout ? `${to}?layout=${layout}&take=${take}` : to)
        }}
      >
        {children}
      </Comp>
    </ItemCardContext.Provider>
  )
}

// const SelectAllCheckBox = ({
//   name,
//   className,
//   ...props
// }: {
//   allIds: string[]
//   className?: string
// } & React.ComponentPropsWithoutRef<typeof ItemCardCheckBox>) => {
//   const { searchParams, setSearchParams } = useItemCard()
//   const currentIds = getQueryParamArray(searchParams, name)

//   const isAllSelected =
//     allIds.length > 0 && allIds.every((id) => currentIds.includes(id))

//   return (
//     <ItemCardCheckBox
//       {...props}
//       className={className}
//       checked={isAllSelected}
//       onClick={(e) => {
//         e.stopPropagation()
//         const newSearchParams = new URLSearchParams(searchParams)
//         const otherIds = currentIds.filter((id) => !allIds.includes(id))

//         newSearchParams.delete('ids')
//         otherIds.forEach((id) => newSearchParams.append('ids', id))

//         if (!isAllSelected) {
//           allIds.forEach((id) => newSearchParams.append('ids', id))
//         }
//         setSearchParams(newSearchParams)
//       }}
//     />
//   )
// }
// SelectAllCheckBox.displayName = 'SelectAllCheckBox'

const ItemContent = React.forwardRef<
  React.ComponentRef<typeof CardContent>,
  React.ComponentPropsWithoutRef<typeof CardContent>
>((props, ref) => {
  return (
    <CardContent
      ref={ref}
      data-slot="item-content"
      className={cn(
        'overflow-hidden p-1 flex flex-col items-center relative gap-y-2',
        props.className
      )}
    >
      {props.children}
    </CardContent>
  )
})
ItemContent.displayName = 'ItemContent'

export const ItemCard = Object.assign(ItemCardRoot, {
  Header: ItemHeader,
  Content: ItemContent,
  Footer: ItemFooter,
  Name: ItemName,
  Thumbnail: ItemThumbnail,
  ThumbnailImage: ItemThumbnailImage,
  ThumbnailFallback: ItemThumbnailFallback,
  Count: ItemCount,
  Size: ItemSize,
  Link: ItemLink,
  Favorite: ItemFavorite,
  Checkbox: ItemCardCheckBox,
  Actions: ItemCardActions,
})
