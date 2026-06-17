import { useCallback } from 'react'
import { useFetcher, href } from 'react-router'

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
