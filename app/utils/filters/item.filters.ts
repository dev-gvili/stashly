import { z } from 'zod'
import { Prisma, ItemCategory, ItemType, ItemStatus } from '@/prisma/browser'
import { createFilter, buildFiltersFactory } from '@/utils/filters'
import { toZodArraySchema } from '@/utils/converters'
import { PermissionRole, WorkspaceMemberRole } from '@/prisma/browser'
import { date } from './schema.zod'

export const itemFilterSchema = z.object({
  category: toZodArraySchema(z.enum(ItemCategory)).optional(),
  collection: z.string().nonempty().optional(),
  date: z.optional(date),
  favorited: z.boolean().optional(),
  parentId: z.string().optional(),
  query: z.string().min(1).optional(),
  status: z.enum(ItemStatus).optional().default('normal'),
  tags: toZodArraySchema(z.string().trim().min(1)).optional(),
  type: toZodArraySchema(z.enum(ItemType)).default(['file', 'folder']),
  workspaceId: z.string().nonempty().optional(),
  locked: z.boolean().optional(),
  trashed: z.boolean().optional(),
  owner: z.string().nonempty().optional(),
  roles: toZodArraySchema(
    z.enum(PermissionRole).or(z.enum(WorkspaceMemberRole))
  ).optional(),
  id: z.string().nonempty().optional(),
  permission: toZodArraySchema(z.string().nonempty()).optional(),
  hasChildren: z.boolean().optional(),
  extension: toZodArraySchema(z.string().nonempty()).optional(),
  currentUserId: z.string().nonempty().optional(),

  // Pagination Params
  cursor: z.string().optional(),
  take: z.coerce.number().default(50),
  orderBy: z.custom<Prisma.ItemOrderByWithRelationInput>(),
  include: z.custom<Prisma.ItemInclude>(),
})

/**
 * Factory for creating item-specific filters.
 * Uses `createFilterFactory` from the generic filters utility.
 * @see {@link createFilter} for details.
 */
const createItemFilter = createFilter<
  Prisma.ItemWhereInput,
  z.infer<typeof itemFilterSchema>
>()

/**
 * All available item filters.
 * Each filter is defined using `createItemFilter`, which ensures type safety.
 * The key is the filter name, the value is a function that takes the filter value
 * and returns a Prisma `ItemWhereInput` condition.
 */
