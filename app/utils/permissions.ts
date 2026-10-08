import type { Prisma } from '@/prisma/client'

/**
 * The `Permission` conditions for a grant that still counts: not soft-deleted
 * and not expired. Every access decision ANDs this in.
 *
 * A permission row outlives its grant. Canceling an invitation stamps
 * `deletedAt`, and a share with an end date keeps its row after `expiresAt`.
 * Until 2026-10-08 the access checks matched on user and role alone, so an
 * expired or revoked grant still opened the item (tech-debt item 26).
 *
 * A function, not a constant, so `now` is read when the query is built.
 *
 * @param now - The moment to judge expiry against (default: now).
 * @returns A `PermissionWhereInput` fragment to spread into a permission filter
 *   that has no `OR` of its own.
 *
 * @example
 * await prisma.permission.findFirst({
 *   where: { itemId, users: { some: { id: userId } }, ...livePermission() },
 * })
 */
export function livePermission(now: Date = new Date()): Prisma.PermissionWhereInput {
  return {
    deletedAt: null,
    OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
  }
}
