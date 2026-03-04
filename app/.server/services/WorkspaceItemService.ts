import { Prisma } from '@/prisma/client'
import { StashlyError, StashlyErrorCode } from '@/.server/api.errors'
import { workspaceMemberRepository } from '@/services/repositories/workspaceMember.repository'
import type { PermissionRole } from '@/prisma/enums'
import { getPrefixForModel, toObjectId } from '@/utils/converters'

export const WorkspaceItemService = {
  // ...existing methods...

  async syncItemPermissionsWithWorkspaceRole(
    userId: string,
    workspaceId: string,
    client: Prisma.TransactionClient
  ): Promise<void> {
    const member = await workspaceMemberRepository.findByUserAndWorkspace(
      userId,
      workspaceId
    )
    if (!member) {
      throw new StashlyError(
        StashlyErrorCode.NOT_FOUND,
        'User is not a member of this workspace'
      )
    }

    let desiredItemRole: PermissionRole | null = null
    switch (member.role) {
      case 'owner':
      case 'admin':
        desiredItemRole = 'write'
        break
      case 'member':
        desiredItemRole = 'read'
        break
      case 'viewer':
        desiredItemRole = 'read'
        break
      default:
        desiredItemRole = null // No item-level permissions for viewers
        break
    }

    const allItems = await client.item.findMany({
      where: { workspaceId },
      select: { id: true },
    })
    const allItemIds = allItems.map((item) => item.id)

    const existingPermissions = await client.permission.findMany({
      where: {
        itemId: { in: allItemIds },
        users: { some: { id: userId } },
      },
      select: { id: true, itemId: true, roles: true },
    })

    const permissionsMap = new Map(
      existingPermissions.map((p) => [p.itemId, p])
    )
    const toCreate: Prisma.PermissionCreateManyInput[] = []
    const toUpdate: { id: string; role: PermissionRole }[] = []
    const toDelete: string[] = []

    for (const itemId of allItemIds) {
      const existing = permissionsMap.get(itemId)
      if (desiredItemRole) {
        if (!existing) {
          toCreate.push({
            id: toObjectId(getPrefixForModel('Permission')),
            itemId,
            roles: desiredItemRole,
          })
        } else if (existing.roles !== desiredItemRole) {
          toUpdate.push({ id: existing.id, role: desiredItemRole })
        }
      } else if (existing) {
        toDelete.push(existing.id)
      }
    }

    if (toCreate.length > 0) {
      // This is a simplified representation. `createMany` with relations needs adjustment.
      // For now, we'll create one-by-one, but ideally this would be a single call if the schema supports it.
      // The main optimization is fetching all data at once.
      let permissions = await client.permission.createManyAndReturn({
        data: toCreate,
        skipDuplicates: true,
        select: { id: true },
      })

      if (!permissions) {
        throw new StashlyError(
          StashlyErrorCode.INTERNAL_SERVER_ERROR,
          'Failed to create permissions'
        )
      }

      await client.user.update({
        where: { id: userId },
        data: {
          permissions: {
            connect: permissions,
          },
        },
      })
    }

    if (toUpdate.length > 0) {
      for (const { id, role } of toUpdate) {
        await client.permission.update({
          where: { id },
          data: { roles: role },
        })
      }
    }

    if (toDelete.length > 0) {
      await client.permission.deleteMany({
        where: { id: { in: toDelete } },
      })
    }
  },

  async removeAllItemPermissionsForUser(
    userId: string,
    workspaceId: string,
    client: Prisma.TransactionClient
  ): Promise<void> {
    // Find all items in the workspace to scope the deletion
    const itemsInWorkspace = await client.item.findMany({
      where: { workspaceId },
      select: { id: true },
    })
    const itemIds = itemsInWorkspace.map((item) => item.id)

    if (itemIds.length === 0) {
      return // No items in the workspace, nothing to do
    }

    // Delete all permissions for the user on items within that workspace
    await client.permission.deleteMany({
      where: {
        itemId: { in: itemIds },
        users: { some: { id: userId } },
      },
    })
  },
}
