import { useCallback, useEffect, useRef } from 'react'

/**
 * A callback whose identity never changes but which always calls the latest
 * function it was given.
 *
 * For effects that mount something expensive and take their callbacks as
 * dependencies — the Monaco viewer is the case this exists for. A parent
 * passing an inline arrow would otherwise hand over a new function on every
 * render and tear the whole editor down with it.
 *
 * The wrapper is no-op-safe: an undefined callback is simply not called.
 *
 * @param callback - The function to keep current. May be undefined, and may be a
 *   fresh inline arrow on every render — the wrapper's identity won't change.
 *
 * @example
 * // Keep the Monaco viewer from remounting when the parent passes an inline arrow
 * const onSave = useStableCallback(props.onSave)
 * useEffect(() => mountEditor({ onSave }), [onSave]) // effect runs once
 *
 * @example
 * // Safe with an optional prop — no guard needed at the call site
 * const onChange = useStableCallback(props.onChange)
 * onChange(nextValue) // does nothing when props.onChange is undefined
 *
 * @example
 * // Stable handler for a long-lived subscription
 * const handleMessage = useStableCallback((e: MessageEvent) => setLast(e.data))
 * useEffect(() => {
 *   worker.addEventListener('message', handleMessage)
 *   return () => worker.removeEventListener('message', handleMessage)
 * }, [handleMessage])
 */
export function useStableCallback<Args extends unknown[]>(
  callback?: (...args: Args) => void
): (...args: Args) => void {
  const latest = useRef(callback)
  useEffect(() => {
    latest.current = callback
  }, [callback])
  return useCallback((...args: Args) => latest.current?.(...args), [])
}
