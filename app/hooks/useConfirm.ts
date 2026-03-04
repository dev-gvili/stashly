import * as React from 'react'
import { open as openConfirm, openAsync as openConfirmAsync } from '@/utils/confirm'
import type { ConfirmDialogProps } from '@/components/confirm-dialog'

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
    openConfirm({ ...(defaultOptions as any), ...(options as any) })
  }

  // for callers that need the result
  const openAsyncWrapper = (options?: Partial<ConfirmDialogProps>) =>
    openConfirmAsync({ ...(defaultOptions as any), ...(options as any) })

  return { open, openAsync: openAsyncWrapper }
}
