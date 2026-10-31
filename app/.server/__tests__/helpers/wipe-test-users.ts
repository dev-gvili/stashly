import { prisma } from '@/services/db'

/**
 * Deletes a test user's items, drive and account, with the rollup triggers
 * disarmed.
 *
 * `Item` carries six `FOR EACH ROW` rollup triggers (`item_size_decrement`,
 * `item_child_count_delete`, `item_delete_collection_sync_trigger`, …) that
 * `UPDATE` an ancestor or collection row on every delete. A bulk
 * `deleteMany` therefore makes two of those updates land on the same row
 * inside one statement, and Postgres aborts the whole statement with
 * `tuple to be updated was already modified by an operation triggered by the
 * current command`.
 *
 * That failure is what left 88 workspaces, 176 users and 6071 items behind in
 * the dev database: a plain `deleteMany` in `afterAll` threw, so every
 * statement after it — including the workspace delete — never ran.
 *
 * The migration `20260526000000_user_wipe_trigger_bypass` added the way out.
 * Each trigger is guarded by `NOT stashly_is_wiping_user("ownerId")`, which
 * reads two transaction-local settings; arming both makes the rollups skip
 * this user's rows so the delete is a plain cascade. Both `set_config` calls
 * pass `is_local = true`, so the flag dies with the transaction and can never
 * leak into another test or a real request.
 *
 * Ordering note: `WorkspaceMember.workspaceId` is `ON DELETE RESTRICT`, so
 * callers must clear memberships (and the workspace itself) around this call.
 *
 * @param userIds The test users to wipe. Safe to call with an empty list.
 *
 * @example
 * afterAll(async () => {
 *   await wipeTestUsers([ownerId, otherId])
 * })
 */
export async function wipeTestUsers(userIds: string[]): Promise<void> {
  if (userIds.length === 0) return

  // Drop this user's pending upload size deltas first, under the rollup's lock.
  // Parallel test files call `flushItemSizes()`, which applies every pending
  // delta in the database: applying this user's would update their folders while
  // the delete below removes them, and the two took row locks in opposite orders
  // ("deadlock detected", 3 of 8 full runs on 31 Oct). With the deltas gone no
  // rollup touches these rows. The lock is held only for this small delete:
  // held for the whole wipe, it made `withSizeRollupPaused` wait out 5 s timeouts.
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('stashly.item_size_rollup'))`
    await tx.$executeRaw`
      DELETE FROM "ItemSizeDelta" d USING "Item" i
      WHERE i."id" = d."parentId" AND i."ownerId" = ANY(${userIds})`
  })

  await prisma.$transaction(
    async (tx) => {
      for (const userId of userIds) {
        await tx.$executeRaw`SELECT set_config('stashly.delete_all_data_for_user', ${userId}, true)`
        await tx.$executeRaw`SELECT set_config('stashly.delete_all_data_for_user_consent', 'yes', true)`
        await tx.item.deleteMany({ where: { ownerId: userId } })
      }

      await tx.drive.deleteMany({ where: { ownerId: { in: userIds } } })
      await tx.user.deleteMany({ where: { id: { in: userIds } } })
    },
    { timeout: 60_000 }
  )
}
