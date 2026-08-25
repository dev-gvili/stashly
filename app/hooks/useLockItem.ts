import { useFetcher } from 'react-router'
import { useCallback } from 'react'

type LockResponse = { locked?: boolean; error?: string }

/**
 * Optimistically toggles the locked state of an item via `POST /api/locks`.
 *
 * Derived state priority (highest → lowest):
 * 1. In-flight `fetcher.formData` intent (`lock` / `unlock`) — immediate optimistic value
 * 2. Settled `fetcher.data.locked` from the server response
 * 3. `initiallyLocked` prop (loader data)
 *
 * @param itemId - The ID of the item to lock or unlock.
 * @param initiallyLocked - Locked state from the server at render time (default `false`).
 *
 * @example
 * // Lock toggle in an item's actions menu
 * const { locked, toggle, isPending } = useLockItem(item.id, item.locked)
 * <DropdownMenuItem onSelect={toggle} disabled={isPending}>
 *   {locked ? 'Unlock' : 'Lock'}
 * </DropdownMenuItem>
 *
 * @example
 * // Gate destructive actions on the optimistic locked state
 * const { locked } = useLockItem(item.id, item.locked)
 * <Button variant="destructive" disabled={locked}>Delete</Button>
 *
 * @example
 * // Surface a server-side rejection (e.g. missing permission)
 * const { toggle, error } = useLockItem(item.id, item.locked)
 * {error && <p className="text-destructive text-sm">{error}</p>}
 */
export function useLockItem(itemId: string, initiallyLocked = false) {
  const fetcher = useFetcher<LockResponse>()

  const locked =
    fetcher.formData?.get('intent') === 'lock'
      ? true
      : fetcher.formData?.get('intent') === 'unlock'
        ? false
        : fetcher.data
          ? fetcher.data.locked
          : initiallyLocked

  const toggle = useCallback(() => {
    const intent = locked ? 'unlock' : 'lock'
    fetcher.submit({ intent, itemId }, { method: 'POST', action: '/api/locks' })
  }, [fetcher, itemId, locked])

  return {
    locked,
    toggle,
    isPending: fetcher.state !== 'idle',
    error: fetcher.data?.error,
  }
}
