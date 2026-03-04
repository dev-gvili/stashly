import { prisma } from '@/services/db'
import type { Permission, PermissionRole, Prisma } from '@/prisma/client'
import { StashlyError, StashlyErrorCode } from '../api.errors'

type PrismaTx = Omit<
  typeof prisma,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>
/**
 * Repository for the `Permission` model.
 * Provides CRUD operations and a set of convenience helpers for
 * checking access on items, links, and invitations.
 */
export const permissionRepository = {
  db: prisma,

  // ------------------------------------------------------------------
  // Basic CRUD
  // ------------------------------------------------------------------
  async findById(id: string): Promise<Permission | null> {
    return this.db.permission.findUnique({ where: { id } })
  },

  async findAll(args: Prisma.PermissionFindManyArgs): Promise<Permission[]> {
    return this.db.permission.findMany(args)
  },

  async create(
    args: Prisma.PermissionCreateInput,
    tx?: PrismaTx
  ): Promise<Permission> {
    const db = tx || this.db
    return db.permission.create({ data: args })
  },

  async update(
    args: Prisma.PermissionUpdateArgs,
    tx?: PrismaTx
  ): Promise<Permission> {
    const db = tx || this.db
    return db.permission.update(args)
  },

  async delete(
    args: Prisma.PermissionDeleteArgs,
    tx?: PrismaTx
  ): Promise<Permission> {
    const db = tx || this.db
    return db.permission.delete(args)
  },

  // ------------------------------------------------------------------
  // Convenience lookups
  // ------------------------------------------------------------------

  /** Find all permissions that involve a specific user */
  async findByUserId(userId: string): Promise<Permission[]> {
    return this.db.permission.findMany({
      where: { users: { some: { id: userId } } },
    })
  },

  /** Find all permissions for a specific item */
  async findByItemId(itemId: string) {
    return this.db.permission.findMany({
      where: { itemId },
      include: { users: true },
    })
  },

  /** Find all permissions for a specific link */
  async findByLinkId(linkId: string): Promise<Permission[]> {
    return this.db.permission.findMany({ where: { linkId } })
  },

  /** Find all permissions for a specific invitation */
  async findByInvitationId(invitationId: string): Promise<Permission[]> {
    return this.db.permission.findMany({ where: { invitationId } })
  },

  // ------------------------------------------------------------------
  // Permission checks
  // ------------------------------------------------------------------
  /**
   * Check if a user has a specific role on an item.
   * @param userId - The user to check.
   * @param itemId - The item in question.
   * @param role - The required role (default: read).
   */
  async hasItemPermission(
    userId: string,
    itemId: string,
    role: PermissionRole = 'read',
    tx?: PrismaTx
  ): Promise<boolean> {
    const db = tx || this.db
    const perm = await db.permission.findFirst({
      where: {
        itemId,
        users: { some: { id: userId } },
        roles: role,
      },
    })
    return !!perm
  },

  /**
   * Check if a user has a specific role on a share link, including its associated item.
   * @param userId - The user to check.
   * @param linkId - The share link in question.
   * @param role - The required role (default: read).
   * @param tx - Optional Prisma transaction client.
   *
   * @example
   * // Check if user has read access to a share link
   * const canAccess = await permissionRepository.hasLinkPermission(userId, linkId, 'read');
   * @return True if the user has the required permission, false otherwise.
   * @throws ApiError if the permission check fails.
   */
  async hasLinkPermission(
    userId: string,
    linkId: string,
    role: PermissionRole = 'read',
    tx?: PrismaTx
  ): Promise<boolean> {
    const db = tx || this.db
    const perm = await db.permission.findFirst({
      where: {
        linkId,
        users: { some: { id: userId } },
        roles: role,
      },
    })
    return !!perm
  },

  /**
   * Check if a user has a specific role on an invitation.
   * @param userId - The user to check.
   * @param invitationId - The invitation in question.
   * @param role - The required role (default: read).
   *
   * @example
   * // Check if user has read access to an invitation
   * const canAccess = await permissionRepository.hasInvitationPermission(userId, invitationId, 'read');
   * @return True if the user has the required permission, false otherwise.
   * @throws ApiError if the permission check fails.
   */
  async hasInvitationPermission(
    userId: string,
    invitationId: string,
    role: PermissionRole = 'read',
    tx?: PrismaTx
  ): Promise<boolean> {
    const db = tx || this.db
    const perm = await db.permission.findFirst({
      where: {
        invitationId,
        users: { some: { id: userId } },
        roles: role,
      },
    })
    return !!perm
  },

  /**
   * Assert that a user has permission to update an item.
   * @param userId - The user to check.
   * @param itemId - The item in question.
   * @throws ApiError if the user does not have permission.
   *
   * @example
   * // Assert that user has permission to update an item
   * await permissionRepository.assertCanUpdateItem(userId, itemId);
   */
  async assertCanUpdateItem(userId: string, itemId: string): Promise<void> {
    const ok = await this.hasItemPermission(userId, itemId, 'write')
    if (!ok)
      throw new StashlyError(StashlyErrorCode.FORBIDDEN, 'You cannot update this item')
  },

  // ------------------------------------------------------------------
  // Soft delete / expiration helpers
  // ------------------------------------------------------------------
  async expirePermission(
    id: string,
    expiresAt: Date,
    tx?: PrismaTx
  ): Promise<Permission> {
    const db = tx || this.db
    return db.permission.update({
      where: { id },
      data: { expiresAt },
    })
  },

  async softDelete(
    id: string,
    deletedAt: Date,
    tx?: PrismaTx
  ): Promise<Permission> {
    const db = tx || this.db
    return db.permission.update({
      where: { id },
      data: { deletedAt },
    })
  },
}

export type PermissionRepo = typeof permissionRepository
