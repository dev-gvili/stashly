/**
 * A restartable trailing-edge timer.
 *
 * Four places in the app hand-rolled this, each slightly differently, and two
 * of them independently invented the same "skip what was already handled"
 * guard. The behaviour that is easy to get wrong lives here so it can be
 * tested: replacing a pending call rather than queueing a second one,
 * cancelling cleanly on teardown, and flushing a pending call synchronously
 * when a component is going away and the write still has to happen.
 *
 * Deliberately framework-free. `app/.client/` modules and imperative callbacks
 * cannot use a hook, and a plain function is testable in the repo's existing
 * `environment: 'node'` Vitest setup without adding a DOM.
 *
 * The delay is passed per call rather than baked in at construction because
 * callers legitimately vary it — an immediate rebuild versus a debounced one.
 */
export interface Debouncer {
  /** Schedule `fn` after `delayMs`, replacing any call already pending. */
  call(fn: () => void, delayMs: number): void
  /** Drop the pending call without running it. */
  cancel(): void
  /** Run the pending call now, if there is one. */
  flush(): void
  /** Whether a call is currently scheduled. */
  readonly pending: boolean
}

/**
 * @example
 * // Imperative caller with a teardown path
 * const saves = createDebouncer()
 * onPan(() => saves.call(() => persist(state), 200))
 * onUnmount(() => saves.flush())
 *
 * @example
 * // Varying the delay per call
 * const rebuilds = createDebouncer()
 * rebuilds.call(build, 0) // first paint
 * rebuilds.call(build, 250) // subsequent edits
 */
export function createDebouncer(): Debouncer {
  let timer: ReturnType<typeof setTimeout> | null = null
  let queued: (() => void) | null = null

  const clear = () => {
    if (timer !== null) clearTimeout(timer)
    timer = null
    queued = null
  }

  return {
    call(fn, delayMs) {
      if (timer !== null) clearTimeout(timer)
      queued = fn
      timer = setTimeout(() => {
        // Read and clear *before* running: `fn` is free to schedule the next
        // call, and it must not be wiped out by this one's bookkeeping.
        const run = queued
        timer = null
        queued = null
        run?.()
      }, delayMs)
    },
    cancel: clear,
    flush() {
      const run = queued
      clear()
      run?.()
    },
    get pending() {
      return timer !== null
    },
  }
}
