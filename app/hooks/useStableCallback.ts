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
 * Returns a no-op-safe wrapper: an undefined callback is simply not called.
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
