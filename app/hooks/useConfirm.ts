import * as React from 'react'
import { open as openConfirm, openAsync as openConfirmAsync } from '@/utils/confirm'
import type { ConfirmDialogProps } from '@/components/confirm-dialog'

/**
 * Opens an imperative confirm dialog without lifting open/close state into the component.
 * Accepts a default `onConfirm` handler or a full options object; both can be overridden
 * per `open()` call.
 *
 * @param handlerOrOptions - Default confirm handler or partial `ConfirmDialogProps`.
 *
 * @example
 * // Inline handler
 * const { open } = useConfirm(() => fetcher.submit({ intent: 'delete' }, { method: 'POST' }))
 * <Button onClick={() => open({ title: 'Delete file?', confirmText: 'Delete', variant: 'destructive' })} />
 *
 * @example
 * // Full options upfront
 * const { open } = useConfirm({ title: 'Trash item?', variant: 'destructive', onConfirm: handleTrash })
 * <Button onClick={() => open()} />
 *
 * @example
 * // Async variant — wait for the user's choice
 * const { openAsync } = useConfirm()
 * const confirmed = await openAsync({ title: 'Empty bucket?' })
 * if (confirmed) await emptyBucket()
 */
export default function useConfirm(
  handlerOrOptions?: (() => void) | Partial<ConfirmDialogProps>
) {
  const defaultOptions = React.useMemo(() => {
    if (typeof handlerOrOptions === 'function') {
      return { onConfirm: handlerOrOptions }
    }
    return handlerOrOptions ?? {}
  }, [handlerOrOptions])

  // fire-and-forget friendly API for usage in event handlers
  const open = (options?: Partial<ConfirmDialogProps>) => {
    openConfirm({ ...defaultOptions, ...options })
  }

  // for callers that need the result
  const openAsyncWrapper = (options?: Partial<ConfirmDialogProps>) =>
    openConfirmAsync({ ...defaultOptions, ...options })

  return { open, openAsync: openAsyncWrapper }
}
