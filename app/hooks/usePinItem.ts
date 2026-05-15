import { useFetcher } from 'react-router'
import { useCallback } from 'react'

type PinResponse = { pinned?: boolean; error?: string }

export function usePinItem(itemId: string, initiallyPinned = false) {
  const fetcher = useFetcher<PinResponse>()

  const pinned =
    fetcher.formData?.get('intent') === 'pin'
      ? true
      : fetcher.formData?.get('intent') === 'unpin'
        ? false
        : (fetcher.data?.pinned ?? initiallyPinned)

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
