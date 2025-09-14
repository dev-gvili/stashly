import type { Prisma } from '../prisma/client'
import { prisma } from '@/services/db'
import type { IRepository } from './IRepository'
import type { Permission, PermissionRole } from '@/prisma/client'
import { ApiError, ApiErrorCode } from '../api.errors'

/**
 * Repository for the `Permission` model.
 * Provides CRUD operations and a set of convenience helpers for
 * checking access on items, links, and invitations.
 */
class PermissionRepository implements IRepository<Permission, 'Permission'> {
	name = 'Permission' as const

	private db: typeof prisma

	constructor(dbClient: typeof prisma = prisma) {
		this.db = dbClient
	}

	// ------------------------------------------------------------------
	// Basic CRUD
	// ------------------------------------------------------------------
	async findById(id: string): Promise<Permission | null> {
		return this.db.permission.findUnique({ where: { id } })
	}

	async findAll(args: Prisma.PermissionFindManyArgs): Promise<Permission[]> {
		return this.db.permission.findMany(args)
	}

	async create(args: Prisma.PermissionCreateInput): Promise<Permission> {
		return this.db.permission.create({ data: args })
	}

	async update(args: Prisma.PermissionUpdateArgs): Promise<Permission> {
		return this.db.permission.update(args)
	}

	async delete(args: Prisma.PermissionDeleteArgs): Promise<Permission> {
		return this.db.permission.delete(args)
	}

	// ------------------------------------------------------------------
	// Convenience lookups
	// ------------------------------------------------------------------
	/** Find all permissions that involve a specific user */
	async findByUserId(userId: string): Promise<Permission[]> {
		return this.db.permission.findMany({
			where: { users: { some: { id: userId } } },
		})
	}

	/** Find all permissions for a specific item */
	async findByItemId(itemId: string) {
		return this.db.permission.findMany({ where: { itemId }, include: { users: true } })
	}

	/** Find all permissions for a specific link */
	async findByLinkId(linkId: string): Promise<Permission[]> {
		return this.db.permission.findMany({ where: { linkId } })
	}

	/** Find all permissions for a specific invitation */
	async findByInvitationId(invitationId: string): Promise<Permission[]> {
		return this.db.permission.findMany({ where: { invitationId } })
	}

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
		role: PermissionRole = 'read'
	): Promise<boolean> {
		const perm = await this.db.permission.findFirst({
			where: {
				itemId,
				users: { some: { id: userId } },
				roles: role,
			},
		})
		return !!perm
	}

	/**
	 * Check if a user has a specific role on a link.
	 */
	async hasLinkPermission(
		userId: string,
		linkId: string,
		role: PermissionRole = 'read'
	): Promise<boolean> {
		const perm = await this.db.permission.findFirst({
			where: {
				linkId,
				users: { some: { id: userId } },
				roles: role,
			},
		})
		return !!perm
	}

	/**
	 * Check if a user has a specific role on an invitation.
	 */
	async hasInvitationPermission(
		userId: string,
		invitationId: string,
		role: PermissionRole = 'read'
	): Promise<boolean> {
		const perm = await this.db.permission.findFirst({
			where: {
				invitationId,
				users: { some: { id: userId } },
				roles: role,
			},
		})
		return !!perm
	}

	async assertCanUpdateItem(userId: string, itemId: string): Promise<void> {
		const ok = await this.hasItemPermission(userId, itemId, 'write')
		if (!ok)
			throw new ApiError(
				ApiErrorCode.FORBIDDEN,
				'You cannot update this item'
			)
	}
    
	// ------------------------------------------------------------------
	// Soft delete / expiration helpers
	// ------------------------------------------------------------------
	async expirePermission(id: string, expiresAt: Date): Promise<Permission> {
		return this.db.permission.update({
			where: { id },
			data: { expiresAt },
		})
	}

	async softDelete(id: string, deletedAt: Date): Promise<Permission> {
		return this.db.permission.update({
			where: { id },
			data: { deletedAt },
		})
	}
}

export const permissionRepository = new PermissionRepository()
