import { prisma } from '@/services/db'
import { track } from '@/services/vinktar'
import { StashlyError, StashlyErrorCode, toRouteError } from '@/utils/api.errors'
import { getPrefixForModel, toObjectId } from '@/utils/converters'
import type { Prisma } from '@/prisma/client'
import { buildUserFilters } from '@/utils/filters/user.filters'
import { searchFactory } from '@/utils/search'

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/**
 * Paginated, filterable search over User records.
 *
 * @example
 * const page = await searchUsers({ query: 'alice', take: 20, strategy: 'cursor' })
 */
export const searchUsers = searchFactory({
  dbDelegate: prisma.user,
  buildFilters: buildUserFilters,
  defaultOrderBy: (): Prisma.UserOrderByWithRelationInput => ({ createdAt: 'desc' }),
})

/**
 * Finds a user by their unique ID.
 * Throws USER_NOT_FOUND if no matching user exists.
 */
export async function findUserById(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) {
    throw toRouteError(StashlyErrorCode.USER_NOT_FOUND, `User not found: ${userId}`)
  }
  return user
}

/**
 * Finds a user by their email address.
 * Throws USER_NOT_FOUND if no matching user exists.
 */
export async function findUserByEmail(email: string) {
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    throw toRouteError(StashlyErrorCode.USER_NOT_FOUND, `User not found: ${email}`)
  }
  return user
}

/**
 * Updates a user's profile fields.
 * Only allows updating name and displayName.
 */
export async function updateUser({
  userId,
  data,
}: {
  userId: string
  data: Prisma.UserUpdateInput
}) {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) {
    throw toRouteError(StashlyErrorCode.USER_NOT_FOUND, `User not found: ${userId}`)
  }
  return prisma.user.update({
    where: { id: userId },
    data,
  })
}

/**
 * Searches users by name or email using a query string.
 * Supports cursor-based pagination.
 */
export async function searchUsersByQuery({
  query,
  cursor,
  limit = 20,
}: {
  query: string
  cursor?: string | null
  limit?: number
}) {
  const where: Prisma.UserWhereInput = {
    OR: [
      { name: { contains: query, mode: 'insensitive' } },
      { displayName: { contains: query, mode: 'insensitive' } },
      { email: { contains: query, mode: 'insensitive' } },
    ],
  }

  const users = await prisma.user.findMany({
    where,
    take: limit + 1,
    cursor: cursor ? { id: cursor } : undefined,
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      displayName: true,
      email: true,
      image: true,
      createdAt: true,
    },
  })

  const hasMore = users.length > limit
  const data = users.slice(0, limit)
  const nextCursor = hasMore ? (data[data.length - 1]?.id ?? null) : null

  return { users: data, nextCursor, hasMore }
}

/**
 * Permanently deletes a user record.
 * This is a destructive operation and cannot be undone.
 */
export async function deleteUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) {
    throw toRouteError(StashlyErrorCode.USER_NOT_FOUND, `User not found: ${userId}`)
  }
  const deleted = await prisma.user.delete({ where: { id: userId } })
  track(
    'account_deleted',
    {
      account_days: Math.round(
        (Date.now() - user.createdAt.getTime()) / 86_400_000
      ),
      email_verified: user.emailVerified,
    },
    { userId }
  )
  return deleted
}
