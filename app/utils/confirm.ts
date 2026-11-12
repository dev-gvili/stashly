import { createActor } from 'xstate'
import { confirmMachine } from '@/machines/confirm.machine'
import type { ConfirmOptions } from '@/machines/confirm.machine'

/** The legacy `labels` option some callers still pass instead of confirmText/cancelText. */type ConfirmLabels = { labels?: { confirm?: string; cancel?: string } }
const service = createActor(confirmMachine).start()

/**
 * Normalizes the options for the confirm dialog, providing default values where necessary.
 * @param options - Partial options provided by the user.
 * @returns Complete `ConfirmOptions` object with defaults applied.
 */
function normalizeOptions(options: Partial<ConfirmOptions>): ConfirmOptions {
  return {
    title: options.title ?? 'Confirm',
    description: options.description ?? options.children,
    children: options.children,
    confirmText:
      options.confirmText ?? (options as ConfirmLabels)?.labels?.confirm ?? 'Confirm',
    cancelText:
      options.cancelText ?? (options as ConfirmLabels)?.labels?.cancel ?? 'Cancel',
    confirmProps: options.confirmProps,
    cancelProps: options.cancelProps,
    variant: options.variant,
    size: options.size,
    asChild: options.asChild ?? false,
    onConfirm: options.onConfirm,
    onCancel: options.onCancel,
  }
}

/**
 * Fire-and-forget open; intended to be called from event handlers (e.g. onClick)
 */
export function open(options: Partial<ConfirmOptions>) {
  const opt = normalizeOptions(options)
  service.send({ type: 'OPEN', props: opt })
}

/**
 * Open and return a Promise that resolves to true (confirmed) or false (cancelled).
 * Because this service does not queue multiple dialogs, calling `openAsync` while a
 * dialog is already open will replace it and the returned Promise will resolve for
 * the most recent open call.
 */
export function openAsync(options: Partial<ConfirmOptions>): Promise<boolean> {
  const opt = normalizeOptions(options)
  service.send({ type: 'OPEN', props: opt })
  return new Promise((resolve) => {
    const unsubscribe = service.subscribe((state) => {
      if (state.matches('idle') && state.context.lastResult !== undefined) {
        unsubscribe.unsubscribe()
        resolve(Boolean(state.context.lastResult))
      }
    })
  })
}

export function close() {
  service.send({ type: 'CLOSE' })
}

export function cancel() {
  service.send({ type: 'CANCEL' })
}

export function getConfirmState() {
  return service.getSnapshot().context
}

export const confirmService = service
