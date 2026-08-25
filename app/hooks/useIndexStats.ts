import { useEffect, useState } from 'react'

/**
 * Index coverage, re-read from the server while `enabled`.
 *
 * The page loader's snapshot goes stale the moment the client-side backfill
 * embeds anything, which is exactly when the "not indexed" notice should stop
 * showing. Polling only while the notice is on screen keeps this to zero extra
 * requests in the normal case.
 *
 * @param enabled - Poll only while true; when false the loader snapshot is kept
 *   as-is and no request is made.
 * @param initial - The loader's snapshot, used until the first poll lands.
 * @param revalidateKey - Bump to re-read immediately — pass the backfill runner's
 *   `updatedAt` so every phase change forces a fresh read.
 *
 * @example
 * // Poll only while the "not indexed" notice is visible
 * const { phase, updatedAt } = useEmbeddingBackfillState()
 * const stats = useIndexStats(showNotice, loaderStats, updatedAt)
 * <p>{stats.pendingChunks} passages left to index</p>
 *
 * @example
 * // Disabled: the hook just echoes the loader snapshot back
 * const stats = useIndexStats(false, loaderStats)
 */
export function useIndexStats(
  enabled: boolean,
  initial: { indexedChunks: number; pendingChunks: number },
  /** Bump to re-read immediately — passed the runner's `updatedAt`. */
  revalidateKey?: number,
) {
  const [stats, setStats] = useState(initial)

  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()

    const read = () =>
      fetch('/api/search/items?intent=index_stats', {
        signal: controller.signal,
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((body) => body && setStats(body))
        .catch(() => null)

    void read()
    // Belt and braces: `revalidateKey` catches every phase change, and the
    // interval covers a batch that finishes between them.
    const timer = setInterval(read, 5_000)
    return () => {
      clearInterval(timer)
      controller.abort()
    }
  }, [enabled, revalidateKey])

  return stats
}
