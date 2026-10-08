import { useState } from 'react'
import { Link, useFetcher, useParams, useSearchParams } from 'react-router'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/ui/button'
import { Badge } from '@/ui/badge'
import { Separator } from '@/ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/ui/dropdown-menu'
import { LoadMoreItems } from '@/components/core-components/buttons'
import { RenameDialog } from '@/components/core-components/rename-dialog'
import {
  AddToCollectionDialog,
  type AddToCollectionItem,
} from '@/components/core-components/add-to-collection-dialog'
import { CollectionEmptyState } from '@/components/states/collection-empty-state'
import {
  ActivityFillIcon,
  AddIcon,
  CollectionFillIcon,
  CopyFillIcon,
  DetailsFillIcon,
  FileFillIcon,
  FolderIcon,
  LockFillIcon,
  MoreMenuFillIcon,
  MoveFillIcon,
  RemoveIcon,
  RenameFillIcon,
  ShareItemFillIcon,
  TrashFillIcon,
} from '@/components/icons'
import { formatSize } from '@/utils/formaters'
import { cn } from '@/utils/styles'
import useConfirm from '@/hooks/useConfirm'
import type { ItemType } from '@/prisma/client'
import type { StashItem, StashPickerItem } from '@/types/stash.types'
import { GridLayout } from './grid-view'
import { ListLayout } from './list-view'
import { ItemCard } from '@/components/stash/item-card'
import { FileCardDetail } from '@/components/core-components/file-card-variants'
import { FolderCardTab } from './folder-card-components/folder-card-tab'
import { ButtonGroup } from '../ui'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CollectionHeader {
  id: string
  name: string
  size: bigint | number
  itemCount: number
}

/**
 * A collection row. `getCollectionItems` selects whole `Item` rows, so unlike
 * the slim picker shape these carry the parent folder — which the file page
 * (`/:me/stash/folders/:folderId/files/:fileId`) needs as its folder segment.
 */
type CollectionItem = StashPickerItem & { parentId?: string | null }

interface CollectionViewProps {
  collection: CollectionHeader
  items: CollectionItem[]
  availableItems: AddToCollectionItem[]
  existingItemIds: string[]
  hasMore: boolean
  isLoading: boolean
  loadMore: () => void
  collectionsHref: string
}

// ---------------------------------------------------------------------------
// Item type icon
// ---------------------------------------------------------------------------

function ItemTypeIcon({
  type,
  className,
}: {
  type: ItemType
  className?: string
}) {
  if (type === 'folder')
    return <FolderIcon className={cn('size-4 text-amber-500', className)} />
  if (type === 'collection')
    return (
      <CollectionFillIcon className={cn('size-4 text-violet-500', className)} />
    )
  return <FileFillIcon className={cn('size-4 text-muted-foreground', className)} />
}

// ---------------------------------------------------------------------------
// Collection page header + actions dropdown
// ---------------------------------------------------------------------------

