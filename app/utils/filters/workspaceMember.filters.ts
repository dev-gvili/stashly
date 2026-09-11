import { z } from 'zod'
import { Prisma, WorkspaceMemberRole } from '@/prisma/client'
import { createFilter, buildFiltersFactory } from '@/utils/filters'
import { toZodArraySchema } from '../converters'

export const workspaceMemberFilterSchema = z
  .object({
    workspaceId: z.string().nonempty(),
    memberId: z.string().nonempty(),
    roles: toZodArraySchema(z.enum(WorkspaceMemberRole)),
    query: z.string().nonempty(),

    // Pagination Params
    cursor: z.string().optional(),
    take: z.coerce.number().default(50),
    orderBy: z.custom<Prisma.WorkspaceMemberOrderByWithRelationInput>(),
    include: z.custom<Prisma.WorkspaceMemberInclude>(),
  })
  .partial()

// Create a type‑safe filter factory bound to this schema
const createWorkspaceMemberFilter = createFilter<
  Prisma.WorkspaceMemberWhereInput,
  z.infer<typeof workspaceMemberFilterSchema>
>()

export const workspaceMemberFilters = {
  /**
   * Filter by workspace ID.
   * @param {string} workspaceId - The ID of the workspace.
   */
  workspaceId: createWorkspaceMemberFilter(z.string(), (workspaceId) => ({
    workspaceId,
  })),

  /**
   * Filter by member ID.
   * @param {string} memberId - The ID of the member.
   */
  memberId: createWorkspaceMemberFilter(z.string(), (memberId) => ({
    memberId,
  })),

  /**
   * Filter by member roles within the workspace.
   * @param {WorkspaceMemberRole[]} roles - An array of WorkspaceMemberRole enums.
   */
  roles: createWorkspaceMemberFilter(
    z.array(z.enum(WorkspaceMemberRole)),
    (roles) => ({ role: { in: roles } })
  ),

  /**
   * Filter by a search string.
   * If `params.workspaceId` is provided, the search is scoped to member fields (name, email).
   * Otherwise, the search is global, including member and workspace fields (name, description).
   * @param {string} search - The search string.
   * @param {object} params - The full filter parameters, used to check for `workspaceId` context.
   */
  query: createWorkspaceMemberFilter(z.string().min(1), (query, params) => {
    if (params.workspaceId) {
      // Scoped search: only member fields
      return {
        member: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
          ],
        },
      }
    }
    // Global search: member + workspace fields
    return {
      OR: [
        {
          workspace: {
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { slug: { contains: query, mode: 'insensitive' } },
              { description: { contains: query, mode: 'insensitive' } },
            ],
          },
        },
        {
          member: {
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { email: { contains: query, mode: 'insensitive' } },
            ],
          },
        },
      ],
    }
  }),
}

/**
 * Build workspace member filters from provided params.
 * Uses `workspaceMemberFilters` and `workspaceMemberFilterSchema` to ensure type safety and correct filtering.
 * @param params - Partial filter parameters matching `workspaceMemberFilterSchema`.
 * @returns Prisma `WorkspaceMemberWhereInput` object to be used in queries.
 * @example
 * // Example usage:
 * const filters = buildWorkspaceMemberFilters({
 *   workspaceId: 'workspace-id',
 *   memberId: 'member-id',
 *   roles: [WorkspaceMemberRole.OWNER, WorkspaceMemberRole.ADMIN],
 * });
 * const workspaceMembers = await prisma.workspaceMember.findMany({ where: filters });
 * @see workspaceMemberFilters for available filters.
 * @see workspaceMemberFilterSchema for expected input types
 * @link [workspaceMemberFilters] {@link workspaceMemberFilters}
 * @throws Will log errors for any invalid filter values.
 * @example
 * // Valid input
 * { workspaceId: 'workspace-id', memberId: 'member-id' }
 * // Invalid input (will log an error)
 * { workspaceId: 'invalid-workspace-id' }
 */
export const buildWorkspaceMemberFilters = buildFiltersFactory({
  filters: workspaceMemberFilters,
  schema: workspaceMemberFilterSchema,
})
