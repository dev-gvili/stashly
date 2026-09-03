import { useEffect, useMemo, useRef } from 'react'
import { createDebouncer, type Debouncer } from '@/utils/debounce'

/** Matches the delay the adopting call sites already used. */
const DEFAULT_DELAY_MS = 200

export interface UseDebouncedCommit<T> {
  /**
   * Record `value` as already committed and drop anything pending.
   *
   * For a caller whose committed value can change from outside — a URL the
   * user navigated back to, a field cleared by another control — this is what
   * stops the incoming value being immediately echoed back out again.
   */
  markCommitted: (value: T) => void
  /** Commit the pending value now rather than waiting out the delay. */
  flush: () => void
  /** Drop the pending commit. */
  cancel: () => void
}

/**
 * Commit a value once it stops changing, skipping values already committed.
 *
 * The shape three call sites had each built by hand. Two details are easy to
 * get wrong and are handled here once:
 *
 *   • **The committed guard.** Without it, a value arriving from outside is
 *     immediately pushed back out, and a caller writing to shared state
 *     (a URL, a route) loops.
 *   • **The callback ref.** `commit` is usually rebuilt every render — a hook
 *     result, an inline closure. Depending on it directly would clear and
 *     restart the timer on every render, and the debounce would silently
 *     never fire.
 *
 * @param value - The value to commit once it settles.
 * @param commit - Called with the settled value. Identity may change freely.
 * @param options.delayMs - Quiet period before committing. Defaults to 200.
 * @param options.enabled - Pass false to suspend committing entirely.
 *
 * @example
 * // A search field whose text is local and whose URL write is debounced
 * const [text, setText] = useState(query)
 * const { markCommitted } = useDebouncedCommit(text, setQuery)
 * useEffect(() => {
 *   markCommitted(query)
 *   setText(query)
 * }, [query, markCommitted])
 *
 * @example
 * // Coalesce a burst of uploads into one revalidation
 * useDebouncedCommit(createdCount, () => revalidate(), { delayMs: 700 })
 */
export function useDebouncedCommit<T>(
  value: T,
  commit: (value: T) => void,
  options: { delayMs?: number; enabled?: boolean } = {}
): UseDebouncedCommit<T> {
  const { delayMs = DEFAULT_DELAY_MS, enabled = true } = options

  // Created once, lazily — `useRef(createDebouncer())` would build a throwaway
  // on every render.
  const ref = useRef<Debouncer | null>(null)
  if (ref.current === null) ref.current = createDebouncer()
  const debouncer = ref.current

  const committed = useRef(value)
  const commitRef = useRef(commit)
  commitRef.current = commit

  useEffect(() => {
    if (!enabled) return
    if (Object.is(value, committed.current)) return
    debouncer.call(() => {
      committed.current = value
      commitRef.current(value)
    }, delayMs)
    // Covers both a further change to `value` and unmount.
    return () => debouncer.cancel()
  }, [value, delayMs, enabled, debouncer])

  return useMemo(
    () => ({
      markCommitted: (next: T) => {
        committed.current = next
        debouncer.cancel()
      },
      flush: () => debouncer.flush(),
      cancel: () => debouncer.cancel(),
    }),
    [debouncer]
  )
}
