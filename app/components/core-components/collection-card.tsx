import React from 'react'
import { href, useFetcher, useNavigate, useParams } from 'react-router'
import { motion } from 'framer-motion'
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/ui/dropdown-menu'
import { CollectionIcon, MenuDotsIcon, RenameIcon, TrashIcon } from '@/components/icons'
import { RenameDialog } from '@/components/core-components/rename-dialog'
import { formatSize } from '@/utils/formaters'
import useConfirm from '@/hooks/useConfirm'

export interface CollectionCardItem {
  id: string
  name: string
  size: bigint
  itemCount: number
}

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
      { method: 'post' }
    )
  }

  return (
    <Card
      className="group relative bg-sidebar rounded py-4 gap-3 transition-colors cursor-pointer border-none hover:bg-sidebar-accent"
      onClick={() =>
        navigate(
          href('/:me/stash/collections/:collectionId', {
            me: me!,
            collectionId: collection.id,
          })
        )
      }
    >
      <CardHeader>
        <CollectionIcon className="size-8" />
        <CardTitle className="font-stashly text-sm font-medium truncate">
          {collection.name}
        </CardTitle>
        <CardAction>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger
              onClick={(e) => e.stopPropagation()}
              aria-label="Collection options"
            >
              <MenuDotsIcon className="size-6!" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <RenameDialog
                defaultName={collection.name}
                intent="rename_collection"
                extraData={{ collectionId: collection.id }}
                title="Rename collection"
              >
                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                  <RenameIcon />
                  Rename
                </DropdownMenuItem>
              </RenameDialog>
              <DropdownMenuSeparator />
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
            </DropdownMenuContent>
          </DropdownMenu>
        </CardAction>
      </CardHeader>
      <CardContent className="px-4">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>
            {collection.itemCount}{' '}
            {collection.itemCount === 1 ? 'item' : 'items'}
          </span>
          <span className="text-border">·</span>
          <span>{formatSize('byte', 'unit', Number(collection.size))}</span>
        </div>
      </CardContent>
    </Card>
  )
}
