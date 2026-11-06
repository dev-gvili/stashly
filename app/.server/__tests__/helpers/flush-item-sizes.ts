import { prisma } from '@/services/db'

const FLUSH_DEADLINE_MS = 20_000

/**
 * Applies every pending upload delta (size, child count, quota charge), trying
 * until none is left. Under Vitest no rollup loop runs, so a test that reads one
 * of those numbers after an upload calls this first.
 *
 * The rollup's own non-waiting call, retried, rather than
 * `apply_item_size_deltas(NULL, true)`: that one waits on a row lock while
 * holding the rollup's lock, so a test file holding a row on purpose stalled
 * every rollup in the other test files on this database.
 */
export async function flushItemSizes(): Promise<void> {
  const deadline = Date.now() + FLUSH_DEADLINE_MS
  for (;;) {
    const [{ pending }] = await prisma.$queryRaw<{ pending: boolean }[]>`
      SELECT EXISTS (SELECT 1 FROM "ItemSizeDelta") OR EXISTS (SELECT 1 FROM "QuotaDelta") AS pending`
    if (!pending) return
    if (Date.now() > deadline) throw new Error('flushItemSizes: deltas still pending after 20 s')
    await prisma.$queryRaw`SELECT * FROM apply_item_size_deltas(NULL)`.catch((e: unknown) => {
      if (!/55P03|lock timeout/i.test(`${String(e)} ${JSON.stringify((e as { meta?: unknown }).meta ?? '')}`)) throw e
    })
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}

/**
 * Runs `fn` while holding the rollup's lock, so no other rollup (another test
 * worker, or the dev server's loop on the same database) applies a delta in
 * between: a delta logged inside `fn` is still pending when it returns.
 */
export async function withSizeRollupPaused<T>(fn: () => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('stashly.item_size_rollup'))`
    return fn()
  })
}
