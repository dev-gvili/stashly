/**
 * Gives video and audio files that were uploaded without metadata the metadata
 * their upload should have saved.
 *
 * The upload-time step runs in the uploading tab (`app/machines/indexing/`).
 * When that tab is closed, reloaded or its queue stalls mid-batch, the files
 * left in the queue never get a facet, and nothing retried them (the 15 Nov
 * batch: 6 of 69 files saved). On a later visit the client asks for its own
 * files with no `Video` / `Audio` row, reads each header from storage and
 * saves it through the same `save_media_metadata` route.
 *
 * Quiet by design, like `useEmbeddingBackfill`: once per tab, one tab at a
 * time (Web Lock), started on an idle frame, not on a slow connection, one file
 * at a time, at most {@link METADATA_BACKFILL_MAX_BATCHES} batches a load. A
 * file that yields nothing is not asked for again in this tab.
 */
import { useEffect, useRef } from 'react'
import { useRevalidator } from 'react-router'
import {
  METADATA_BACKFILL_BATCH,
  METADATA_BACKFILL_MAX_BATCHES,
  readBackfillMetadata,
  saveBackfillMetadata,
} from '@/utils/metadata-backfill'
import { isConnectionTooSlow } from '@/utils/thumbnail-backfill'
import type { MetadataBackfillCandidate } from '@/types/api.types'

const IDLE_TIMEOUT_MS = 8_000
const TRIED_KEY = 'stashly:metadata-backfill-tried'

/** Once per tab, not once per mount. */
let started = false

function readTried(): Set<string> {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(TRIED_KEY) ?? '[]'))
  } catch {
    return new Set()
  }
}

function writeTried(tried: Set<string>): void {
  try {
    sessionStorage.setItem(TRIED_KEY, JSON.stringify([...tried]))
  } catch {
    // A private window: the set only lives for this run.
  }
}

async function fetchCandidates(
  after: string | null,
  signal: AbortSignal
): Promise<MetadataBackfillCandidate[]> {
  const params = new URLSearchParams({
    intent: 'metadata_backfill_candidates',
    limit: String(METADATA_BACKFILL_BATCH),
  })
  if (after) params.set('after', after)
  const res = await fetch(`/api/items?${params}`, { signal })
  if (!res.ok) return []
  const body = (await res.json().catch(() => null)) as {
    candidates?: MetadataBackfillCandidate[]
  } | null
  return body?.candidates ?? []
}

/** Reads and saves candidates batch by batch; returns how many facets were saved. */
async function drain(signal: AbortSignal): Promise<number> {
  const tried = readTried()
  let saved = 0
  let after: string | null = null

  for (let batch = 0; batch < METADATA_BACKFILL_MAX_BATCHES; batch++) {
    if (signal.aborted) break
    const candidates = await fetchCandidates(after, signal)
    if (candidates.length === 0) break
    after = candidates[candidates.length - 1].id

    for (const candidate of candidates) {
      if (signal.aborted) break
      if (tried.has(candidate.id)) continue
      tried.add(candidate.id)
      try {
        const meta = await readBackfillMetadata(candidate)
        if (await saveBackfillMetadata(candidate.id, meta, signal)) saved++
      } catch (e) {
        if (signal.aborted) break
        console.error('[metadata backfill] skipped', candidate.id, e)
      }
      writeTried(tried)
    }
    if (candidates.length < METADATA_BACKFILL_BATCH) break
  }
  return saved
}

/**
 * Starts the backfill once per tab, on an idle frame.
 *
 * @example
 * // in the app layout
 * useMetadataBackfill()
 */
export function useMetadataBackfill(): void {
  const { revalidate } = useRevalidator()
  // The effect must not restart when React Router hands back a new function.
  const revalidateRef = useRef(revalidate)
  revalidateRef.current = revalidate

  useEffect(() => {
    if (started) return
    const nav = navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string }
    }
    if (isConnectionTooSlow(nav.connection)) return

    const controller = new AbortController()
    const run = () => {
      started = true
      const work = () => drain(controller.signal)
      // One tab drains at a time; the others would read the same files.
      const locked =
        'locks' in navigator
          ? navigator.locks.request(
              'stashly-metadata-backfill',
              { ifAvailable: true },
              (lock) => (lock ? work() : Promise.resolve(0))
            )
          : work()
      locked
        .then((saved) => {
          // The page shows the new facets (duration, codec…) after one reload
          // of its data, not one per file.
          if (saved > 0 && !controller.signal.aborted)
            void revalidateRef.current()
        })
        .catch((e) => {
          if (!controller.signal.aborted)
            console.error('[metadata backfill]', e)
        })
        .finally(() => {
          started = false
        })
    }

    if (typeof requestIdleCallback === 'function') {
      const handle = requestIdleCallback(run, { timeout: IDLE_TIMEOUT_MS })
      return () => {
        cancelIdleCallback(handle)
        controller.abort()
      }
    }
    const handle = setTimeout(run, IDLE_TIMEOUT_MS)
    return () => {
      clearTimeout(handle)
      controller.abort()
    }
  }, [])
}