export const itemFilters = {
  id: createItemFilter(z.string(), (id) => ({ id })),
  collection: createItemFilter(z.string(), (collectionId) => ({
    id: collectionId,
  })),
  /**
    ```md
    * Filter items by creation date.
    * Accepts an object with optional `before` and `after` Date properties.
    * At least one of the properties must be provided.
    * Example: { before: new Date('2023-01-01'), after: new Date('2022-01-01') }
    * This will filter items created between Jan 1, 2022 and Jan 1, 2023.
    * If only `before` is provided, it filters items created before that date.
    * If only `after` is provided, it filters items created after that date.
    * If neither is provided, the filter is ignored.
    * If both are provided, it filters items created within the range.
    * If the input is invalid, an error is logged and the filter is ignored.
    * @see {@link itemFilterSchema} for input validation.
    * @example
    * // Filter items created before Jan 1, 2023
    * { date: { before: new Date('2023-01-01') } }
    * // Filter items created after Jan 1, 2022
    * { date: { after: new Date('2022-01-01') } }
    * // Filter items created between Jan 1, 2022 and Jan 1, 2023
    * { date: { before: new Date('2023-01-01'), after: new Date('2022-01-01') } }
    ```
   * @throws Will log an error if the input is invalid.
   */
  date: createItemFilter(
    date.refine(({ before, after }) => before || after, {
      message: 'At least one of before or after must be provided.',
    }),
    ({ before, after }) => ({
      createdAt: { lte: before, gte: after },
    })
  ),
  type: createItemFilter(z.array(z.enum(ItemType)), (types) => ({
    type: { in: types },
  })),
  extension: createItemFilter(z.array(z.string()), (extensions) => ({
    file: {
      extension: { in: extensions },
    },
  })),
  category: createItemFilter(z.array(z.enum(ItemCategory)), (categories) => ({
    category: { in: categories },
  })),
  status: createItemFilter(z.enum(ItemStatus), (status) => ({
    status,
  })),
  parentId: createItemFilter(z.string().or(z.null()), (parentId) => ({
    parentId,
  })),
  workspace: createItemFilter(z.string(), (workspaceId) => ({
    workspaceId,
  })),
  tags: createItemFilter(z.array(z.string()), (tags) => ({
    tags: {
      hasSome: tags,
    },
  })),
  /** Filter items by their favorited status.
   * If false, filters for items not favorited by any user.
   * @example
   * // Filter items that have been favorited
   * { favorited: true }
   * @example
   * // Filter items that have NOT been favorited
   * { favorited: false }
   */
  favorited: createItemFilter(z.boolean(), (isFavorited, params) => ({
    favorites: isFavorited
      ? {
          some: {
            favoritedById: params.currentUserId,
          },
        } // If true, favorited by *some* user
      : { none: {} }, // If false, favorited by *no* user
  })),
  /** Filter items by their locked status.
   * If false, filters for items not locked.
   */
  locked: createItemFilter(z.boolean(), (isLocked) => ({
    locked: isLocked ? { isNot: null } : null,
  })),
  /** Filter items by their trash status.
   * If false, filters for items not in trash.
   */
  trashed: createItemFilter(z.boolean(), (inTrash) => ({
    trash: inTrash ? { isNot: null } : null,
  })),
  /** Filter items by their owner. */
  owner: createItemFilter(z.string(), (ownerId) => ({
    ownerId,
  })),
  /**
   * Filter items by specific permission IDs.
   * Accepts a single string ID or an array of string IDs.
   */
  permission: createItemFilter(
    z.union([z.string(), z.array(z.string())]),
    (ids) => ({
      permissions: {
        some: {
          users: {
            some: {
              id: Array.isArray(ids) ? { in: ids } : { equals: ids },
            },
          },
        },
      },
    })
  ),
  /**
   * Filter items by specific permission roles.
   * @example
   *  // Filter items that have 'owner' or 'write' roles
   *  { role: ['owner', 'write'] }
   */
  roles: createItemFilter(
    z.array(z.enum(PermissionRole)).or(z.array(z.enum(WorkspaceMemberRole))),
    (roles, params) => {
      if (params.workspaceId) {
        return {
          workspace: {
            id: params.workspaceId,
            members: {
              some: {
                role: {
                  in: roles as WorkspaceMemberRole[],
                },
              },
            },
          },
        }
      }
      return {
        permissions: {
          some: {
            roles: { in: roles as PermissionRole[] },
          },
        },
      }
    }
  ),

  // currentUserId: createItemFilter(z.string(), (currentUserId) => ({
   
  // })),

  /**
   * Filter items by a search query.
   * If `params.workspace` is provided, the search is scoped to item fields (name, description).
   * Otherwise, the search is global, including item and workspace fields (name, description).
   * @param {string} query - The search string.
   * @param {object} params - The full filter parameters, used to check for `workspace` context.
   * @example
   * // Filter items whose name or description contains 'document' within a specific workspace
   * { query: 'document', workspace: 'workspace_id_123' }
   * @example
   * // Filter items whose name, description, or associated workspace's name/description contains 'report'
   * { query: 'report' }
   */
  query: createItemFilter(z.string().min(1), (query, params) => {
    if (params.workspaceId) {
      // Scoped query: only item fields
      return { name: { contains: query, mode: 'insensitive' } }
    }
    // Global query: item + workspace fields
    return {
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        {
          workspace: {
            name: { contains: query, mode: 'insensitive' },
            description: { contains: query, mode: 'insensitive' },
          },
        },
      ],
    }
  }),
  hasChildren: createItemFilter(z.boolean(), (hasChildren) => ({
    folder: hasChildren ? { childCount: { gt: 0 } } : null,
  })),
}

/** Build item filters from provided params.
 * Uses `itemFilters` and `itemFilterSchema` to ensure type safety and correct filtering.
 * @param params - Partial filter parameters matching `itemFilterSchema`.
 * @returns Prisma `ItemWhereInput` object to be used in queries.
 * @example
 * // Example usage:
 * const filters = buildItemFilters({
 *   id: 'item-id',
 *   collection: 'collection-id',
 *   date: { before: new Date('2023-01-01'), after: new Date('2022-01-01') },
 * });
 * const items = await prisma.item.findMany({ where: filters });
 * @see itemFilters for available filters.
 * @see itemFilterSchema for expected input types
 * @link [itemFilters] {@link itemFilters}
 * @throws Will log errors for any invalid filter values.
 * @example
 * // Valid input
 * { date: { before: new Date('2023-01-01') } }
 * // Invalid input (will log an error)
 * { date: { } }
 * @example
 * // Another valid input
 * { status: 'published' }
 * // Invalid input (will log an error)
 * { status: 'invalid-status' }
 */
export const buildItemFilters = buildFiltersFactory({
  filters: itemFilters,
  schema: itemFilterSchema,
})
