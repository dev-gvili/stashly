import type { Prisma } from '@/prisma/client'
import { prisma } from '@/services/db'
import { getPrefixForModel, toObjectId } from '@/utils/converters'
import { buildActivityFilters } from '@/utils/filters/activity.filters'
import { searchFactory } from '@/utils/search'

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/**
 * Paginated, filterable search over Activity records.
 *
 * @example
 * const page = await searchActivities({ itemId: 'item_123', take: 20, strategy: 'cursor' })
 */
export const searchActivities = searchFactory({
  dbDelegate: prisma.activity,
  buildFilters: buildActivityFilters,
  defaultOrderBy: (): Prisma.ActivityOrderByWithRelationInput => ({ id: 'desc' }),
})

const defaultInclude = {
  time: true,
  item: true,
  action: {
    include: {
      create: true,
      rename: true,
      move: true,
      delete: true,
      restore: true,
      copy: true,
      share: true,
      version: true,
      comment: true,
      permission: true,
      edit: true,
    },
  },
  access: true,
} satisfies Prisma.ActivityInclude

type ActivityWithRelations = Prisma.ActivityGetPayload<{ include: typeof defaultInclude }>

/**
 * Find a single activity by ID.
 *
 * @param id - The activity ID.
 * @returns The activity with relations, or `null` if not found.
 *
 * @example
 * const activity = await findActivityById('act_abc123')
 * if (activity) console.log(activity.action)
 */
export async function findActivityById(id: string): Promise<ActivityWithRelations | null> {
  return prisma.activity.findUnique({ where: { id }, include: defaultInclude })
}

/**
 * Find all activities, optionally scoped by Prisma filter args.
 *
 * @param args - Optional Prisma `findMany` args (where, orderBy, take, skip, etc.).
 * @returns Array of activities with relations.
 *
 * @example
 * const all = await findAllActivities()
 * const recent = await findAllActivities({ orderBy: { time: { createdAt: 'desc' } }, take: 20 })
 */
export async function findAllActivities(args?: Prisma.ActivityFindManyArgs): Promise<ActivityWithRelations[]> {
  return prisma.activity.findMany({ ...args, include: defaultInclude })
}

/**
 * Find multiple activities matching the given Prisma args.
 *
 * @param args - Prisma `findMany` args (where, orderBy, take, skip, etc.).
 * @returns Array of matching activities with relations.
 *
 * @example
 * const itemActivities = await findManyActivities({
 *   where: { item: { id: 'itm_xyz' } },
 *   orderBy: { time: { createdAt: 'desc' } },
 * })
 */
export async function findManyActivities(args: Prisma.ActivityFindManyArgs): Promise<ActivityWithRelations[]> {
  return prisma.activity.findMany({ ...args, include: defaultInclude })
}

/**
 * Find the first activity matching the given Prisma args.
 *
 * @param args - Prisma `findFirst` args (where, orderBy, skip, etc.).
 * @returns The first matching activity with relations, or `null` if none found.
 *
 * @example
 * const latest = await findFirstActivity({
 *   where: { item: { id: 'itm_xyz' } },
 *   orderBy: { time: { createdAt: 'desc' } },
 * })
 */
export async function findFirstActivity(args: Prisma.ActivityFindFirstArgs): Promise<ActivityWithRelations | null> {
  return prisma.activity.findFirst({ ...args, include: defaultInclude })
}

/**
 * Create a new activity record. The ID is auto-generated.
 *
 * @param data - Prisma `ActivityCreateInput` (without `id`).
 * @returns The created activity with relations.
 *
 * @example
 * const activity = await createActivity({
 *   item: { connect: { id: 'itm_xyz' } },
 *   action: { connect: { id: 'act_type_upload' } },
 * })
 */
export async function createActivity(data: Prisma.ActivityCreateInput): Promise<ActivityWithRelations> {
  return prisma.activity.create({
    data: { ...data, id: toObjectId(getPrefixForModel('Activity')) },
    include: defaultInclude,
  })
}

/**
 * Update an existing activity record.
 *
 * @param args - Prisma `ActivityUpdateArgs` (where + data).
 * @returns The updated activity with relations.
 *
 * @example
 * const updated = await updateActivity({
 *   where: { id: 'act_abc123' },
 *   data: { access: { connect: { id: 'acc_new' } } },
 * })
 */
export async function updateActivity(args: Prisma.ActivityUpdateArgs): Promise<ActivityWithRelations> {
  return prisma.activity.update({ ...args, include: defaultInclude })
}

/**
 * Delete an activity by ID.
 *
 * @param id - The activity ID to delete.
 * @returns The deleted activity with relations.
 *
 * @example
 * const deleted = await deleteActivity('act_abc123')
 */
export async function deleteActivity(id: string): Promise<ActivityWithRelations> {
  return prisma.activity.delete({ where: { id }, include: defaultInclude })
}

/**
 * Count activities, optionally scoped by Prisma filter args.
 *
 * @param args - Optional Prisma `count` args (where, etc.).
 * @returns The number of matching activities.
 *
 * @example
 * const total = await countActivities()
 * const itemCount = await countActivities({ where: { item: { id: 'itm_xyz' } } })
 */
export async function countActivities(args?: Prisma.ActivityCountArgs): Promise<number> {
  return prisma.activity.count(args)
}
