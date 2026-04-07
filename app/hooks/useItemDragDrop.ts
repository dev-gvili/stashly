import React from 'react'
import { useSearchParams, useSubmit } from 'react-router'
import type { ItemType } from '@/prisma/browser'
import { getQueryParamArray, hasQueryParamValue } from '@/utils/query-params'

/**
 * The key used for identifying stash items during drag-and-drop operations.
 */
export const DRAG_ITEM_KEY = 'application/stashly-item-id'

/**
 * A custom hook to manage drag-and-drop functionality for stash items.
 * It allows items to be dragged and folders to act as drop targets for moving items.
 * 
 * If the dragged item is part of a selection (via `selectedItems` query param), 
 * the entire selection is moved. Otherwise, only the individual dragged item is moved.
 *
 * @param {object} params - The parameters for the hook.
 * @param {string} params.id - The unique identifier of the item.
 * @param {ItemType} params.type - The type of the item (e.g., 'folder', 'file').
 * 
 * @returns {object} An object containing drag state and event handlers.
 * 
 * @example
 * const { handleDragStart, handleDrop, isDragOver } = useItemDragDrop({ 
 *   id: 'item_123', 
 *   type: 'folder' 
 * });
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
