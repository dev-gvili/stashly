import { prisma } from '@/services/db'
import { StashlyError, StashlyErrorCode, toRouteError } from '@/utils/api.errors'
import type { Prisma } from '@/prisma/client'

/**
 * Returns the settings/preferences fields for a user.
 * Selects only the subset of User fields that represent preferences.
 */
export async function getUserSettings(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      displayName: true,
      email: true,
      image: true,
      emailVerified: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  if (!user) {
    throw toRouteError(StashlyErrorCode.USER_NOT_FOUND, `User not found: ${userId}`)
  }

  return user
}

/**
 * Updates the settings/preferences fields for a user.
 * Only allows updating name, displayName, and image.
 */
export async function updateUserSettings({
  userId,
  name,
  displayName,
  image,
}: {
  userId: string
  name?: string
  displayName?: string
  image?: string
}) {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) {
    throw toRouteError(StashlyErrorCode.USER_NOT_FOUND, `User not found: ${userId}`)
  }

  const data: Prisma.UserUpdateInput = {}
  if (name !== undefined) data.name = name
  if (displayName !== undefined) data.displayName = displayName
  if (image !== undefined) data.image = image

  return prisma.user.update({
    where: { id: userId },
    data,
    select: {
      id: true,
      name: true,
      displayName: true,
      email: true,
      image: true,
      emailVerified: true,
      createdAt: true,
      updatedAt: true,
    },
  })
}
