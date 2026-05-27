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
 * @returns An object with:
 *   - `locked` — current optimistic locked state
 *   - `toggle` — fires the lock/unlock mutation
 *   - `isPending` — `true` while the request is in-flight
 *   - `error` — error message from the server, if any
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
