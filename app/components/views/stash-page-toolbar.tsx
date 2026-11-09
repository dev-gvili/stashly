import { useState } from 'react'
import { href, useFetcher, useNavigate } from 'react-router'
import {
  PageToolbarPathRail,
  PathRailSelectionActions,
} from '@/components/core-components/page-toolbar'
import type { LibraryStats, ToolbarContext } from '@/types/stash.types'
import { MoveToFolderDialog } from '@/components/core-components/move-to-folder-dialog'
import { ShareDialog } from '@/components/core-components/share-dialog'
import { useSelection } from '@/hooks/useSelection'
import { useCollectionMutations } from '@/hooks/useCollectionMutations'
import { useDownloadItems } from '@/hooks/useDownloadItems'
import useConfirm from '@/hooks/useConfirm'
import type { StashItem } from '@/types/stash.types'

/**
 * What the toolbar reads from a row: its id, its name (dialog titles), its
 * type (folders can't be shared as files or downloaded yet) and its bytes. Any
 * page's rows fit — stash items, or the Images page's tiles.
 */
export type StashToolbarItem = Pick<StashItem, 'id' | 'name'> & {
  type?: StashItem['type']
  size?: StashItem['size'] | number | null
  inclusiveSize?: StashItem['inclusiveSize'] | number | null
}

/** The selection actions a page can show, in the order the rail draws them. */
export type SelectionAction =
  | 'addToCollection'
  | 'move'
  | 'share'
  | 'download'
  | 'trash'
  | 'clear'

const DEFAULT_ACTIONS: SelectionAction[] = ['move', 'share', 'download', 'trash']

export interface StashPageToolbarProps {
  /** Drive-wide counters from the route loader. */
  stats: Pick<LibraryStats, 'size' | 'files' | 'folders'>
  /** The page's items — needed for names, types and the selected bytes. */
  items: StashToolbarItem[]
  context?: ToolbarContext
  /** Folder the page is showing; the move picker disables it as a target. */
  parentId?: string | null
  parentName?: string | null
  driveId?: string
  /**
   * `rail` (default): the full path rail row. `actions`: only the rail's
   * selection group, rendered while something is selected and nothing
   * otherwise — for a header that has no room for a second row (Images).
   */
  variant?: 'rail' | 'actions'
  /** Which selection actions to show. Default: Move, Share, Download, Trash. */
  actionSet?: SelectionAction[]
  /** Ask before moving the selection to Trash. */
  confirmTrash?: boolean
}

/**
 * Route-level wiring for the stash toolbar: every bulk action lives here, and
 * the rail (`PageToolbarPathRail` / `PathRailSelectionActions`) only draws the
 * ones a page asks for in `actionSet`. Actions use the existing intents —
 * `/api/items` (trash, restore, delete, `download_urls`), `/api/favorites`,
 * `/api/collections` (`add_items_to_collection`) — and the existing dialogs
 * (`MoveToFolderDialog`, `ShareDialog`). Must render where the shared
 * selection actor has the page's items (a `<SelectionProvider>`).
 *
 * @example
 * <SelectionProvider items={items.map((i) => i.id)}>
 *   <StashPageToolbar stats={loaderData.stats} items={items} />
 *   <GridLayout>{…}</GridLayout>
 * </SelectionProvider>
 *
 * @example
 * // Images header: only the selection group, with the gallery's actions
 * <StashPageToolbar variant="actions" items={items} stats={stats}
 *   actionSet={['addToCollection', 'share', 'download', 'trash', 'clear']} confirmTrash />
 */
export function StashPageToolbar({
  stats,
  items,
  context = 'files',
  parentId = null,
  parentName = null,
  driveId = '',
  variant = 'rail',
  actionSet = DEFAULT_ACTIONS,
  confirmTrash = false,
}: StashPageToolbarProps) {
  const fetcher = useFetcher()
  const navigate = useNavigate()
  const { selectedIds, unselectAll } = useSelection()
  const collections = useCollectionMutations()
  const { download, isDownloading } = useDownloadItems()
  const [moveOpen, setMoveOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)

  const selectedItems = selectedIds.join(',')
  const selected = items.filter((item) => selectedIds.includes(item.id))
  const single = selectedIds.length === 1 ? selected[0] : undefined
  const anyFolder = selected.some((item) => item.type === 'folder')
  const count = selectedIds.length
  const noun = (n: number) => `${n} item${n === 1 ? '' : 's'}`

  const submit = (intent: string, action: string) =>
    fetcher.submit({ intent, selectedItems }, { method: 'POST', action })

  const { open: confirmDelete } = useConfirm(() =>
    submit('delete_items', href('/api/items'))
  )
  const { openAsync } = useConfirm()

  const trash = async () => {
    if (confirmTrash) {
      const ok = await openAsync({
        variant: 'destructive',
        title: `Move ${noun(count)} to Trash?`,
        description: 'You can restore them from Trash.',
        confirmText: 'Move to Trash',
      })
      if (!ok) return
    }
    submit('trash_items', href('/api/items'))
  }

  const has = (action: SelectionAction) => actionSet.includes(action)

  const actions = {
    onMove: has('move') ? () => setMoveOpen(true) : undefined,
    onFavorite: () => submit('favorite_items', href('/api/favorites')),
    onShare: has('share') ? () => setShareOpen(true) : undefined,
    onDownload: has('download') ? () => download(selectedIds) : undefined,
    onTrash: has('trash') ? trash : undefined,
    onRestore: () => submit('restore_items', href('/api/items')),
    onDeleteForever: () =>
      confirmDelete({
        variant: 'destructive',
        title: `Permanently delete ${noun(count)}?`,
        description:
          'This action cannot be undone, deleted items cannot be restored.',
        confirmText: 'Delete',
      }),
    onAddToCollection: has('addToCollection')
      ? (collection: { id: string; name: string }) => {
          collections.addItems(collection, selectedIds)
          unselectAll('selectedItems')
        }
      : undefined,
    onClear: has('clear') ? () => unselectAll('selectedItems') : undefined,
    shareDisabledReason:
      count > 1 ? 'Share one item at a time' : null,
    downloadDisabledReason: isDownloading
      ? 'Preparing download…'
      : anyFolder
        ? 'Folders can’t be downloaded yet'
        : null,
  }

  return (
    <>
      {variant === 'actions' ? (
        count > 0 && (
          <PathRailSelectionActions selectedCount={count} context={context} {...actions} />
        )
      ) : (
        <PageToolbarPathRail
          context={context}
          stats={stats}
          // Trash counts what the bin holds, not what the live drive holds.
          itemCount={context === 'trash' ? 0 : stats.files + stats.folders}
          onBack={() => navigate(-1)}
          {...actions}
        />
      )}
      {/* The picker takes a comma-joined id list; it splits back out and
          submits `move_items` for a multi-selection. */}
      <MoveToFolderDialog
        open={moveOpen}
        onOpenChange={setMoveOpen}
        itemId={selectedItems}
        itemName={single?.name ?? noun(count)}
        itemType="file"
        sourceParentId={parentId}
        sourceParentName={parentName}
        driveId={driveId}
      />
      {single && (
        <ShareDialog
          open={shareOpen}
          onOpenChange={setShareOpen}
          itemId={single.id}
          itemName={single.name}
          itemType={single.type === 'folder' ? 'folder' : 'file'}
        />
      )}
    </>
  )
}
