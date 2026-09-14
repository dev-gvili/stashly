import { z } from 'zod'
import { Prisma, ItemCategory, ItemType, ItemStatus } from '@/prisma/browser'
import { createFilter, buildFiltersFactory } from '@/utils/filters'
import { toZodArraySchema } from '@/utils/converters'
import { PermissionRole, WorkspaceMemberRole } from '@/prisma/browser'
import { date } from '@/schemas/filters.schemas'

/**
 * ## What a `*.filters.ts` file is responsible for
 *
 * It turns validated URL params into a Prisma `where` clause. It validates
 * **shape** — present / non-empty / valid enum — and never **authority**.
 *
 * Every authorization decision belongs in an action function under
 * `app/.server/*-actions.ts`. A filter that builds a workspace-scoped clause
 * does not verify membership; the action that runs the query does, and throws
 * when the caller is not entitled to what the clause describes.
 *
 * ## The rule that makes this safe
 *
 * `buildFiltersFactory` applies a param only when `key in filters`
 * (`app/utils/filters.ts:127-132`). A schema key with no matching filter entry,
 * or a filter whose key drifts from the schema, therefore contributes **no
 * constraint** — silently, with no error. That failure mode is *open*, not
 * closed: the query returns more rows than intended rather than fewer.
 *
 * `app/utils/__tests__/item-filters-coverage.test.ts` fails the build if the two
 * key sets diverge. Keep them in step; if a schema key is genuinely context for
 * another filter rather than a filter itself, add it to `CONTEXT_ONLY_KEYS`
 * there and say why here.
 */
export const itemFilterSchema = z.object({
  category: toZodArraySchema(z.enum(ItemCategory)).optional(),
  collection: z.string().nonempty().optional(),
  date: z.optional(date),
  favorited: z.boolean().optional(),
  parentId: z.string().optional(),
  // claude wrote:
  // No `.default('')` here: Zod applies a default without re-validating it, so
  // an absent `query` used to arrive as `''` — a value `.min(1)` rejects — and
  // every loader that built item filters logged a ZodError for it.
  // dev wrote:
  // The `query` param is optional, but if present it must be a non-empty string.
  // The `loader` function in `app/routes/stash/search.tsx` ensures that if
  // `query` is absent, it is replaced with `''` before calling `buildItemFilters`.
  // This way, `query` is always a string when passed to `buildItemFilters`, and
  // Zod can validate it correctly, if we don't set a default here. The `loader` function also checks if the query is searchable before proceeding with the search, and if not, we get this error: 'Cannot read properties of undefined (reading 'replace')' from `normalizeQuery`
  query: z.string().optional().default(''),
  status: toZodArraySchema(z.enum(ItemStatus)).optional().default(['normal']),
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
  /**
   * Context only — consumed by the `favorited` filter, never a filter of its
   * own. Use `accessibleBy` to scope a query to one user's reachable items.
   */
  currentUserId: z.string().nonempty().optional(),
  /** Scope to items this user owns or has been granted a permission on. */
  accessibleBy: z.string().nonempty().optional(),
  _count: z.coerce.number().int().positive().optional(),
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
  status: createItemFilter(z.array(z.enum(ItemStatus)), (statuses) => ({
    status: { in: statuses },
  })),
  parentId: createItemFilter(z.string().or(z.null()), (parentId) => ({
    parentId,
  })),
  // Key must match the schema key exactly: `buildFiltersFactory` applies a
  // filter only when `key in filters`, so a name that drifts from the schema
  // (this was `workspace` against a `workspaceId` schema key) silently
  // contributes no constraint. See item-filters-coverage.test.ts.
  workspaceId: createItemFilter(z.string(), (workspaceId) => ({
    workspaceId,
  })),
  /**
   * Scope items to what a given user may see in their personal stash: items
   * they own, plus items explicitly shared with them.
   *
   * A bare `ownerId` equality would be wrong — it hides items shared *with* the
   * user, which they are entitled to see. This filter shapes the query only;
   * whether the caller may ask at all is decided by an action function.
   *
   * @example
   * { accessibleBy: session.user.id }
   */
  accessibleBy: createItemFilter(z.string(), (userId) => ({
    OR: [
      { ownerId: userId },
      { permissions: { some: { users: { some: { id: userId } } } } },
    ],
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
  favorited: createItemFilter(z.boolean(), (isFavorited, params) => {
    if (!isFavorited) return { favorites: { none: {} } }

    // No viewer means there is no "your favorites" set to filter to. Match
    // nothing rather than everything: Prisma strips an `undefined` field, so
    // `some: { favoritedById: undefined }` silently becomes `some: {}` —
    // measured as 1 of 1 favorited items on the dev DB, not 0.
    if (!params.currentUserId) return { id: { in: [] } }

    return { favorites: { some: { favoritedById: params.currentUserId } } }
  }),

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

  // NOTE: there is deliberately no `currentUserId` filter. The key stays in the
  // schema because `favorited` reads `params.currentUserId` as *context* to
  // build its own clause — it is not a scoping filter of its own. To scope a
  // query to one user's reachable items, use `accessibleBy` above.
  //
  // A commented-out filter used to live here, which is how the folder route
  // came to set `currentUserId` and be silently unscoped: the param was passed,
  // matched nothing in this map, and was dropped without a warning.

  /**
   * Filter items by a search query.
   * If `params.workspaceId` is provided, the search is scoped to item fields (name, description).
   * Otherwise, the search is global, including item and workspace fields (name, description).
   * @param {string} query - The search string.
   * @param {object} params - The full filter parameters, used to check for `workspaceId` context.
   * @example
   * // Filter items whose name or description contains 'document' within a specific workspace
   * { query: 'document', workspaceId: 'workspace_id_123' }
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
  _count: createItemFilter(z.number().int().positive(), (_count) => ({
    folder: { childCount: { gte: _count } },
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
