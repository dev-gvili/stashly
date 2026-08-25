import { useFetcher } from 'react-router'
import { useCallback } from 'react'

type PinResponse = { pinned?: boolean; error?: string }

/**
 * Optimistically toggles the pinned state of an item via `POST /api/pins`.
 *
 * Derived state priority (highest → lowest):
 * 1. In-flight `fetcher.formData` intent (`pin` / `unpin`) — immediate optimistic value
 * 2. Settled `fetcher.data.pinned` from the server response
 * 3. `initiallyPinned` prop (loader data)
 *
 * @param itemId - The ID of the item to pin or unpin.
 * @param initiallyPinned - Pinned state from the server at render time (default `false`).
 *
 * @example
 * // Basic toggle button inside an item card
 * function PinButton({ item }: { item: StashItem }) {
 *   const alreadyPinned = item.pins?.some(p => p.userId === currentUserId) ?? false
 *   const { pinned, toggle, isPending } = usePinItem(item.id, alreadyPinned)
 *
 *   return (
 *     <button onClick={toggle} disabled={isPending} aria-pressed={pinned}>
 *       {pinned ? 'Unpin' : 'Pin'}
 *     </button>
 *   )
 * }
 *
 * @example
 * // Inside ItemCard.Actions — label mirrors CLAUDE.md convention
 * const { pinned, toggle } = usePinItem(item.id, item.pins?.length > 0)
 * <DropdownMenuItem onSelect={toggle}>
 *   {pinned ? 'Remove pin' : 'Pin to top'}
 * </DropdownMenuItem>
 */
export function usePinItem(itemId: string, initiallyPinned = false) {
  const fetcher = useFetcher<PinResponse>()

  const pinned =
    fetcher.formData?.get('intent') === 'pin'
      ? true
      : fetcher.formData?.get('intent') === 'unpin'
        ? false
        : (fetcher.data?.pinned ?? initiallyPinned)

  console.log('usePinItem', { itemId, initiallyPinned, pinned, formData: fetcher.formData, responseData: fetcher.data })      
  
  const toggle = useCallback(() => {
    const intent = pinned ? 'unpin' : 'pin'
    fetcher.submit(
      { intent, itemId },
      { method: 'POST', action: '/api/pins' }
    )
  }, [fetcher, itemId, pinned])

  return {
    pinned,
    toggle,
    isPending: fetcher.state !== 'idle',
  }
}
