import { prisma } from '@/services/db'
import type { Prisma, WorkspaceMember } from '@/prisma/client'
import type { WorkspaceMemberRole } from '@/prisma/enums'
import { workspaceItemService } from '../services/workspaceItem.service'
import {
	buildWorkspaceMemberFilters,
	workspaceMemberFilterSchema,
} from '@/services/filters/workspaceMember.filters'
import { z } from 'zod'
import { searchFactory } from '@/utils/search'
import type { IRepository } from './IRepository'

/**
 * Options for customizing guard errors.
 */
export interface GuardErrorOptions {
	message?: string
	statusCode?: number
	errorType?: string // e.g. 'ForbiddenError', 'UnauthorizedError'
}

/**
 * Utility: throws a standardized, customizable error for guards.
 */
function throwGuardError(
	defaultMessage: string,
	opts?: GuardErrorOptions
): never {
	const err: any = new Error(opts?.message || defaultMessage)
	if (opts?.statusCode) err.statusCode = opts.statusCode
	if (opts?.errorType) err.name = opts.errorType
	throw err
}

const defaultInclude = {
	workspace: true,
	member: true,
}

const defaultOrderBy: (
	params: z.infer<typeof workspaceMemberFilterSchema>
) => Prisma.WorkspaceMemberOrderByWithRelationInput = (params) => ({
	...(params.workspaceId
		? {
				member: { name: 'asc' as const },
				role: 'asc',
		  }
		: {
				workspace: { name: 'asc' },
				member: { name: 'asc' },
		  }),
})