function CollectionPageHeader({
  collection,
  collectionsHref,
  availableItems,
  existingItemIds,
}: {
  collection: CollectionHeader
  collectionsHref: string
  availableItems: AddToCollectionItem[]
  existingItemIds: string[]
}) {
  const fetcher = useFetcher()
  const { open } = useConfirm()
  const [addOpen, setAddOpen] = useState(false)

  function handleDelete() {
    fetcher.submit(
      { intent: 'trash_collection', collectionId: collection.id },
      { method: 'POST', action: '/api/collections' }
    )
  }

  function handleEmpty() {
    fetcher.submit(
      { intent: 'clear_collection', collectionId: collection.id },
      { method: 'POST', action: '/api/collections' }
    )
  }

  return (
    <>
      <div className="flex items-start justify-between gap-4 px-0 ">
        <div className="flex gap-1 min-w-0 items-center">
          <h1 className="text-xl font-semibold font-stashly truncate">
            {collection.name}
          </h1>

          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
            <Badge variant="default" className="rounded">
              {collection.itemCount}{' '}
              {collection.itemCount === 1 ? 'item' : 'items'}
            </Badge>
            <span>{formatSize('byte', 'unit', Number(collection.size))}</span>
          </div>
        </div>

        <ButtonGroup>
          {/* Add items button */}
          <AddToCollectionDialog
            collectionId={collection.id}
            collectionName={collection.name}
            items={availableItems}
            existingItemIds={existingItemIds}
          >
            <Button
              variant="outline"
              size="default"
              className="font-stashly bg-card border-input"
            >
              <AddIcon className="size-5 text-current" />
              Add items
            </Button>
          </AddToCollectionDialog>

          {/* Actions dropdown — mirrors item-card-actions.tsx structure */}
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="bg-card border-input"
              >
                <MoreMenuFillIcon className="size-6!" />
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              align="end"
              className="space-y-4 w-48 bg-sidebar p-2"
            >
              <DropdownMenuGroup className="mt-2">
                <AddToCollectionDialog
                  collectionId={collection.id}
                  collectionName={collection.name}
                  items={availableItems}
                  existingItemIds={existingItemIds}
                >
                  <DropdownMenuItem
                    className="items-start"
                    onSelect={(e) => e.preventDefault()}
                  >
                    <AddIcon className="text-foreground" />
                    Add items
                  </DropdownMenuItem>
                </AddToCollectionDialog>
              </DropdownMenuGroup>

              <DropdownMenuGroup>
                <DropdownMenuLabel className="text-xs font-stashly text-muted-foreground">
                  Access
                </DropdownMenuLabel>
                <DropdownMenuItem className="items-start">
                  <ShareItemFillIcon className="text-foreground" />
                  Share
                </DropdownMenuItem>
                <DropdownMenuItem className="items-start">
                  <LockFillIcon className="text-foreground" />
                  Lock
                </DropdownMenuItem>
              </DropdownMenuGroup>

              <DropdownMenuGroup>
                <DropdownMenuLabel className="text-xs font-stashly text-muted-foreground">
                  Organize
                </DropdownMenuLabel>
                <DropdownMenuItem className="items-start">
                  <CopyFillIcon className="text-foreground" />
                  Copy
                </DropdownMenuItem>
                <DropdownMenuItem className="items-start">
                  <MoveFillIcon className="text-foreground" />
                  Move
                </DropdownMenuItem>
                <RenameDialog
                  defaultName={collection.name}
                  intent="rename_collection"
                  extraData={{ collectionId: collection.id }}
                  action="/api/collections"
                  title="Rename collection"
                >
                  <DropdownMenuItem
                    className="items-start"
                    onSelect={(e) => e.preventDefault()}
                  >
                    <RenameFillIcon className="text-foreground" />
                    Rename
                  </DropdownMenuItem>
                </RenameDialog>
              </DropdownMenuGroup>

              <DropdownMenuGroup>
                <DropdownMenuLabel className="text-xs font-stashly text-muted-foreground">
                  Information
                </DropdownMenuLabel>
                <DropdownMenuItem className="items-start">
                  <ActivityFillIcon className="text-foreground" />
                  Activity
                </DropdownMenuItem>
                <DropdownMenuItem className="items-start">
                  <DetailsFillIcon className="text-foreground" />
                  Details
                </DropdownMenuItem>
              </DropdownMenuGroup>

              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                className="mt-2 items-start"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  open({
                    variant: 'destructive',
                    title: `Move "${collection.name}" to trash?`,
                    description: 'Trashed collections can be restored later.',
                    confirmText: 'Move to trash',
                    onConfirm: handleDelete,
                  })
                }}
              >
                <TrashFillIcon className="text-foreground" />
                <span className="text-nowrap shrink-0">Move to trash</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                className="mt-2 items-start"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  open({
                    variant: 'destructive',
                    title: `Empty "${collection.name}"?`,
                    description:
                      'This will remove all items from this collection.',
                    confirmText: 'Empty collection',
                    onConfirm: handleEmpty,
                  })
                }}
              >
                <TrashFillIcon className="text-foreground" />
                <span className="text-nowrap shrink-0">Empty collection</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </ButtonGroup>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Grid card
// ---------------------------------------------------------------------------

