import { prisma } from '@/services/db'
import { workspaceMemberRepository } from '../repositories/workspaceMember.repository'
import { workspaceItemService } from './workspaceItem.service'
import type { WorkspaceMember, WorkspaceMemberRole } from '@/prisma/client'

export const workspaceMemberService = {
  /**
   * Changes a user's role within a workspace and synchronizes their item-level
   * permissions to reflect the new role. This is a transactional operation.
   * @param userId The ID of the user whose role is changing.
   * @param workspaceId The ID of the workspace.
   * @param newRole The new role to assign to the user.
   * @returns The updated workspace member object.
   */
  async changeRole(
    userId: string,
    workspaceId: string,
    newRole: WorkspaceMemberRole
  ): Promise<WorkspaceMember> {
    return prisma.$transaction(async (tc) => {
      // 1. Update the role in the workspace membership using the repository
      const updatedMember = await workspaceMemberRepository.update(
        {
          where: {
            memberId_workspaceId: { memberId: userId, workspaceId },
          },
          data: { role: newRole },
        },
        tc // Pass the transaction client to the repository method
      )

      // 2. Sync item-level permissions using the workspace item service
      await workspaceItemService.syncItemPermissionsWithWorkspaceRole(
        userId,
        workspaceId,
        tc // Pass the transaction client to the other service
      )

      return updatedMember
    })
  },

  /**
   * Removes a member from a workspace and cleans up all their associated
   * item-level permissions within that workspace. This is a transactional operation.
   * @param userId The ID of the user to remove.
   * @param workspaceId The ID of the workspace from which to remove the user.
   * @returns The data of the member that was removed.
   */
  async removeMember(
    userId: string,
    workspaceId: string
  ): Promise<WorkspaceMember> {
    return prisma.$transaction(async (tc) => {
      // 1. Remove the member from the workspace using the repository
      const removedMember = await workspaceMemberRepository.delete(
        {
          where: {
            memberId_workspaceId: { memberId: userId, workspaceId },
          },
        },
        tc // Pass the transaction client
      )

      // 2. Clean up all their item-level permissions in this workspace
      await workspaceItemService.removeAllItemPermissionsForUser(
        userId,
        workspaceId,
        tc // Pass the transaction client
      )

      return removedMember
    })
  },
}
