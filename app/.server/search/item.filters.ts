import { z } from 'zod'
import { Prisma, ItemCategory, ItemType, ItemStatus } from '@/prisma/browser'
import { createFilter, buildFiltersFactory } from './filters'
import { toZodArraySchema } from '@/utils/converters'
import { PermissionRole, WorkspaceMemberRole } from '@/prisma/enums'
import { date } from '@/utils/filters/schema.zod'
import { searchService } from './search.service'

export const itemFilterSchema = z.object({
  semanticQuery: z.string().min(1).optional(),
  category: toZodArraySchema(z.enum(ItemCategory)).optional(),
  collection: z.string().nonempty().optional(),
  date: z.optional(date),
  favorited: z.boolean().optional(),
  parent: z.string().nonempty().optional(),
  query: z.string().min(1).optional(),
  status: z.enum(ItemStatus).optional().default("normal"),
  tags: toZodArraySchema(z.string().trim().min(1)).optional(),
  type: toZodArraySchema(z.enum(ItemType)).default(['file']),
  workspace: z.string().nonempty().optional(),
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

  // Pagination Params
  cursor: z.string().optional(),
  take: z.coerce.number().default(25),
  strategy: z.enum(['cursor', 'offset', 'stream']).default('cursor'),
  orderBy: z.record(z.string(), z.enum(['asc', 'desc'])).default({ id: 'asc' }),
  include: z.custom<Prisma.ItemInclude>(),
})

const createItemFilter = createFilter<
  Prisma.ItemWhereInput,
  z.infer<typeof itemFilterSchema>
>()

export const itemFilters = {
  semanticQuery: createItemFilter(z.string().min(1), async (query) => {
    const searchResults = await searchService.semanticSearch(query, 50) // Using a topK of 50
    if (searchResults.length === 0) {
      return { id: { in: ['__no_results__'] } }
    }
    const ids = searchResults.map((r) => r.id)
    return { id: { in: ids } }
  }),
  id: createItemFilter(z.string(), (id) => ({ id })),
  collection: createItemFilter(z.string(), (collectionId) => ({
    id: collectionId,
  })),
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
  parent: createItemFilter(z.string(), (parentId) => ({
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
  favorited: createItemFilter(z.boolean(), (isFavorited) => ({
    favorites: isFavorited ? { some: {} } : { none: {} },
  })),
  locked: createItemFilter(z.boolean(), (isLocked) => ({
    locked: isLocked ? { isNot: null } : null,
  })),
  trashed: createItemFilter(z.boolean(), (inTrash) => ({
    trash: inTrash ? { isNot: null } : null,
  })),
  owner: createItemFilter(z.string(), (ownerId) => ({
    ownerId,
  })),
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
  roles: createItemFilter(
    z.array(z.enum(PermissionRole)).or(z.array(z.enum(WorkspaceMemberRole))),
    (roles, params) => {
      if (params.workspace) {
        return {
          workspace: {
            id: params.workspace,
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
  query: createItemFilter(z.string().min(1), (query, params) => {
    if (params.workspace) {
      return { name: { search: query } }
    }
    return {
      OR: [
        { name: { search: query } },
        {
          workspace: {
            name: { search: query },
            description: { search: query },
          },
        },
      ],
    }
  }),
  hasChildren: createItemFilter(z.boolean(), (hasChildren) => ({
    folder: hasChildren ? { childCount: { gt: 0 } } : null,
  })),
}

export const buildItemFilters = buildFiltersFactory({
  filters: itemFilters,
  schema: itemFilterSchema,
})
