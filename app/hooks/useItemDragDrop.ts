import React from 'react'
import { useSearchParams, useSubmit } from 'react-router'
import type { ItemType } from '@/prisma/browser'
import { getQueryParamArray, hasQueryParamValue } from '@/utils/query-params'

/**
 * The key used for identifying stash items during drag-and-drop operations.
 */
export const DRAG_ITEM_KEY = 'application/stashly-item-id'

/**
 * Drag-and-drop handler for stash items. Files are draggable; folders are drop targets.
 * When a dragged item belongs to the current `selectedItems` URL selection, the entire
 * selection is moved to the target folder. Otherwise only the single item is moved.
 * Submits `intent: 'move_items'` to `/api/items` on drop.
 *
 * @param params.id - The item's ID.
 * @param params.type - Item type — only `'folder'` accepts drops.
 * @returns Drag state + event handlers to spread onto the item element.
 *
 * @example
 * // Spread onto an ItemCard to make it draggable + a folder drop target
 * const { handleDragStart, handleDragOver, handleDragLeave, handleDrop, isDragOver } =
 *   useItemDragDrop({ id: item.id, type: item.type })
 * <div draggable onDragStart={handleDragStart} onDragOver={handleDragOver}
 *      onDragLeave={handleDragLeave} onDrop={handleDrop}
 *      className={isDragOver ? 'ring-2 ring-primary' : ''} />
 *
 * @example
 * // isDragOver highlights a folder when a file is dragged over it
 * const { isDragOver } = useItemDragDrop({ id: folderId, type: 'folder' })
 * <FolderCard className={cn(isDragOver && 'bg-muted ring-2')} />
 *
 * @example
 * // Files are draggable but never accept drops — isFolder gates all drop logic
 * const { handleDragStart } = useItemDragDrop({ id: fileId, type: 'file' })
 * <div draggable onDragStart={handleDragStart} /> // no drop handlers needed
 */
export function useItemDragDrop({ id, type }: { id: string; type: ItemType }) {
  const submit = useSubmit()
  const [searchParams] = useSearchParams()
  const [isDragOver, setIsDragOver] = React.useState(false)
  const isFolder = type === 'folder'

  const onDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData(DRAG_ITEM_KEY, id)
    e.dataTransfer.effectAllowed = 'move'
  }

  const onDragOver = (e: React.DragEvent) => {
    if (!isFolder) return
    if (!e.dataTransfer.types.includes(DRAG_ITEM_KEY)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setIsDragOver(true)
  }

  const onDragLeave = (e: React.DragEvent) => {
    if (!isFolder) return
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false)
    }
  }

  const onDrop = (e: React.DragEvent) => {
    if (!isFolder) return
    e.preventDefault()
    setIsDragOver(false)
    const draggedItemId = e.dataTransfer.getData(DRAG_ITEM_KEY)
    if (!draggedItemId || draggedItemId === id) return
    const selectedIds = getQueryParamArray(searchParams, 'selectedItems')
    const itemsToMove = hasQueryParamValue(searchParams, 'selectedItems', draggedItemId)
      ? selectedIds
      : [draggedItemId]
    const validItems = itemsToMove.filter((itemId) => itemId !== id)
    if (validItems.length === 0) return
    submit(
      {
        intent: 'move_items',
        selectedItems: validItems.join(','),
        targetFolderId: id,
      },
      { method: 'POST', action: '/api/items', replace: true }
    )
  }

  return {
    isDragOver,
    isFolder,
    handleDragStart: onDragStart,
    handleDragOver: onDragOver,
    handleDragLeave: onDragLeave,
    handleDrop: onDrop,
  }
}
