import { useEffect, useState } from 'react'

/**
 * Index coverage, re-read from the server while `enabled`.
 *
 * The page loader's snapshot goes stale the moment the client-side backfill
 * embeds anything, which is exactly when the "not indexed" notice should stop
 * showing. Polling only while the notice is on screen keeps this to zero extra
 * requests in the normal case.
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
