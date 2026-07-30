import { useState } from 'react'
import { href, useFetcher } from 'react-router'
import { PageToolbarMorph, PageToolbarDock, PageToolbarPathRail } from '@/components/core-components/page-toolbar'
import type {
  LibraryStats,
  ToolbarContext,
  ToolbarLayout,
} from '@/components/core-components/page-toolbar'
import { MoveToFolderDialog } from '@/components/core-components/move-to-folder-dialog'
import { useSelection } from '@/components/stash/selection'
import useConfirm from '@/hooks/useConfirm'
import { formatSize } from '@/utils/formaters'
import type { StashItem } from '@/types/stash.types'

export interface StashPageToolbarProps {
  /** Drive-wide counters from the route loader. */
  stats: LibraryStats
  /** The page's items — needed to total the bytes behind the selected ids. */
  items: StashItem[]
  context?: ToolbarContext
  /** Folder the page is showing; the move picker disables it as a target. */
  parentId?: string | null
  parentName?: string | null
  driveId?: string
  layout?: ToolbarLayout
  onLayoutChange?: (layout: ToolbarLayout) => void
}

/**
 * Route-level wiring for `PageToolbarMorph`: totals the selected bytes and
 * connects the bulk actions to the existing `/api/items` and `/api/favorites`
 * intents. Must render inside a `<SelectionProvider>` — it reads the shared
 * selection actor, same as the item grid it sits above.
 *
 * @example
 * <SelectionProvider items={items.map((i) => i.id)}>
 *   <StashPageToolbar stats={loaderData.stats} items={items} />
 *   <GridLayout>{…}</GridLayout>
 * </SelectionProvider>
 */
export function StashPageToolbar({
  stats,
  items,
  context = 'files',
  parentId = null,
  parentName = null,
  driveId = '',
  layout,
  onLayoutChange,
}: StashPageToolbarProps) {
  const fetcher = useFetcher()
  const { selectedIds } = useSelection()
  const [moveOpen, setMoveOpen] = useState(false)

  const selectedItems = selectedIds.join(',')
  const selectedBytes = items
    .filter((item) => selectedIds.includes(item.id))
    .reduce((sum, item) => sum + Number(item.inclusiveSize ?? item.size ?? 0), 0)

  const submit = (intent: string, action: string) =>
    fetcher.submit(
      { intent, selectedItems },
      { method: 'POST', action }
    )

  const { open: confirmDelete } = useConfirm(() =>
    submit('delete_items', href('/api/items'))
  )

  return (
    <>
      <PageToolbarMorph
        context={context}
        stats={stats}
        layout={layout}
        onMove={() => setMoveOpen(true)}
        onFavorite={() => submit('favorite_items', href('/api/favorites'))}
        onTrash={() => submit('trash_items', href('/api/items'))}
        onRestore={() => submit('restore_items', href('/api/items'))}
        onDeleteForever={() =>
          confirmDelete({
            variant: 'destructive',
            title: `Permanently delete ${selectedIds.length} item${selectedIds.length === 1 ? '' : 's'}?`,
            description:
              'This action cannot be undone, deleted items cannot be restored.',
            confirmText: 'Delete',
          })
        }
      />
      {/* The picker takes a comma-joined id list; it splits back out and
          submits `move_items` for a multi-selection. */}
      <MoveToFolderDialog
        open={moveOpen}
        onOpenChange={setMoveOpen}
        itemId={selectedItems}
        itemName={
          selectedIds.length === 1
            ? (items.find((i) => i.id === selectedIds[0])?.name ??
              `${selectedIds.length} items`)
            : `${selectedIds.length} items`
        }
        itemType="file"
        sourceParentId={parentId}
        sourceParentName={parentName}
        driveId={driveId}
      />
    </>
  )
}
