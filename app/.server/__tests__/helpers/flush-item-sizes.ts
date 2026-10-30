import { prisma } from '@/services/db'

/**
 * Applies every pending upload size delta (migration
 * `20261030140000_upload_size_delta_log`), waiting for a rollup already
 * running. Under Vitest no rollup loop runs, so a test that reads a folder's
 * size after an upload calls this first.
 */
export async function flushItemSizes(): Promise<void> {
  await prisma.$queryRaw`SELECT * FROM apply_item_size_deltas(NULL, true)`
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
