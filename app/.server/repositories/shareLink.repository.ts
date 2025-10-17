import { prisma } from '@/services/db'
import type { Prisma, ShareLink } from '@/prisma/client'
import {
	buildShareLinkFilters,
	shareLinkFilterSchema,
} from '@/services/filters/shareLink.filters'
import { z } from 'zod'
import { searchFactory } from '@/utils/search'

/**
 * A Prisma transaction client, compatible with the full client.
 */
type PrismaTx = Omit<
	typeof prisma,
	'$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>

const defaultOrderBy = (
	params: z.infer<typeof shareLinkFilterSchema>
): Prisma.ShareLinkOrderByWithRelationInput => ({
	// TODO: Define a default order-by for the model
	createdAt: 'desc',
})

/** Repository for the `ShareLink` model.
 * Provides CRUD operations plus a handful of convenience helpers.
 */
export const shareLinkRepository = {
	search: searchFactory({
		dbDelegate: prisma.shareLink,
		buildFilters: buildShareLinkFilters,
		defaultOrderBy,
	}),

	// ====================================================== //
	// =================== CRUD Operations ================== //
	// ====================================================== //

	findById(id: string, tx?: PrismaTx): Promise<ShareLink | null> {
		const db = tx || prisma
		return db.shareLink.findUnique({ where: { id } })
	},

	findAll(args: Prisma.ShareLinkFindManyArgs, tx?: PrismaTx): Promise<ShareLink[]> {
		const db = tx || prisma
		return db.shareLink.findMany(args)
	},

	create(
		data: Prisma.ShareLinkCreateInput,
		tx?: PrismaTx
	): Promise<ShareLink> {
		const db = tx || prisma
		return db.shareLink.create({ data })
	},

	update(
		args: Prisma.ShareLinkUpdateArgs,
		tx?: PrismaTx
	): Promise<ShareLink> {
		const db = tx || prisma
		return db.shareLink.update(args)
	},

	delete(
		id: string,
		tx?: PrismaTx
	): Promise<ShareLink> {
		const db = tx || prisma
		return db.shareLink.delete({ where: { id } })
	},

	// =========================================================
	//  CUSTOM METHODS
	// =========================================================

	/**
	 * Creates a share link for a specific item.
	 * This is a transactional operation that creates both the ShareLink
	 * and the associated Permission record.
	 * @param itemId The ID of the item to share.
	 * @param data The data for the ShareLink.
	 * @param permissionData The data for the associated Permission.
	 * @returns The newly created ShareLink.
	 */
	async createForItem(
		itemId: string,
		data: Omit<Prisma.ShareLinkCreateInput, 'permission'>,
		permissionData: Omit<Prisma.PermissionCreateInput, 'item' | 'link'>
	): Promise<ShareLink> {
		return prisma.$transaction(async (tx) => {
			const newLink = await tx.shareLink.create({
				data,
			})

			await tx.permission.create({
				data: {
					...permissionData,
					item: { connect: { id: itemId } },
					link: { connect: { id: newLink.id } },
				},
			})

			return newLink
		})
	},

	/**
	 * Finds a ShareLink by its URL, including the item and permissions.
	 * @param url The URL of the share link.
	 * @param tx Optional Prisma transaction client.
	 * @returns The ShareLink with its related item and permissions, or null if not found.
	 */
	findByUrl(
		url: string,
		tx?: PrismaTx
	): Promise<
		| (ShareLink & {
				permission: (Prisma.PermissionGetPayload<{
					include: { item: true }
				}>)[]
		  })
		| null
	> {
		const db = tx || prisma
		return db.shareLink.findFirst({
			where: { url },
			include: {
				permission: {
					include: {
						item: true,
					},
				},
			},
		})
	},

	/**
	 * Finds a ShareLink by its ID, but only if it's active (not expired).
	 * @param id The ID of the share link.
	 * @param tx Optional Prisma transaction client.
	 * @returns The ShareLink, or null if not found or expired.
	 */
	findActiveById(id: string, tx?: PrismaTx): Promise<ShareLink | null> {
		const db = tx || prisma
		return db.shareLink.findFirst({
			where: {
				id,
				OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
			},
		})
	},

	/**
	 * Grants a user access to a share link by adding them to its permission.
	 * @param linkId The ID of the share link.
	 * @param userId The ID of the user to add.
	 * @returns The updated Permission record.
	 */
	async addUserToPermission(
		linkId: string,
		userId: string,
		tx?: PrismaTx
	) {
		const db = tx || prisma
		const permission = await db.permission.findFirst({
			where: { linkId },
		})
		if (!permission) {
			throw new Error('Permission for the given share link not found.')
		}
		return db.permission.update({
			where: { id: permission.id },
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
	async removeUserFromPermission(
		linkId: string,
		userId: string,
		tx?: PrismaTx
	) {
		const db = tx || prisma
		const permission = await db.permission.findFirst({
			where: { linkId },
		})
		if (!permission) {
			throw new Error('Permission for the given share link not found.')
		}
		return db.permission.update({
			where: { id: permission.id },
			data: {
				users: {
					disconnect: { id: userId },
				},
			},
		})
	},
}