function CollectionItemCard({ item }: { item: CollectionItem }) {
  const stashItem: StashItem = {
    ...item,
    status: 'normal',
    inclusiveSize: item.size,
    updatedAt: null,
    // Keep the real parent: `ItemCard` routes files through
    // `/…/folders/:folderId/files/:fileId`, so a null here collapsed the URL to
    // `/…/folders/files/:fileId` and the file page lost its folder context.
    parentId: item.parentId ?? null,
    ownerId: '',
    workspaceId: null,
    driveId: '',
    tags: [],
    thumbnails: item.thumbnailUrl
      ? [
          {
            id: item.id,
            url: item.thumbnailUrl,
            width: null,
            height: null,
            size: 'medium' as const,
            view: 'grid' as const,
            // The picker only ever carries a finished thumbnail URL, so this
            // stands in as a stage-2 row — what `ItemCard.Cover` looks for.
            stage: 2,
          },
        ]
      : [],
    favorites: [],
    file: null,
    folder: null,
    parent: null,
    locked: null,
  }

  const { collectionId } = useParams()

  const removeFromCollectionActions = collectionId ? (
    <>
      <ItemCard.Actions.Group>
        <ItemCard.Actions.Preview />
        <ItemCard.Actions.Download />
      </ItemCard.Actions.Group>
      <ItemCard.Actions.Group label="Quick actions">
        <ItemCard.Actions.Favorite />
        <ItemCard.Actions.Pin />
      </ItemCard.Actions.Group>
      <ItemCard.Actions.Group label="Access">
        <ItemCard.Actions.Share />
        <ItemCard.Actions.Invite />
        <ItemCard.Actions.Lock />
      </ItemCard.Actions.Group>
      <ItemCard.Actions.Group label="Organize">
        <ItemCard.Actions.Copy />
        <ItemCard.Actions.Move />
        <ItemCard.Actions.Rename />
      </ItemCard.Actions.Group>
      <ItemCard.Actions.Group label="Information">
        <ItemCard.Actions.Activity />
        <ItemCard.Actions.Details />
      </ItemCard.Actions.Group>
      <ItemCard.Actions.RemoveFromCollection collectionId={collectionId} />
    </>
  ) : undefined

  if (stashItem.type === 'folder') {
    return (
      <FolderCardTab {...stashItem}>
        {removeFromCollectionActions}
      </FolderCardTab>
    )
  }

  return (
    <FileCardDetail
      item={stashItem}
      className="ring-2! ring-accent bg-card"
      actions={removeFromCollectionActions}
    />
  )
}

// ---------------------------------------------------------------------------
// Item row
// ---------------------------------------------------------------------------

const rowVariants = {
  hidden: { opacity: 0, y: 4 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
}

function CollectionItemRow({ item }: { item: StashPickerItem }) {
  const fetcher = useFetcher()
  const { open } = useConfirm()
  const { collectionId } = useParams()
  const isRemoving = fetcher.state !== 'idle'

  function handleRemove() {
    fetcher.submit(
      { intent: 'remove_item', itemId: item.id, collectionId: collectionId! },
      { method: 'post', action: '/api/collections' }
    )
  }

  return (
    <motion.div
      layout
      variants={rowVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      transition={{ duration: 0.15 }}
      className={cn(
        'group flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 transition-colors hover:bg-accent/50',
        isRemoving && 'opacity-50 pointer-events-none'
      )}
    >
      {!item.thumbnailUrl ? (
        <ItemTypeIcon type={item.type} />
      ) : (
        <img
          src={item.thumbnailUrl}
          alt=""
          className="size-6 rounded object-cover shrink-0"
          width={24}
          height={24}
        />
      )}

      <span className="flex-1 truncate text-sm font-medium">{item.name}</span>

      <div className="flex items-center gap-3 shrink-0">
        <span className="text-xs text-muted-foreground tabular-nums">
          {formatSize('byte', 'unit', Number(item.size))}
        </span>

        <Button
          variant="ghost"
          size="icon"
          className="size-7 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() =>
            open({
              variant: 'destructive',
              title: `Remove "${item.name}"?`,
              description: 'This will remove the item from this collection.',
              confirmText: 'Remove',
              onConfirm: handleRemove,
            })
          }
          aria-label={`Remove ${item.name} from collection`}
        >
          <RemoveIcon className="size-4!" />
        </Button>
      </div>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function CollectionView({
  collection,
  items,
  availableItems,
  existingItemIds,
  hasMore,
  isLoading,
  loadMore,
  collectionsHref,
}: CollectionViewProps) {
  const [searchParams] = useSearchParams()
  const isGrid = searchParams.get('layout') === 'grid'

  return (
    <div className="flex flex-col gap-4 pb-8 px-1">
      <CollectionPageHeader
        collection={collection}
        collectionsHref={collectionsHref}
        availableItems={availableItems}
        existingItemIds={existingItemIds}
      />

      {items.length === 0 ? (
        <CollectionEmptyState key="empty" />
      ) : isGrid ? (
        <GridLayout>
          {items.map((item) => (
            <CollectionItemCard key={item.id} item={item} />
          ))}
        </GridLayout>
      ) : (
        <ListLayout items={items as StashItem[]} />
      )}
      {/* </AnimatePresence> */}
      {/* </div> */}

      {hasMore && (
        <div className="flex justify-center pt-2">
          <LoadMoreItems
            loadMore={loadMore}
            isLoading={isLoading}
            hasMore={hasMore}
          />
        </div>
      )}
    </div>
  )
}