export class WorkspaceMemberRepository
	implements IRepository<WorkspaceMember, 'WorkspaceMember'>
{
	name = 'WorkspaceMember' as const
	private db: typeof prisma
	public search
	constructor(db: typeof prisma) {
		this.db = db
		this.search = searchFactory({
			dbDelegate: this.db.workspaceMember,
			buildFilters: buildWorkspaceMemberFilters,
			defaultOrderBy,
		})
	}

	// ====================================================== //
	// =================== CRUD Operations ================== //
	// ====================================================== //

	findById(id: string): Promise<WorkspaceMember | null> {
		return this.db.workspaceMember.findUnique({ where: { id } })
	}
	findAll(args: unknown): Promise<WorkspaceMember[]> {
		throw new Error('Method not implemented.')
	}
	create(data: Prisma.WorkspaceMemberCreateInput): Promise<WorkspaceMember> {
		return this.db.workspaceMember.create({ data })
	}
	update(args: Prisma.WorkspaceMemberUpdateArgs): Promise<WorkspaceMember> {
		return this.db.workspaceMember.update(args)
	}
	delete(args: Prisma.WorkspaceMemberDeleteArgs): Promise<WorkspaceMember> {
		return this.db.workspaceMember.delete(args)
	}

	// =========================================================
	//  DATA RETRIEVAL
	// =========================================================

	// =========================================================
	//  MUTATIONS
	// =========================================================

	async changeRole(
		userId: string,
		workspaceId: string,
		newRole: WorkspaceMemberRole
	): Promise<WorkspaceMember> {
		return prisma.$transaction(async (tc) => {
			// 1. Update the role in the workspace membership
			const updatedMember = await tc.workspaceMember.update({
				where: {
					memberId_workspaceId: { memberId: userId, workspaceId },
				},
				data: { role: newRole },
			})

			// 2. Sync item-level permissions to match the new role
			await workspaceItemService.syncItemPermissionsWithWorkspaceRole(
				userId,
				workspaceId,
				tc // pass the transaction client
			)

			return updatedMember
		})
	}

	async removeMember(
		userId: string,
		workspaceId: string
	): Promise<WorkspaceMember> {
		return prisma.$transaction(async (tc) => {
			// 1. Remove the member from the workspace
			const removedMember = await tc.workspaceMember.delete({
				where: {
					memberId_workspaceId: { memberId: userId, workspaceId },
				},
			})

			// 2. Clean up all their item-level permissions in this workspace
			await workspaceItemService.removeAllItemPermissionsForUser(
				userId,
				workspaceId,
				tc
			)

			return removedMember
		})
	}

	// =========================================================
	//  QUICK CHECKS
	// =========================================================

	async isMember(userId: string, workspaceId: string): Promise<boolean> {
		const count = await this.db.workspaceMember.count({
			where: { memberId: userId, workspaceId },
		})
		return count > 0
	}

	async countMembers(workspaceId: string): Promise<number> {
		return this.db.workspaceMember.count({ where: { workspaceId } })
	}

	async hasRole(
		userId: string,
		workspaceId: string,
		role: WorkspaceMemberRole
	): Promise<boolean> {
		const member = await this.findByUserAndWorkspace(userId, workspaceId)
		return !!member && member.role === role
	}

	async hasAtLeastRole(
		userId: string,
		workspaceId: string,
		role: WorkspaceMemberRole
	): Promise<boolean> {
		const member = await this.findByUserAndWorkspace(userId, workspaceId)
		if (!member) return false
		const order = ['viewer', 'member', 'admin', 'owner'] as const
		return order.indexOf(member.role) >= order.indexOf(role)
	}

	async findByUserAndWorkspace(
		userId: string,
		workspaceId: string
	): Promise<WorkspaceMember | null> {
		return this.db.workspaceMember.findFirst({
			where: { memberId: userId, workspaceId },
		})
	}

	// =========================================================
	//  ACCESS CONTROL GUARDS
	// =========================================================

	async requireRole(
		userId: string,
		workspaceId: string,
		role: WorkspaceMemberRole,
		opts?: GuardErrorOptions
	): Promise<void> {
		const has = await this.hasRole(userId, workspaceId, role)
		if (!has) {
			throwGuardError(
				`Access denied: user ${userId} must have role "${role}" in workspace ${workspaceId}`,
				opts
			)
		}
	}

	async requireAtLeastRole(
		userId: string,
		workspaceId: string,
		role: WorkspaceMemberRole,
		opts?: GuardErrorOptions
	): Promise<void> {
		const has = await this.hasAtLeastRole(userId, workspaceId, role)
		if (!has) {
			throwGuardError(
				`Access denied: user ${userId} must have at least role "${role}" in workspace ${workspaceId}`,
				opts
			)
		}
	}

	async requireMembership(
		userId: string,
		workspaceId: string,
		opts?: GuardErrorOptions
	): Promise<void> {
		const isMember = await this.isMember(userId, workspaceId)
		if (!isMember) {
			throwGuardError(
				`Access denied: user ${userId} is not a member of workspace ${workspaceId}`,
				opts
			)
		}
	}

	// =========================================================
	// 🔐 GUARD + FETCH (single-query helpers)
	// =========================================================

	async requireRoleAndFetch(
		userId: string,
		workspaceId: string,
		role: WorkspaceMemberRole,
		opts?: GuardErrorOptions
	): Promise<WorkspaceMember> {
		const member = await this.findByUserAndWorkspace(userId, workspaceId)
		if (!member || member.role !== role) {
			throwGuardError(
				opts?.message ||
					`Access denied: user ${userId} must have role "${role}" in workspace ${workspaceId}`,
				opts
			)
		}
		return member
	}

	async requireAtLeastRoleAndFetch(
		userId: string,
		workspaceId: string,
		role: WorkspaceMemberRole,
		opts?: GuardErrorOptions
	): Promise<WorkspaceMember> {
		const member = await this.findByUserAndWorkspace(userId, workspaceId)
		if (!member) {
			throwGuardError(
				opts?.message ||
					`Access denied: user ${userId} is not a member of workspace ${workspaceId}`,
				opts
			)
		}
		const order = ['viewer', 'member', 'admin', 'owner'] as const
		if (order.indexOf(member.role) < order.indexOf(role)) {
			throwGuardError(
				opts?.message ||
					`Access denied: user ${userId} must have at least role "${role}" in workspace ${workspaceId}`,
				opts
			)
		}
		return member
	}

	async requireMembershipAndFetch(
		userId: string,
		workspaceId: string,
		opts?: GuardErrorOptions
	): Promise<WorkspaceMember> {
		const member = await this.findByUserAndWorkspace(userId, workspaceId)
		if (!member) {
			throwGuardError(
				opts?.message ||
					`Access denied: user ${userId} is not a member of workspace ${workspaceId}`,
				opts
			)
		}
		return member
	}
}

export const workspaceMemberRepository = new WorkspaceMemberRepository(prisma) // Singleton export
