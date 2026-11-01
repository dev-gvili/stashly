import { Link } from 'react-router'
import { RenameCollectionDialog } from '@/components/core-components/collection-dialogs'
import {
  AddIcon,
  CollectionFillIcon,
  MoreMenuFillIcon,
  RemoveSquareIcon,
  RenameFillIcon,
  TrashFillIcon,
} from '@/components/icons'
import useConfirm from '@/hooks/useConfirm'
import { useCollectionMutations } from '@/hooks/useCollectionMutations'
import { Button } from '@/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/ui/dropdown-menu'
import { cn } from '@/utils/styles'

interface CollectionActionsMenuProps {
  collection: { id: string; name: string; itemCount: number }
  /** `card`: Open + Add items on top. `detail`: Add items is already the page CTA. */
  variant?: 'card' | 'detail'
  /** Where Open and Add items go (card variant). */
  openHref?: string
  addHref?: string
  /** Current member ids, so Empty can offer Undo. */
  memberIds?: string[]
  className?: string
}

function plural(n: number) {
  return `${n} ${n === 1 ? 'file' : 'files'}`
}

/**
 * The ⋯ menu shared by the index card and the collection page. Lists only
 * actions that work; Empty is disabled at 0 files. Destructive actions confirm
 * first and say the files stay in the stash.
 *
 * @example
 * <CollectionActionsMenu collection={{ id, name, itemCount }} variant="detail" memberIds={ids} />
 */
export function CollectionActionsMenu({
  collection,
  variant = 'card',
  openHref,
  addHref,
  memberIds,
  className,
}: CollectionActionsMenuProps) {
  const { open } = useConfirm()
  const { empty, trash } = useCollectionMutations()
  const detail = variant === 'detail'

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant={detail ? 'outline' : 'ghost'}
          size="icon"
          aria-label="Collection actions"
          className={cn('size-8', detail && 'size-9 bg-card border-input', className)}
          onClick={(e) => e.stopPropagation()}
        >
          <MoreMenuFillIcon className="size-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="font-stashly w-55"
        onClick={(e) => e.stopPropagation()}
      >
        {!detail && openHref && (
          <DropdownMenuItem asChild>
            <Link to={openHref}>
              <CollectionFillIcon className="size-4" />
              Open
            </Link>
          </DropdownMenuItem>
        )}
        {!detail && addHref && (
          <DropdownMenuItem asChild>
            <Link to={addHref}>
              <AddIcon className="size-4" />
              Add items
            </Link>
          </DropdownMenuItem>
        )}
        <RenameCollectionDialog collection={collection}>
          <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
            <RenameFillIcon className="size-4" />
            Rename
          </DropdownMenuItem>
        </RenameCollectionDialog>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={collection.itemCount === 0}
          onSelect={() =>
            open({
              variant: 'destructive',
              title: `Empty “${collection.name}”?`,
              description: `Removes all ${plural(collection.itemCount)} from this collection. The files stay in your stash.`,
              confirmText: 'Empty collection',
              onConfirm: () => empty(collection, memberIds),
            })
          }
        >
          <RemoveSquareIcon className="size-4" />
          Empty collection
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="destructive"
          onSelect={() =>
            open({
              variant: 'destructive',
              title: `Move “${collection.name}” to trash?`,
              description: `You can restore the collection from Trash. The ${plural(collection.itemCount)} in it stay in your stash.`,
              confirmText: 'Move to trash',
              onConfirm: () => trash(collection),
            })
          }
        >
          <TrashFillIcon className="size-4" />
          Move to trash
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
