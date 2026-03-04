import { prisma } from '@/services/db'
import type { Prisma, WorkspaceMember } from '@/prisma/client'
import type { WorkspaceMemberRole } from '@/prisma/enums'
import {
  buildWorkspaceMemberFilters,
  workspaceMemberFilterSchema,
} from '@/utils/filters/workspaceMember.filters'
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
 * Throws a standardized, customizable error for guards.
 * @param defaultMessage The default error message.
 * @param opts Options for customizing the error.
 * @throws {Error} Throws a customized error.
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

/**
 * Default order by for workspace member queries.
 * @param params The filter parameters.
 * @returns The order by clause.
 */
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

/** Repository for the `WorkspaceMember` model.
 * Provides CRUD operations plus a handful of convenience helpers.
 */
export const workspaceMemberRepository = {
  search: searchFactory({
    dbDelegate: prisma.workspaceMember,
    buildFilters: buildWorkspaceMemberFilters,
    defaultOrderBy,
  }),

  // ====================================================== //
  // =================== CRUD Operations ================== //
  // ====================================================== //

  /**
   * Finds a workspace member by ID.
   * @param id The ID of the workspace member.
   * @param tx Optional Prisma transaction client.
   * @returns The workspace member or null if not found.
   */
  findById(id: string, tx?: PrismaTx): Promise<WorkspaceMember | null> {
    const db = tx || prisma
    return db.workspaceMember.findUnique({ where: { id } })
  },

  /**
   * Finds all workspace members.
   * @param args The arguments for finding all members.
   * @param tx Optional Prisma transaction client.
   * @returns A list of workspace members.
   */
  findAll(args: unknown, tx?: PrismaTx): Promise<WorkspaceMember[]> {
    throw new Error('Method not implemented.')
  },

  /**
   * Creates a new workspace member.
   * @param data The data for the new workspace member.
   * @param tx Optional Prisma transaction client.
   * @returns The created workspace member.
   */
  create(
    data: Prisma.WorkspaceMemberCreateInput,
    tx?: PrismaTx
  ): Promise<WorkspaceMember> {
    const db = tx || prisma
    return db.workspaceMember.create({ data })
  },

  /**
   * Updates a workspace member.
   * @param args The arguments for updating the member.
   * @param tx Optional Prisma transaction client.
   * @returns The updated workspace member.
   */
  update(
    args: Prisma.WorkspaceMemberUpdateArgs,
    tx?: PrismaTx
  ): Promise<WorkspaceMember> {
    const db = tx || prisma
    return db.workspaceMember.update(args)
  },

  /**
   * Deletes a workspace member.
   * @param args The arguments for deleting the member.
   * @param tx Optional Prisma transaction client.
   * @returns The deleted workspace member.
   */
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

  /**
   * Checks if a user is a member of a workspace.
   * @param userId The ID of the user.
   * @param workspaceId The ID of the workspace.
   * @param tx Optional Prisma transaction client.
   * @returns True if the user is a member, false otherwise.
   */
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

  /**
   * Counts the number of members in a workspace.
   * @param workspaceId The ID of the workspace.
   * @param tx Optional Prisma transaction client.
   * @returns The number of members in the workspace.
   */
  async countMembers(workspaceId: string, tx?: PrismaTx): Promise<number> {
    const db = tx || prisma
    return db.workspaceMember.count({ where: { workspaceId } })
  },

  /**
   * Checks if a user has a specific role in a workspace.
   * @param userId The ID of the user.
   * @param workspaceId The ID of the workspace.
   * @param role The role to check for.
   * @param tx Optional Prisma transaction client.
   * @returns True if the user has the specified role, false otherwise.
   */
  async hasRole(
    userId: string,
    workspaceId: string,
    role: WorkspaceMemberRole,
    tx?: PrismaTx
  ): Promise<boolean> {
    const member = await this.findByUserAndWorkspace(userId, workspaceId, tx)
    return !!member && member.role === role
  },

  /**
   * Checks if a user has at least a specific role in a workspace.
   * @param userId The ID of the user.
   * @param workspaceId The ID of the workspace.
   * @param role The minimum role to check for.
   * @param tx Optional Prisma transaction client.
   * @returns True if the user has at least the specified role, false otherwise.
   */
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

  /**
   * Finds a workspace member by user and workspace ID.
   * @param userId The ID of the user.
   * @param workspaceId The ID of the workspace.
   * @param tx Optional Prisma transaction client.
   * @returns The workspace member or null if not found.
   */
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

  /**
   * Ensures a user has a specific role in a workspace. Throws an error if the role requirement is not met.
   * @param userId The ID of the user.
   * @param workspaceId The ID of the workspace.
   * @param role The required role.
   * @param opts Options for the guard error.
   * @throws {GuardError} If the user does not have the specified role.
   */
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

  /**
   * Ensures a user has at least a specific role in a workspace. Throws an error if the requirement is not met.
   * @param userId The ID of the user.
   * @param workspaceId The ID of the workspace.
   * @param role The minimum required role.
   * @param opts Options for the guard error.
   * @throws {GuardError} If the user does not have at least the specified role.
   */
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

  /**
   * Ensures a user is a member of a workspace. Throws an error if they are not.
   * @param userId The ID of the user.
   * @param workspaceId The ID of the workspace.
   * @param opts Options for the guard error.
   * @throws {GuardError} If the user is not a member of the workspace.
   */
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

  /**
   * Ensures a user has a specific role and fetches the membership record. Throws an error if the requirement is not met.
   * @param userId The ID of the user.
   * @param workspaceId The ID of the workspace.
   * @param role The required role.
   * @param opts Options for the guard error.
   * @throws {GuardError} If the user does not have the specified role.
   * @returns The workspace member record.
   */
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

  /**
   * Ensures a user has at least a specific role and fetches the membership record. Throws an error if the requirement is not met.
   * @param userId The ID of the user.
   * @param workspaceId The ID of the workspace.
   * @param role The minimum required role.
   * @param opts Options for the guard error.
   * @throws {GuardError} If the user does not have at least the specified role.
   * @returns The workspace member record.
   */
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

  /**
   * Ensures a user is a member of a workspace and fetches the membership record. Throws an error if they are not.
   * @param userId The ID of the user.
   * @param workspaceId The ID of the workspace.
   * @param opts Options for the guard error.
   * @throws {GuardError} If the user is not a member of the workspace.
   * @returns The workspace member record.
   */
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
