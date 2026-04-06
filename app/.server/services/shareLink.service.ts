import {
  createPermission,
  getLinkPermissions,
  hasLinkPermission,
  updatePermission,
} from '@/services/permission-actions'
import { shareLinkRepository } from '@/services/repositories/shareLink.repository'
import type { Prisma, ShareLink } from '@/prisma/client'
import { prisma } from '@/services/db'
import { getPrefixForModel, toObjectId } from '@/utils/converters'

export const shareLinkService = {
  /**
   * Creates a share link for a specific item.
   * This is a transactional operation that creates both the ShareLink
   * and the associated Permission record.
   * @param itemId The ID of the item to share.
   * @param linkData The data for the ShareLink.
   * @param permissionData The data for the associated Permission.
   * @returns The newly created ShareLink.
   */
  async createForItem(
    itemId: string,
    linkData: Omit<Prisma.ShareLinkCreateInput, 'permission'>,
    permissionData: Omit<Prisma.PermissionCreateInput, 'item' | 'link'>
  ): Promise<ShareLink> {
    return prisma.$transaction(async (tx) => {
      const newLink = await shareLinkRepository.create(linkData, tx)
      
      await createPermission(
        {
          ...permissionData,
          id: toObjectId(getPrefixForModel('Permission')),
          item: { connect: { id: itemId } },
          link: { connect: { id: newLink.id } },
        },
        tx
      )

      return newLink
    })
  },

  /**
   * Grants a user access to a share link by adding them to its permission.
   * @param linkId The ID of the share link.
   * @param userId The ID of the user to add.
   * @returns The updated Permission record.
   */
  async addUserToPermission(linkId: string, userId: string) {
    const permission = await getLinkPermissions(linkId)
    if (!permission.length) {
      throw new Error('Permission for the given share link not found.')
    }
    return updatePermission({
      where: { id: permission[0].id },
      data: {
        users: {
          connect: { id: userId },
        },
      },
    })
  },

  /**
   * Revokes a user's access to a share link.
   * @param linkId The ID of the share link.
   * @param userId The ID of the user to remove.
   * @returns The updated Permission record.
   */
  async removeUserFromPermission(linkId: string, userId: string) {
    // check if the current user have permissions to perform this action
    await hasLinkPermission(userId, linkId, 'write')

    const permission = await getLinkPermissions(linkId)
    if (!permission.length) {
      throw new Error('Permission for the given share link not found.')
    }
    return updatePermission({
      where: { id: permission[0].id },
      data: {
        users: {
          disconnect: { id: userId },
        },
      },
    })
  },
}
