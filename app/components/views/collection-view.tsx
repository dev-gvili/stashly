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
  ActivityIcon,
  AddIcon,
  CollectionIcon,
  CopyIcon,
  FileDetailsIcon,
  FileIcon,
  FolderIcon,
  LockIcon,
  MenuDotsIcon,
  MoveToFolder,
  RemoveIcon,
  RenameIcon,
  ShareItemIcon,
  TrashIcon,
} from '@/components/icons'
import { formatSize } from '@/utils/formaters'
import { cn } from '@/utils/styles'
import useConfirm from '@/hooks/useConfirm'
import type { Item, ItemType } from '@/prisma/client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CollectionHeader {
  id: string
  name: string
  size: bigint | number
  itemCount: number
}

interface CollectionViewProps {
  collection: CollectionHeader
  items: Item[]
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

function ItemTypeIcon({ type, className }: { type: ItemType; className?: string }) {
  if (type === 'folder')
    return <FolderIcon className={cn('size-4 text-amber-500', className)} />
  if (type === 'collection')
    return <CollectionIcon className={cn('size-4 text-violet-500', className)} />
  return <FileIcon className={cn('size-4 text-muted-foreground', className)} />
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

  return (
    <>
      <div className="flex items-start justify-between gap-4 px-4 pt-4">
        <div className="flex flex-col gap-1 min-w-0">
          {/* Breadcrumb */}
          <nav
            aria-label="Breadcrumb"
            className="flex items-center gap-1 text-xs text-muted-foreground"
          >
            <Link
              to={collectionsHref}
              className="hover:text-foreground transition-colors"
            >
              Collections
            </Link>
            <span aria-hidden>/</span>
            <span className="text-foreground truncate">{collection.name}</span>
          </nav>

          <h1 className="text-xl font-semibold font-stashly truncate">
            {collection.name}
          </h1>

          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
            <Badge variant="secondary" className="font-normal">
              {collection.itemCount} {collection.itemCount === 1 ? 'item' : 'items'}
            </Badge>
            <span>{formatSize('byte', 'unit', Number(collection.size))}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Add items button */}
          <Button
            size="sm"
            variant="outline"
            className="font-stashly gap-1.5"
            onClick={() => setAddOpen(true)}
          >
            <AddIcon className="size-4!" />
            Add items
          </Button>

          {/* Actions dropdown — mirrors item-card-actions.tsx structure */}
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger>
              <MenuDotsIcon className="size-6!" />
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="space-y-4 w-48">
              <DropdownMenuGroup className="mt-2">
                <DropdownMenuItem className="items-start" onSelect={() => setAddOpen(true)}>
                  <AddIcon className="text-foreground" />
                  Add items
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
                    <RenameIcon className="text-foreground" />
                    Rename
                  </DropdownMenuItem>
                </RenameDialog>
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
                <TrashIcon className="text-foreground" />
                <span className="text-nowrap shrink-0">Move to trash</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Full-screen add-to-collection dialog */}
      <AddToCollectionDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        collectionId={collection.id}
        collectionName={collection.name}
        items={availableItems}
        existingItemIds={existingItemIds}
      />
    </>
  )
}

// ---------------------------------------------------------------------------
// Grid card
// ---------------------------------------------------------------------------

function CollectionItemCard({ item }: { item: Item }) {
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
        'group relative flex flex-col rounded-lg border bg-card overflow-hidden select-none transition-colors hover:bg-accent/50',
        isRemoving && 'opacity-50 pointer-events-none'
      )}
    >
      {/* Thumbnail / icon area */}
      <div className="flex items-center justify-center bg-muted/40 h-32">
        <ItemTypeIcon type={item.type} className="size-10!" />
      </div>

      {/* Footer */}
      <div className="flex items-center gap-2 px-3 py-2">
        <ItemTypeIcon type={item.type} className="shrink-0" />
        <span className="flex-1 truncate text-sm font-medium">{item.name}</span>
        <span className="text-xs text-muted-foreground tabular-nums shrink-0">
          {formatSize('byte', 'unit', Number(item.size))}
        </span>
      </div>

      {/* Remove button — top-right on hover */}
      <Button
        variant="secondary"
        size="icon"
        className="absolute top-2 right-2 size-7 opacity-0 group-hover:opacity-100 transition-opacity"
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
    </motion.div>
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

function CollectionItemRow({ item }: { item: Item }) {
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
      <ItemTypeIcon type={item.type} />

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
    <div className="flex flex-col gap-4 pb-8">
      <CollectionPageHeader
        collection={collection}
        collectionsHref={collectionsHref}
        availableItems={availableItems}
        existingItemIds={existingItemIds}
      />

      <Separator />

      <div className={cn('px-4', isGrid ? 'grid 2xl:grid-cols-6 lg:grid-cols-4 md:grid-cols-3 sm:grid-cols-2 grid-cols-1 gap-2' : 'flex flex-col gap-1.5')}>
        <AnimatePresence mode="popLayout">
          {items.length === 0 ? (
            <CollectionEmptyState key="empty" />
          ) : isGrid ? (
            items.map((item) => <CollectionItemCard key={item.id} item={item} />)
          ) : (
            items.map((item) => <CollectionItemRow key={item.id} item={item} />)
          )}
        </AnimatePresence>
      </div>

      {hasMore && (
        <div className="flex justify-center pt-2">
          <LoadMoreItems loadMore={loadMore} isLoading={isLoading} hasMore={hasMore} />
        </div>
      )}
    </div>
  )
}
