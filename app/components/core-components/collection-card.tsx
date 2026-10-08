import { RenameDialog } from '@/components/core-components/rename-dialog'
import {
  CollectionFillIcon,
  MoreMenuFillIcon,
  RenameFillIcon,
  TrashFillIcon,
} from '@/components/icons'
import useConfirm from '@/hooks/useConfirm'
import type { StashCollection } from '@/types/stash.types'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/ui/dropdown-menu'
import { cn } from '@/utils'
import { formatSize } from '@/utils/formaters'
import React from 'react'
import { href, useFetcher, useNavigate, useParams } from 'react-router'

export type CollectionCardItem = StashCollection

export const cardVariants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.96 },
}

export function CollectionCard({
  collection,
}: {
  collection: CollectionCardItem
}) {
  const navigate = useNavigate()
  const { me } = useParams()
  const fetcher = useFetcher()
  const { open } = useConfirm()

  function handleDelete() {
    fetcher.submit(
      { intent: 'delete_collection', collectionId: collection.id },
      {
        method: 'post',
        action: href('/api/collections'),
        preventScrollReset: true,
      }
    )
  }

  const hasCovers = collection.covers.length > 0

  const actions = (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        onClick={(e) => e.stopPropagation()}
        aria-label="Collection options"
      >
        <MoreMenuFillIcon className="size-6!" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="space-y-4 w-48">
        <DropdownMenuGroup className="mt-2">
          <DropdownMenuLabel className="text-xs font-stashly text-muted-foreground">
            Quick actions
          </DropdownMenuLabel>
          <RenameDialog
            defaultName={collection.name}
            intent="rename_collection"
            action="/api/collections"
            extraData={{ collectionId: collection.id }}
            title="Rename collection"
          >
            <DropdownMenuItem
              onSelect={(e) => e.preventDefault()}
              className="items-start"
            >
              <RenameFillIcon className="text-foreground" />
              Rename
            </DropdownMenuItem>
          </RenameDialog>
          <DropdownMenuItem
            variant="destructive"
            onClick={(e) => {
              e.stopPropagation()
              open({
                variant: 'destructive',
                title: `Delete "${collection.name}"?`,
                description: 'This will move the collection to trash.',
                confirmText: 'Delete',
                onConfirm: handleDelete,
              })
            }}
          >
            <TrashFillIcon />
            Delete
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  return (
    <Card
      className={cn(
        'group relative bg-card rounded-3xl p-4 gap-3 justify-evenly transition-colors cursor-pointer border-none ring-2 ring-accent  aspect-16/10 w-full max-w-md',
        // Thin frame so the cover takes ~75% of the card's height.
        hasCovers && 'p-2 gap-2'
      )}
      onClick={() =>
        navigate(
          `${href('/:me/stash/collections/:collectionId', {
            me: me!,
            collectionId: collection.id,
          })}?layout=grid&take=50`
        )
      }
    >
      {hasCovers ? (
        // The member images are the cover: they fill everything above the
        // footer, with the name over them. Literal white on a fixed dark
        // scrim, since theme tokens would invert over a photo in light mode.
        <CollectionContent className="flex-1 min-h-0 p-0 items-stretch rounded-md">
          <CollectionCovers
            urls={collection.covers}
            className="max-h-11/12 w-full overflow-hidden rounded-2xl  shadow-[2px_6px_6px_0_rgba(38,38,38,0.10)] dark:shadow-[0px_6px_6px_3px_rgba(0,0,0,0.35)]  bg-muted"
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 " />
          <div className="absolute top-2 right-2 z-10 flex size-6 items-center justify-center rounded  text-white backdrop-blur-sm [&_svg]:size-5!">
            {actions}
          </div>
          <CollectionName
            name={''}
            className="absolute bottom-3 left-4 right-4 w-auto max-w-none text-left text-lg font-stashly text-white"
          />
        </CollectionContent>
      ) : (
        <>
          <CardHeader className="p-0">
            <CardAction>{actions}</CardAction>
            <CollectionFillIcon className="size-14" />
          </CardHeader>
          <CollectionContent className="p-0 items-start">
            <CollectionCount _count={collection.itemCount} />
          </CollectionContent>
        </>
      )}
      <CollectionFooter className={cn('p-0 mt-0', hasCovers && 'px-2')}>
        <CollectionName name={collection.name} className="w-auto max-w-none text-left text-lg font-stashly text-white!" />
        <CollectionSize size={collection.size} />
      </CollectionFooter>
    </Card>
  )
}

/**
 * Cover images for a collection card: 1 image full width, 2 side by side,
 * 3 as one tall left tile plus two stacked right, 4 as a 2×2 grid. Images
 * are decorative (the card's name labels it), hence the empty `alt`.
 *
 * @example
 * <CollectionCovers urls={collection.covers} className="h-14" />
 */
function CollectionCovers({
  urls,
  className,
}: {
  urls: string[]
  className?: string
}) {
  const shown = urls.slice(0, 4)

  return (
    <div
      data-slot="collection-covers"
      className={cn(
        'grid w-full gap-0.5 overflow-hidden rounded-md',
        shown.length > 1 && 'grid-cols-2',
        shown.length > 2 && 'grid-rows-2',
        className
      )}
    >
      {shown.map((url, i) => (
        <img
          key={url}
          src={url}
          alt=""
          loading="lazy"
          decoding="async"
          className={cn(
            'size-full min-h-0 object-cover',
            shown.length === 3 && i === 0 && 'row-span-2'
          )}
        />
      ))}
    </div>
  )
}

const CollectionContent = React.forwardRef<
  React.ComponentRef<typeof CardContent>,
  React.ComponentPropsWithoutRef<typeof CardContent>
>((props, ref) => {
  return (
    <CardContent
      ref={ref}
      data-slot="collection-content"
      className={cn(
        'overflow-hidden p-0 flex flex-col items-center relative gap-y-2',
        props.className
      )}
    >
      {props.children}
    </CardContent>
  )
})
CollectionContent.displayName = 'CollectionContent'

const CollectionName = React.forwardRef<
  React.ComponentRef<typeof CardTitle>,
  React.ComponentPropsWithoutRef<typeof CardTitle> & {
    name: string
  }
>((props, ref) => {
  const { className, name, ...rest } = props

  return (
    <CardTitle
      ref={ref}
      data-slot="collection-name"
      title={name}
      className={cn(
        'in-data-[slot=item-content]:text-md text-sidebar-foreground truncate w-[90%] text-center z-10 max-w-max',
        className
      )}
      {...rest}
    >
      {name}
    </CardTitle>
  )
})
CollectionName.displayName = 'CollectionName'

const CollectionFooter = React.forwardRef<
  React.ComponentRef<typeof CardFooter>,
  React.ComponentPropsWithoutRef<typeof CardFooter>
>((props, ref) => {
  const { children, className, ...rest } = props

  return (
    <CardFooter
      data-slot="collection-footer"
      ref={ref}
      className={cn(
        'grid grid-cols-2 m-0 p-2 place-content-end font-stashly *:text-muted-foreground *:text-xs w-full h-auto',
        className
      )}
      {...rest}
    >
      {children}
    </CardFooter>
  )
})
CollectionFooter.displayName = 'CollectionFooter'

const CollectionCount = React.forwardRef<
  React.ComponentRef<typeof CardDescription>,
  React.ComponentPropsWithoutRef<typeof CardDescription> & {
    _count: number
  }
>((props, ref) => {
  const { className, _count, ...rest } = props

  return (
    <CardDescription
      ref={ref}
      data-slot="collection-count"
      className={cn(
        'text-card-foreground text-sm font-stashly place-self-end col-span-1 h-full flex items-end',
        className
      )}
      {...rest}
    >
      {_count} {_count === 1 ? 'item' : 'items'}
    </CardDescription>
  )
})
CollectionCount.displayName = 'CollectionCount'

const CollectionSize = React.forwardRef<
  React.ComponentRef<typeof CardDescription>,
  React.ComponentPropsWithoutRef<typeof CardDescription> & {
    size: bigint
  }
>((props, ref) => {
  const { className, size, ...rest } = props
  return (
    <CardDescription
      ref={ref}
      data-slot="collection-size"
      className={cn(
        'text-card-foreground text-sm font-stashly place-self-end w-full col-span-1 h-full',
        className
      )}
      {...rest}
    >
      {formatSize('byte', 'unit', Number(size))}
    </CardDescription>
  )
})
CollectionSize.displayName = 'CollectionSize'
