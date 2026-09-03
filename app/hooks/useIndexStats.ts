import { useEffect, useRef, useState } from 'react'

/**
 * Index coverage, re-read from the server at run boundaries and projected
 * locally in between.
 *
 * The page loader's snapshot goes stale the moment the client-side backfill
 * embeds anything, which is exactly when the "not indexed" notice should stop
 * showing. The obvious implementation — re-read whenever the runner reports —
 * costs one HTTP request per progress report, which measured out at a request
 * every 2–6 seconds for the whole run.
 *
 * It is also unnecessary. The runner already knows how many chunks it has
 * embedded, and `BackfillState.embedded` counts only writes the server
 * confirmed. So the server is asked at boundaries — enable, each completed
 * batch, and whenever the runner starts or stops — and the numbers in between
 * are the last answer plus the runner's own delta. That makes the coverage bar
 * *smoother* than polling did, not coarser: it moves on every confirmed save
 * rather than whenever a request happens to land.
 *
 * @param enabled - Read only while true; when false the loader snapshot is kept
 *   as-is and no request is made.
 * @param initial - The loader's snapshot, used until the first read lands.
 * @param revalidateKey - Change to re-read. Pass something that changes at run
 *   *boundaries* (batch count, active/idle), not on every report.
 * @param embeddedLocally - Chunks the runner has confirmed this session, used
 *   to project coverage forward between reads.
 *
 * @example
 * // Read per batch and at start/stop; project from the runner in between
 * const { phase, batches, embedded, updatedAt } = useEmbeddingBackfillState()
 * const active = isBackfillActive(phase)
 * const stats = useIndexStats(active, loaderStats, `${batches}:${active}`, embedded)
 *
 * @example
 * // Disabled: the hook just echoes the loader snapshot back
 * const stats = useIndexStats(false, loaderStats)
 */
export function useIndexStats(
  enabled: boolean,
  initial: { indexedChunks: number; pendingChunks: number },
  /** Change to re-read — see the note about run boundaries above. */
  revalidateKey?: number | string,
  embeddedLocally = 0,
) {
  const [base, setBase] = useState(initial)
  const readRef = useRef<(() => Promise<unknown>) | null>(null)

  // How much of `embeddedLocally` the server's answer already accounts for.
  // Without this the delta would be added on top of a total that already
  // includes it, and coverage would run ahead of reality after every read.
  const baselineRef = useRef(0)
  const embeddedRef = useRef(embeddedLocally)
  embeddedRef.current = embeddedLocally

  // One abort controller for as long as the hook stays enabled, so a
  // revalidation can never cancel a request that is already in flight. Only
  // disabling or unmounting aborts.
  useEffect(() => {
    if (!enabled) {
      readRef.current = null
      return
    }
    const controller = new AbortController()
    readRef.current = () =>
      fetch('/api/search/items?intent=index_stats', {
        signal: controller.signal,
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((body) => {
          if (!body) return
          // Rebase before publishing: everything embedded up to now is part of
          // this answer.
          baselineRef.current = embeddedRef.current
          setBase(body)
        })
        .catch(() => null)

    return () => {
      readRef.current = null
      controller.abort()
    }
  }, [enabled])

  // Reading through the ref is what keeps a revalidation from tearing down the
  // request above and restarting it.
  useEffect(() => {
    if (!enabled) return
    void readRef.current?.()
  }, [enabled, revalidateKey])

  const delta = Math.max(0, embeddedLocally - baselineRef.current)
  return {
    indexedChunks: base.indexedChunks + delta,
    pendingChunks: Math.max(0, base.pendingChunks - delta),
  }
}
