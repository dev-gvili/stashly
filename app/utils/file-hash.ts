/**
 * Main-thread client for the content-hash worker.
 *
 * The contract that matters: **hashing never gates the upload.** `startFileHash`
 * is fire-and-forget, and `takeFileHash` waits only a short grace period before
 * giving up. A file whose hash is not ready in time is stored with
 * `File.hash = null`, which costs its duplicate group the `exact` verdict and
 * nothing else — the upload itself is untouched.
 *
 * This is the whole reason the work moved off `toMediaFile`: hashing there ran
 * before the machine ever saw the file, so a batch sat in `pending` for as long
 * as it took to read every byte of every file, and then released as one burst.
 */
import type { HashRequest, HashResponse } from '@/workers/hash.worker'

// ── Worker singleton ──────────────────────────────────────────────────────

let hashWorker: Worker | null = null
let nextRequestId = 1
const pending = new Map<number, (hash: string | null) => void>()

function getHashWorker(): Worker | null {
  if (typeof window === 'undefined') return null
  if (hashWorker) return hashWorker
  try {
    hashWorker = new Worker(
      new URL('../workers/hash.worker.ts', import.meta.url),
      { type: 'module' }
    )
  } catch (err) {
    console.error('[hash worker] failed to construct', err)
    return null
  }
  hashWorker.onmessage = (e: MessageEvent<HashResponse>) => {
    const resolve = pending.get(e.data.id)
    if (resolve) {
      pending.delete(e.data.id)
      resolve(e.data.hash)
    }
  }
  hashWorker.onerror = (e) => {
    console.error('[hash worker] error event', e.message, e.filename, e.lineno)
  }
  return hashWorker
}

// ── Per-upload registry ───────────────────────────────────────────────────

/**
 * In-flight hashes, keyed by `MediaFile.id`.
 *
 * Keyed rather than carried on the MediaFile itself so the machines' context
 * stays serialisable and unchanged — the hash is a side channel, not upload
 * state.
 */
const jobs = new Map<string, Promise<string | null>>()

/** An abandoned upload should not pin its entry forever. */
const ABANDONED_TTL_MS = 5 * 60_000

/**
 * Begin hashing a file. Safe to call more than once for the same key; the
 * first call wins. Never throws, never returns a rejected promise.
 */
export function startFileHash(key: string, file: File): void {
  if (jobs.has(key)) return

  const worker = getHashWorker()
  if (!worker) {
    jobs.set(key, Promise.resolve(null))
    return
  }

  const id = nextRequestId++
  const job = new Promise<string | null>((resolve) => {
    pending.set(id, resolve)
    worker.postMessage({ id, file } satisfies HashRequest)
  })
  jobs.set(key, job)

  // Reclaim the slot if nobody ever collects it (cancelled or failed upload).
  job.then(() => {
    setTimeout(() => jobs.delete(key), ABANDONED_TTL_MS)
  })
}

/**
 * How long item creation is willing to wait for a hash that is still running.
 *
 * Deliberately short. Hashing starts when the file is queued, so by the time
 * the S3 upload has finished it is normally long done; this budget only covers
 * the case where the worker is still chewing through a backlog. Raising it
 * would re-introduce exactly the stall this module exists to remove.
 */
const GRACE_MS = 1_500

/**
 * Collect a file's hash, waiting at most `GRACE_MS`.
 *
 * Returns `undefined` when there is no hash yet — the caller should send no
 * hash rather than block.
 */
export async function takeFileHash(key: string): Promise<string | undefined> {
  const job = jobs.get(key)
  if (!job) return undefined

  const timeout = new Promise<null>((resolve) => setTimeout(resolve, GRACE_MS))
  const hash = await Promise.race([job, timeout])
  if (hash === null || hash === undefined) return undefined

  jobs.delete(key)
  return hash
}

/** Drop a pending job for an upload that was cancelled. */
export function dropFileHash(key: string): void {
  jobs.delete(key)
}
