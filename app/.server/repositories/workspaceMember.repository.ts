import { prisma } from '@/services/db'
import type { Prisma, WorkspaceMember } from '@/prisma/client'
import type { WorkspaceMemberRole } from '@/prisma/enums'
import {
	buildWorkspaceMemberFilters,
	workspaceMemberFilterSchema,
} from '@/services/filters/workspaceMember.filters'
import { z } from 'zod'
import { searchFactory } from '@/utils/search'

/**
 * A Prisma transaction client, compatible with the full client.
 */
type PrismaTx = Omit<
	typeof prisma,
	'$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>

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

export const workspaceMemberRepository = {
	name: 'WorkspaceMember' as const,

	search: searchFactory({
		dbDelegate: prisma.workspaceMember,
		buildFilters: buildWorkspaceMemberFilters,
		defaultOrderBy,
	}),

	// ====================================================== //
	// =================== CRUD Operations ================== //
	// ====================================================== //

	findById(
		id: string,
		tx?: PrismaTx
	): Promise<WorkspaceMember | null> {
		const db = tx || prisma
		return db.workspaceMember.findUnique({ where: { id } })
	},

	findAll(args: unknown, tx?: PrismaTx): Promise<WorkspaceMember[]> {
		throw new Error('Method not implemented.')
	},

	create(
		data: Prisma.WorkspaceMemberCreateInput,
		tx?: PrismaTx
	): Promise<WorkspaceMember> {
		const db = tx || prisma
		return db.workspaceMember.create({ data })
	},

	update(
		args: Prisma.WorkspaceMemberUpdateArgs,
		tx?: PrismaTx
	): Promise<WorkspaceMember> {
		const db = tx || prisma
		return db.workspaceMember.update(args)
	},

	delete(
		args: Prisma.WorkspaceMemberDeleteArgs,
		tx?: PrismaTx
	): Promise<WorkspaceMember> {
		const db = tx || prisma
		return db.workspaceMember.delete(args)
	},

	// =========================================================
	//  QUICK CHECKS
	// =========================================================

	async isMember(
		userId: string,
		workspaceId: string,
		tx?: PrismaTx
	): Promise<boolean> {
		const db = tx || prisma
		const count = await db.workspaceMember.count({
			where: { memberId: userId, workspaceId },
		})
		return count > 0
	},

	async countMembers(workspaceId: string, tx?: PrismaTx): Promise<number> {
		const db = tx || prisma
		return db.workspaceMember.count({ where: { workspaceId } })
	},

	async hasRole(
		userId: string,
		workspaceId: string,
		role: WorkspaceMemberRole,
		tx?: PrismaTx
	): Promise<boolean> {
		const member = await this.findByUserAndWorkspace(userId, workspaceId, tx)
		return !!member && member.role === role
	},

	async hasAtLeastRole(
		userId: string,
		workspaceId: string,
		role: WorkspaceMemberRole,
		tx?: PrismaTx
	): Promise<boolean> {
		const member = await this.findByUserAndWorkspace(userId, workspaceId, tx)
		if (!member) return false
		const order = ['viewer', 'member', 'admin', 'owner'] as const
		return order.indexOf(member.role) >= order.indexOf(role)
	},

	findByUserAndWorkspace(
		userId: string,
		workspaceId: string,
		tx?: PrismaTx
	): Promise<WorkspaceMember | null> {
		const db = tx || prisma
		return db.workspaceMember.findFirst({
			where: { memberId: userId, workspaceId },
		})
	},

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
	},

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
	},

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
	},

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
	},

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
	},

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
	},
}
