import { prisma } from '@/services/db'
import type { Prisma, WorkspaceMember } from '@/prisma/client'
import type {  WorkspaceMemberRole } from '@/prisma/enums'

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
function throwGuardError(defaultMessage: string, opts?: GuardErrorOptions): never {
  const err: any = new Error(opts?.message || defaultMessage)
  if (opts?.statusCode) err.statusCode = opts.statusCode
  if (opts?.errorType) err.name = opts.errorType
  throw err
}

const DEFAULT_MAX_NO_PAGINATION_LIMIT = 10_000
const DEFAULT_STREAM_BATCH_SIZE = 500

// Return types for searchMembers modes
type PageBasedResult = {
  data: WorkspaceMember[]
  total: number
  page: number
  pageSize: number
}

type CursorBasedResult = {
  data: WorkspaceMember[]
  nextCursor?: string
}

type AllResults = {
  data: WorkspaceMember[]
  warning?: string
}

type StreamResult = AsyncGenerator<WorkspaceMember[], void, unknown>

export class WorkspaceMemberRepository {
  constructor(private db = prisma) {}

  // =========================================================
  //  DATA RETRIEVAL
  // =========================================================

  // Overloads for type-safe usage of searchMembers

  // Page-based
  async searchMembers(
    options: {
      workspaceId?: string
      userId?: string
      search?: string
      roles?: WorkspaceMemberRole[]
      page: number
      pageSize: number
      orderBy?: Prisma.WorkspaceMemberOrderByWithRelationInput
      maxNoPaginationLimit?: number
      stream?: false
    }
  ): Promise<PageBasedResult>

  // Cursor-based
  async searchMembers(
    options: {
      workspaceId?: string
      userId?: string
      search?: string
      roles?: WorkspaceMemberRole[]
      cursor: string
      limit: number
      orderBy?: Prisma.WorkspaceMemberOrderByWithRelationInput
      maxNoPaginationLimit?: number
      stream?: false
    }
  ): Promise<CursorBasedResult>

  // No pagination
  async searchMembers(
    options: {
      workspaceId?: string
      userId?: string
      search?: string
      roles?: WorkspaceMemberRole[]
      orderBy?: Prisma.WorkspaceMemberOrderByWithRelationInput
      maxNoPaginationLimit?: number
      stream?: false
    }
  ): Promise<AllResults>

  // Streaming mode
  async searchMembers(
    options: {
      workspaceId?: string
      userId?: string
      search?: string
      roles?: WorkspaceMemberRole[]
      batchSize?: number
      orderBy?: Prisma.WorkspaceMemberOrderByWithRelationInput
      stream: true
    }
  ): Promise<StreamResult>

  // Implementation
  async searchMembers(
    options: {
      workspaceId?: string
      userId?: string
      search?: string
      roles?: WorkspaceMemberRole[]
      page?: number
      pageSize?: number
      cursor?: string
      limit?: number
      batchSize?: number
      orderBy?: Prisma.WorkspaceMemberOrderByWithRelationInput
      maxNoPaginationLimit?: number
      stream?: boolean
    }
  ): Promise<PageBasedResult | CursorBasedResult | AllResults | StreamResult> {
    const {
      workspaceId,
      userId,
      search,
      roles,
      page,
      pageSize,
      cursor,
      limit,
      batchSize = DEFAULT_STREAM_BATCH_SIZE,
      orderBy = workspaceId
        ? { member: { name: 'asc' } }
        : { workspace: { name: 'asc' } },
      maxNoPaginationLimit = DEFAULT_MAX_NO_PAGINATION_LIMIT,
      stream = false
    } = options

    const where: Prisma.WorkspaceMemberWhereInput = {
      ...(workspaceId ? { workspaceId } : {}),
      ...(userId && !workspaceId ? { memberId: userId } : {}),
      ...(roles?.length ? { role: { in: roles } } : {}),
      ...(search
        ? workspaceId
          ? {
              member: {
                OR: [
                  { name: { contains: search, mode: 'insensitive' } },
                  { email: { contains: search, mode: 'insensitive' } }
                ]
              }
            }
          : {
              OR: [
                {
                  workspace: {
                    OR: [
                      { name: { contains: search, mode: 'insensitive' } },
                      { description: { contains: search, mode: 'insensitive' } }
                    ]
                  }
                },
                {
                  member: {
                    OR: [
                      { name: { contains: search, mode: 'insensitive' } },
                      { email: { contains: search, mode: 'insensitive' } }
                    ]
                  }
                }
              ]
            }
        : {})
    }

    // Streaming mode
    if (stream) {
      async function* generator(this: WorkspaceMemberRepository) {
        let lastId: string | undefined
        while (true) {
          const batch = await this.db.workspaceMember.findMany({
            where,
            take: batchSize + 1,
            ...(lastId ? { skip: 1, cursor: { id: lastId } } : {}),
            orderBy,
            include: { member: true, workspace: true }
          })

          if (batch.length === 0) break

          if (batch.length > batchSize) {
            lastId = batch.pop()?.id
          } else {
            lastId = undefined
          }

          yield batch

          if (!lastId) break
        }
      }
      return generator.call(this)
    }

    // Cursor-based
    if (cursor && limit) {
      const data = await this.db.workspaceMember.findMany({
        where,
        take: limit + 1,
        skip: 1,
        cursor: { id: cursor },
        orderBy,
        include: { member: true, workspace: true }
      })
      let nextCursor: string | undefined
      if (data.length > limit) {
        const nextItem = data.pop()
        nextCursor = nextItem?.id
      }
      return { data, nextCursor }
    }

    // Page-based
    if (page && pageSize) {
      const [total, data] = await Promise.all([
        this.db.workspaceMember.count({ where }),
        this.db.workspaceMember.findMany({
          where,
          skip: (page - 1) * pageSize,
          take: pageSize,
          orderBy,
          include: { member: true, workspace: true }
        })
      ])
      return { data, total, page, pageSize }
    }

    // No pagination
    const totalCount = await this.db.workspaceMember.count({ where })
    if (totalCount > maxNoPaginationLimit) {
      throw new Error(
        `Too many results (${totalCount}). Please use pagination, streaming, or refine your filters.`
      )
    }
    const data = await this.db.workspaceMember.findMany({
      where,
      orderBy,
      include: { member: true, workspace: true }
    })
    return {
      data,
      warning:
        totalCount > maxNoPaginationLimit / 2
          ? `Warning: returning ${totalCount} records without pagination may impact performance.`
          : undefined
    }
  }

  // =========================================================
  //  MUTATIONS
  // =========================================================

  async changeRole(
    userId: string,
    workspaceId: string,
    newRole: WorkspaceMemberRole
  ): Promise<WorkspaceMember> {
    return this.db.workspaceMember.update({
      where: { memberId_workspaceId: { memberId: userId, workspaceId } },
      data: { role: newRole }
    })
  }

  async removeMember(
    userId: string,
    workspaceId: string
  ): Promise<WorkspaceMember> {
    return this.db.workspaceMember.delete({
      where: { memberId_workspaceId: { memberId: userId, workspaceId } }
    })
  }

  // =========================================================
  //  QUICK CHECKS
  // =========================================================

  async isMember(userId: string, workspaceId: string): Promise<boolean> {
    const count = await this.db.workspaceMember.count({
      where: { memberId: userId, workspaceId }
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
      where: { memberId: userId, workspaceId }
    })
  }

  // =========================================================
  // 🔐 ACCESS CONTROL GUARDS
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

// Singleton export
export const workspaceMemberRepository = new WorkspaceMemberRepository(prisma)