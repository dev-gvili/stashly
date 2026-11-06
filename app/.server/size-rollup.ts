import { prisma } from '@/services/db'
import { log } from '@/services/log'
import { inc, recordSizeRollup } from './metrics'

// ---------------------------------------------------------------------------
// Applies the upload size log (migration 20261030140000_upload_size_delta_log).
//
// While the database is busy, an uploaded file doesn't rewrite every folder
// above it in its own INSERT: update_size() logs its size in "ItemSizeDelta",
// and apply_item_size_deltas() writes each affected folder once per run
// (20261030160000_upload_size_inline_when_idle; idle uploads cascade at once).
// A folder's child count and a drive's quota charge take the same way
// (20261106120000_upload_quota_log). This loop calls it every 250 ms while
// anything is pending, so under load those numbers trail uploads by about that.
//
// One loop per process, pinned to globalThis so dev HMR doesn't stack a second
// one. Every loop drains the whole log, and the function's advisory lock lets
// one run at a time across all processes; a loop that finds it held skips.
// Started when server/app.ts loads (at boot in production), so deltas a
// stopped process left pending are applied without waiting for an upload;
// createUploadedItem() also starts it, for scripts. Off under Vitest: tests
// flush explicitly.
// ---------------------------------------------------------------------------

export const SIZE_ROLLUP_INTERVAL_MS = 250
/** Deltas per run; a run that applies this many leaves a backlog. */
export const SIZE_ROLLUP_BATCH = 5000

export type SizeRollupOutcome =
  | { kind: 'idle' }
  | {
      kind: 'applied'
      deltas: number
      ancestors: number
      oldestMs: number
      ms: number
    }
  | { kind: 'skipped' }
  | { kind: 'timeout' }
  | { kind: 'error' }

/**
 * Milliseconds until the next run: at once while a backlog remains, longer
 * after an unexpected error, otherwise one interval. A lock timeout (the run
 * gave way to a user's trash, move or delete) is expected and just retries.
 */
export function nextSizeRollupDelay(
  outcome: SizeRollupOutcome,
  interval = SIZE_ROLLUP_INTERVAL_MS,
  batch = SIZE_ROLLUP_BATCH
) {
  if (outcome.kind === 'applied' && outcome.deltas >= batch) return 0
  if (outcome.kind === 'error') return interval * 20
  return interval
}

/** True for Postgres' lock_not_available (55P03), however the driver wraps it. */
function isLockTimeout(e: unknown) {
  const meta = (e as { meta?: unknown } | null)?.meta
  return /55P03|lock timeout/i.test(
    `${String(e)} ${meta ? JSON.stringify(meta) : ''}`
  )
}

async function runSizeRollup(): Promise<SizeRollupOutcome> {
  const [{ pending }] = await prisma.$queryRaw<
    { pending: boolean }[]
  >`SELECT EXISTS (SELECT 1 FROM "ItemSizeDelta") OR EXISTS (SELECT 1 FROM "QuotaDelta") AS pending`
  if (!pending) return { kind: 'idle' }
  const t = performance.now()
  try {
    const [r] = await prisma.$queryRaw<
      { deltas: number; ancestors: number; oldest_ms: number }[]
    >`
      SELECT * FROM apply_item_size_deltas(${SIZE_ROLLUP_BATCH}::integer)`
    // (0, 0) means another run held the lock, or claimed the rows first
    if (r.deltas === 0 && r.ancestors === 0) return { kind: 'skipped' }
    return {
      kind: 'applied',
      deltas: r.deltas,
      ancestors: r.ancestors,
      oldestMs: r.oldest_ms,
      ms: performance.now() - t,
    }
  } catch (e) {
    if (isLockTimeout(e)) return { kind: 'timeout' }
    throw e
  }
}

const globalForSizeRollup = globalThis as typeof globalThis & {
  __sizeRollupStarted?: boolean
}

/** Starts this process's rollup loop once; later calls do nothing. */
export function ensureSizeRollup() {
  if (process.env.VITEST || globalForSizeRollup.__sizeRollupStarted) return
  globalForSizeRollup.__sizeRollupStarted = true

  const tick = async () => {
    let outcome: SizeRollupOutcome
    try {
      outcome = await runSizeRollup()
    } catch (e) {
      log.error('size rollup run failed', { error: e })
      outcome = { kind: 'error' }
    }
    if (outcome.kind === 'applied') recordSizeRollup(outcome)
    else if (outcome.kind === 'skipped') inc('size_rollup_skipped_total')
    else if (outcome.kind === 'timeout') inc('size_rollup_lock_timeouts_total')
    else if (outcome.kind === 'error') inc('size_rollup_errors_total')
    // unref: the loop alone never keeps a process (a script, a test) alive
    setTimeout(tick, nextSizeRollupDelay(outcome)).unref()
  }
  setTimeout(tick, 0).unref()
}
