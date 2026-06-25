import { useCallback } from 'react'
import { useFetcher, href } from 'react-router'

/**
 * Moves one or more items into a target folder via `POST /api/items`.
 * Picks the right intent automatically: `move_items` for a multi-item move,
 * `move_item` for a single item. The move is submitted through a dedicated
 * fetcher, so the calling component stays mounted and can show pending state.
 *
 * @param currentParentId - The folder the items currently live in. Sent along so
 *   the server can revalidate/repaginate the source folder after the move.
 *
 * @example
 * // Move the current selection into a folder chosen from a picker dialog
 * const { move, isPending } = useMoveToFolder(parentId)
 * <MoveDialog onPick={(folderId) => move(folderId, selectedIds)} disabled={isPending} />
 *
 * @example
 * // Single-item move — `move` collapses to the `move_item` intent automatically
 * const { move } = useMoveToFolder(item.parentId ?? rootId)
 * <DropdownMenuItem onSelect={() => move(targetFolderId, [item.id])}>
 *   Move here
 * </DropdownMenuItem>
 *
 * @example
 * // Read the server response after the move settles
 * const { move, item, isPending } = useMoveToFolder(currentParentId)
 * useEffect(() => { if (item && !isPending) toast('Moved') }, [item, isPending])
 */
export function useMoveToFolder(currentParentId: string) {
  const fetcher = useFetcher()

  const move = useCallback(
    (targetFolderId: string, ids: string[]) => {
      if (ids.length > 1) {
        fetcher.submit(
          {
            intent: 'move_items',
            selectedItems: ids.join(','),
            targetFolderId,
            currentParentId,
          },
          { method: 'POST', action: href('/api/items') }
        )
      } else {
        fetcher.submit(
          {
            intent: 'move_item',
            selectedItem: ids[0],
            targetFolderId,
            currentParentId,
          },
          { method: 'POST', action: href('/api/items') }
        )
      }
    },
    [currentParentId]
  )

  return {
    move,
    item: fetcher.data,
    isPending: fetcher.state !== 'idle',
  }
}
