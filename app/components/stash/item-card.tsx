// ItemCard.tsx
import { Favorite } from '@/components/favorite'
import { FolderIcon } from '@/components/icons'
import { ItemCardContext, useItemCard } from '@/hooks/useItemCard'
import { useItemDragDrop } from '@/hooks/useItemDragDrop'
import { useItemUrl } from '@/hooks/useItemUrl'
import { useSelection } from '@/hooks/useSelection'
import type { StashItem } from '@/types/stash.types'
import {
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/ui/card'
import { Checkbox } from '@/ui/checkbox'
import { toIcon } from '@/utils/converters'
import { capitalize, formatMediaDate, formatSize } from '@/utils/formaters'
import {
  addQueryParamValue,
  hasQueryParamValue,
  removeQueryParamValue,
} from '@/utils/query-params'
import { cn } from '@/utils/styles'
import { Slot } from '@radix-ui/react-slot'
import { Avatar as AvatarPrimitive } from 'radix-ui'
import React from 'react'
import {
  Link,
  useNavigate, useParams, useRevalidator, useRouteLoaderData,
  useSearchParams
} from 'react-router'
import type { Route } from '../../routes/+types/layout'
import { Actions as ItemCardActions } from './item-card-actions'
import { useLiveThumbnail, useThumbnailWhenVisible } from '@/machines/thumbnail'

/**
 * Whether a card's item is in the trash. It never opens its live route: a
 * trashed folder opens inside Trash, a trashed file and every item link open
 * nowhere. Restore and delete stay in its menu.
 */
const isTrashed = (status: StashItem['status'] | undefined) =>
  status === 'trashed'

/**
 * Merges a forwarded ref with a hook-owned callback ref (React 19 cleanup
 * aware). Memoize the result — a fresh callback each render would detach and
 * re-attach the thumbnail observer on every re-render.
 */
function composeRefs<T>(
  ...refs: Array<React.Ref<T> | undefined>
): React.RefCallback<T> {
  return (node: T | null) => {
    const cleanups = refs.map((r) => {
      if (typeof r === 'function') return r(node)
      if (r) (r as React.RefObject<T | null>).current = node
      return undefined
    })
    return () => {
      for (const c of cleanups) if (typeof c === 'function') c()
      for (const r of refs) {
        if (r && typeof r !== 'function') (r as React.RefObject<T | null>).current = null
      }
    }
  }
}

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
        'size-6 z-10 place-self-start hover:cursor-pointer bg-muted! aria-checked:bg-primary!',
        // The box is 24px; the pseudo-element lifts the pressable area to 40px
        // (dense-desktop minimum) without changing layout. Sized to 40 rather
        // than 44 so it can't reach the actions menu in the opposite corner.
        'relative after:absolute after:top-1/2 after:left-1/2 after:size-10 after:-translate-1/2',
        // Base Checkbox animates box-shadow; name both so neither is dropped.
        'transition-[box-shadow,scale] duration-150 ease-out active:scale-[0.96]',
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
  // The card's thumbnail is made here, once, when it scrolls into view —
  // from the uploaded file if it's still in memory, otherwise by downloading.
  const thumbnailRef = useThumbnailWhenVisible()
  const setRef = React.useMemo(
    () => composeRefs<React.ComponentRef<typeof AvatarPrimitive.Root>>(ref, thumbnailRef),
    [ref, thumbnailRef]
  )
  return (
    <AvatarPrimitive.Root
      ref={setRef}
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

/**
 * Thumbnail URLs are signed and expire, so a tab left open past the expiry
 * paints broken images until its loader data is refreshed. The first failed
 * load triggers one revalidation, which re-signs every URL on the page.
 *
 * Throttled per tab: an image can also fail for reasons a reload won't fix
 * (deleted object, offline), and a grid of those would otherwise revalidate
 * once per card.
 */
const THUMBNAIL_RECOVERY_INTERVAL_MS = 10 * 60 * 1000
let lastThumbnailRecoveryAt = 0

function useThumbnailRecovery() {
  const revalidator = useRevalidator()
  return React.useCallback(() => {
    const now = Date.now()
    if (now - lastThumbnailRecoveryAt < THUMBNAIL_RECOVERY_INTERVAL_MS) return
    lastThumbnailRecoveryAt = now
    revalidator.revalidate()
  }, [revalidator])
}

const ItemThumbnailImage = React.forwardRef<
  HTMLImageElement,
  Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'>
>((props, ref) => {
  const { id, thumbnails, name } = useItemCard()
  const live = useLiveThumbnail(id)
  const persisted = thumbnails?.find((t) => t.url && !t.url.startsWith('#'))
  const { className, alt, onError, ...rest } = props
  const recoverExpired = useThumbnailRecovery()

  const src = live?.src ?? persisted?.url
  const width = live?.width ?? persisted?.width ?? undefined
  const height = live?.height ?? persisted?.height ?? undefined
  if (!src) return null
  // Plain <img> (not Radix Avatar.Image) so progressive src swaps don't
  // flash the Fallback during each stage's load. The browser holds the
  // prior frame until the new src decodes. Absolute-positioned over the
  // sibling Fallback, which shows through only on the very first load.
  return (
    <img
      ref={ref}
      src={src}
      alt={alt ?? name}
      width={width}
      height={height}
      decoding="async"
      data-slot="item-thumbnail-image"
      data-stage={live?.stage}
      onError={(event) => {
        recoverExpired()
        onError?.(event)
      }}
      className={cn(
        'absolute inset-0 w-full h-full object-cover rounded-md',
        // Hairline separator so a light photo on a light card (or the reverse)
        // still reads as a distinct surface. Pure black/white only — a tinted
        // neutral picks up the card ground and looks like dirt on the edge.
        // `outline` rather than `border` so it adds no layout width.
        'outline-1 -outline-offset-1 outline/10',
        className
      )}
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
        'text-card-foreground text-sm font-stashly tabular-nums place-self-end col-span-1 h-full flex items-end',
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
        'text-card-foreground text-sm font-stashly tabular-nums place-self-end w-full col-span-1 h-full',
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
  const { parentId, type, id, user, searchParams, status } = useItemCard()
  const layout = searchParams.get('layout')
  const { className, ...rest } = props
  const itemUrl = useItemUrl()

  // Same rule as the card's own click: a trashed item opens nowhere.
  if (isTrashed(status)) {
    return (
      <span id={id} data-slot="item-link" className={cn('z-0', className)}>
        {rest.children as React.ReactNode}
      </span>
    )
  }

  const to = itemUrl({
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
  const itemUrl = useItemUrl()
  const { me, workspaceId } = useParams()

  let [searchParams, setSearchParams] = useSearchParams()
  const layout = searchParams.get('layout') ?? 'grid'
  const take = searchParams.get('take') ?? 100

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

  let to = itemUrl({
    parentId: rest.parentId || '',
    type: rest.type,
    id: rest.id,
    ownerId: user!.id,
  })

  if(rest.type === 'folder'){
    to = `${to}?layout=${layout}&take=${take}`
  }

  const Comp = asChild ? Slot : 'div'

  // Where Enter on the card goes: the same rule as its click below.
  const href = isTrashed(props.status)
    ? rest.type === 'folder' && me && !workspaceId
      ? `/${me}/stash/trash/folders/${rest.id}?layout=${layout}`
      : null
    : to

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
          'rounded-md p-2 grid gap-0 border-input font-stashly surface-glass overflow-hidden group/card card select-none relative z-0 transition-colors',
          isFolder &&
            isDragOver &&
            'ring-2 ring-primary bg-grid surface-elevated',
          className
        )}
        onClick={(e) => {
          // Ignore clicks from portaled elements (dialogs, dropdowns)
          if (!e.currentTarget.contains(e.target as Node)) return false
          e.stopPropagation()
          // A trashed item never opens its live route: that shows it as if it
          // were still in place, and after a re-upload of the same name the
          // two look like one place. A trashed folder opens inside Trash
          // instead (`/trash/folders/:id`); a trashed file doesn't open, its
          // actions (restore, delete) are in the menu. Workspace trash has no
          // such route yet.
          if (isTrashed(props.status)) {
            if (rest.type === 'folder' && me && !workspaceId) {
              navigate(`/${me}/stash/trash/folders/${rest.id}?layout=${layout}`)
            }
            return
          }
          navigate(to, {
            state:{ name: props.name }
          })
        }}
      >
        {/* The keyboard's way in: Tab reaches the card and Enter opens it.
            Stretched over the card but `pointer-events-none`, so the mouse
            still lands on the card (drag, selection, hover) as before. Not
            with `asChild`, where Slot takes a single child. */}
        {href && !asChild && (
          <Link
            to={href}
            state={{ name: props.name }}
            aria-label={props.name}
            draggable={false}
            data-slot="item-card-link"
            className="absolute inset-0 rounded-md pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            onClick={(e) => e.stopPropagation()}
          />
        )}
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

// -- Arched-cover parts ------------------------------------------------------
// Compound pieces for the "cover" card layout: an edge-to-edge thumbnail whose
// bottom edge is an oval arch, above a body that stacks name / date / size /
// kind. Falls back to the category icon when no real thumbnail exists.

// Normalized (objectBoundingBox) arch: straight top, bottom edge bowing down
// from 0.8 → 1.0 of the cover's own height. Scales to any card size.
// const COVER_ARCH_PATH = 'M0,0 L1,0 L1,0.8 Q1,1 0,1 Q0,1 0,0.8 Z'
const COVER_ARCH_PATH = 'M0,0 L1,0 L1,0.8 Q1,1 0.5,1 Q0,1 0,0.8 Z'


const ItemCover = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>((props, ref) => {
  const { id, thumbnails, type, category, name } = useItemCard()
  const live = useLiveThumbnail(id)
  const persisted = thumbnails?.find((t) => t.stage === 2)
  const { className, ...rest } = props
  const thumbnailRef = useThumbnailWhenVisible()
  const setRef = React.useMemo(
    () => composeRefs<HTMLDivElement>(ref, thumbnailRef),
    [ref, thumbnailRef]
  )

  const src = live?.src ?? persisted?.url ?? undefined
  const Icon = type === 'folder' ? FolderIcon : toIcon(category)
  // Unique per card so multiple covers don't share one clipPath def. The
  // reference must be dynamic, so it lives in `style` rather than a class.
  const clipId = `stashly-cover-arch-${id}`

  return (
    <div
      ref={setRef}
      data-slot="item-cover"
      className={cn(
        'relative basis-[48%] shrink-0 overflow-hidden bg-muted',
        className
      )}
      style={{ clipPath: `url(#${clipId})` }}
      {...rest}
    >
      <svg aria-hidden className="absolute size-0">
        <defs>
          <clipPath id={clipId} clipPathUnits="objectBoundingBox">
            <path d={COVER_ARCH_PATH}/>
          </clipPath>
        </defs>
      </svg>
      {src ? (
        <img
          src={src}
          alt={name}
          decoding="async"
          data-slot="item-cover-image"
          data-stage={live?.stage}
          className="absolute inset-0 h-full w-full object-cover rounded-4"
        />
      ) : (
        Icon && (
          <div
            data-slot="item-cover-fallback"
            className="absolute inset-0 flex items-center justify-center"
          >
            <Icon
              className={cn(
                'size-14 text-muted-foreground',
                type === 'folder' && 'fill-current'
              )}
            />
          </div>
        )
      )}
    </div>
  )
})
ItemCover.displayName = 'ItemCover'

const ItemDate = React.forwardRef<
  React.ComponentRef<typeof CardDescription>,
  React.ComponentPropsWithoutRef<typeof CardDescription>
>((props, ref) => {
  const { createdAt } = useItemCard()
  const { className, ...rest } = props
  return (
    <CardDescription
      ref={ref}
      data-slot="item-date"
      className={cn(
        'text-xs font-stashly tabular-nums text-muted-foreground',
        className
      )}
      {...rest}
    >
      {formatMediaDate(createdAt)}
    </CardDescription>
  )
})
ItemDate.displayName = 'ItemDate'

const ItemKind = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement>
>((props, ref) => {
  const { file, category } = useItemCard()
  const { className, ...rest } = props
  const kind = file?.extension?.toUpperCase() || capitalize(category)
  return (
    <span
      ref={ref}
      data-slot="item-kind"
      className={cn(
        'text-xs font-stashly uppercase text-muted-foreground',
        className
      )}
      {...rest}
    >
      {kind}
    </span>
  )
})
ItemKind.displayName = 'ItemKind'

// Prominent size readout: large value with a muted unit (e.g. "482 MB").
const ItemSizeStat = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>((props, ref) => {
  const { size } = useItemCard()
  const { className, ...rest } = props
  const [value, ...unitParts] = formatSize('byte', 'unit', size).split(' ')
  const unit = unitParts.join(' ')
  return (
    <div
      ref={ref}
      data-slot="item-size-stat"
      className={cn(
        'flex items-baseline gap-1 font-stashly tabular-nums',
        className
      )}
      {...rest}
    >
      <span className="text-2xl font-bold leading-none text-card-foreground">
        {value}
      </span>
      <span className="text-xs text-muted-foreground">{unit}</span>
    </div>
  )
})
ItemSizeStat.displayName = 'ItemSizeStat'

type ItemCardComponent = typeof ItemCardRoot & {
  Header: typeof ItemHeader
  Content: typeof ItemContent
  Footer: typeof ItemFooter
  Name: typeof ItemName
  Thumbnail: typeof ItemThumbnail
  ThumbnailImage: typeof ItemThumbnailImage
  ThumbnailFallback: typeof ItemThumbnailFallback
  Count: typeof ItemCount
  Size: typeof ItemSize
  SizeStat: typeof ItemSizeStat
  Cover: typeof ItemCover
  Date: typeof ItemDate
  Kind: typeof ItemKind
  Link: typeof ItemLink
  Favorite: typeof ItemFavorite
  Checkbox: typeof ItemCardCheckBox
  Actions: typeof ItemCardActions
}

export const ItemCard: ItemCardComponent = Object.assign(ItemCardRoot, {
  Header: ItemHeader,
  Content: ItemContent,
  Footer: ItemFooter,
  Name: ItemName,
  Thumbnail: ItemThumbnail,
  ThumbnailImage: ItemThumbnailImage,
  ThumbnailFallback: ItemThumbnailFallback,
  Count: ItemCount,
  Size: ItemSize,
  SizeStat: ItemSizeStat,
  Cover: ItemCover,
  Date: ItemDate,
  Kind: ItemKind,
  Link: ItemLink,
  Favorite: ItemFavorite,
  Checkbox: ItemCardCheckBox,
  Actions: ItemCardActions,
})
