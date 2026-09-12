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
