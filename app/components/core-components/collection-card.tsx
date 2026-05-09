import React from 'react'
import { href, useFetcher, useNavigate, useParams } from 'react-router'
import { motion } from 'framer-motion'
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
import {
  CollectionsFillIcon,
  MenuDotsIcon,
  RenameIcon,
  TrashIcon,
} from '@/components/icons'
import { RenameDialog } from '@/components/core-components/rename-dialog'
import { formatSize } from '@/utils/formaters'
import useConfirm from '@/hooks/useConfirm'
import { cn } from '@/utils'
import type { StashCollection } from '@/types/stash.types'

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
      { method: 'post', action: '/api/collections', preventScrollReset: true }
    )
  }

  return (
    <Card
      className="group relative bg-card rounded p-4 gap-3 justify-evenly transition-colors cursor-pointer border-none hover:bg-muted aspect-video w-full max-w-xs"
      onClick={() =>
        navigate(
          `${href('/:me/stash/collections/:collectionId', {
            me: me!,
            collectionId: collection.id,
          })}?layout=grid`
        )
      }
    >
      <CardHeader className="p-0">
        <CardAction>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger
              onClick={(e) => e.stopPropagation()}
              aria-label="Collection options"
            >
              <MenuDotsIcon className="size-6!" />
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
                    <RenameIcon className="text-foreground" />
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
                  <TrashIcon />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardAction>
        <CollectionsFillIcon className="size-14" />
      </CardHeader>
      <CollectionContent className="p-0 items-start">
        <CollectionName name={collection.name} className="mt-2" />
      </CollectionContent>
      <CollectionFooter className="p-0 mt-2">
        <CollectionSize size={collection.size} />
        <CollectionCount _count={collection.itemCount} />
      </CollectionFooter>
    </Card>
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
