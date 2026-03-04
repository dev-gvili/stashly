// ItemCard.tsx
import type {
  File,
  Folder,
  ItemCategory,
  ItemStatus,
  ItemType,
  Thumbnail,
} from '@/prisma/browser'
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
import useConfirm from '@/hooks/useConfirm'
import { Button } from '../ui/button';

type FavoriteItem = {
  id: string
  favoritedBy: {
    name: string
    displayName: string | null
    image: string | null
    id: string
  }
}

export interface ItemCardProps {
  id: string
  name: string
  size: bigint
  inclusiveSize: bigint
  type: ItemType
  category: ItemCategory
  status: ItemStatus
  createdAt: Date | string | null
  updatedAt: Date | string | null
  ownerId: string
  workspaceId: string | null
  driveId: string
  parentId: string | null
  tags: string[]
  thumbnails: Pick<
    Thumbnail,
    'height' | 'url' | 'width' | 'size' | 'id' | 'view'
  >[]
  favorites: FavoriteItem[]
  file: File | null
  asChild?: boolean
  folder: Folder | null
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

const ItemCardActions = (props: React.ComponentPropsWithoutRef<typeof Button>) => {
  let fetcher = useFetcher()
  let { id, name, status, favorites, user } = useItemCard()
  let favorited = toFavorite({ favorites, userId: user?.id })
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
            <DropdownMenuItem className="items-start">
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
  React.ComponentRef<'div'>,
  Omit<React.ComponentPropsWithoutRef<'div'>, 'name' | 'alt' | 'title'> & {
    alt?: string
    title?: string
  }
>((props, ref) => {
  const { type, category, className } = useItemCard()
  const { alt, ...rest } = props

  if (type === 'folder') {
    return (
      <div ref={ref} className={cn('rounded-md p-4', className)} {...rest}>
        <FolderIcon className="size-14 fill-current" />
      </div>
    )
  }

  const Icon = toIcon(category)
  if (Icon) {
    return (
      <div ref={ref} className={cn('rounded-md p-4', className)} {...rest}>
        <Icon className="size-14" />
      </div>
    )
  }

  return <div ref={ref} className={cn('rounded-md p-4', className)} {...rest} />
})
ItemThumbnail.displayName = 'ItemThumbnail'

const ItemName = React.forwardRef<
  React.ComponentRef<typeof CardTitle>,
  React.ComponentPropsWithoutRef<typeof CardTitle>
>((props, ref) => {
  const { name, file, type } = useItemCard()
  const { className, ...rest } = props
  const title = type === 'file' ? `${name}.${file?.extension}` : name

  return (
    <CardTitle
      ref={ref}
      title={title}
      className={cn(
        'in-data-[slot=item-content]:text-md text-sidebar-foreground truncate w-[90%] text-center z-10 max-w-max',
        className
      )}
      {...rest}
    >
      {title}
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

  const { size, ...rest } = props

  const value = React.useMemo(
    () => ({
      ...props,
      user,
      searchParams,
      setSearchParams,
    }),
    [searchParams]
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
        className={cn(
          'p-2 grid gap-0 rounded border-none font-stashly bg-sidebar h-64 overflow-hidden group/card card select-none relative z-0',
          className
        )}
        onClick={(e) => {
          e.stopPropagation()
          navigate(layout ? `${to}?layout=${layout}` : to)
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
        'overflow-hidden p-0 flex flex-col items-center relative gap-y-2',
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
  Count: ItemCount,
  Size: ItemSize,
  Link: ItemLink,
  Favorite: ItemFavorite,
  Checkbox: ItemCardCheckBox,
  Actions: ItemCardActions,
}) 
