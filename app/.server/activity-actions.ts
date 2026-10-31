import type { Prisma } from '@/prisma/client'
import type { ItemCategory } from '@/prisma/enums'
import { prisma } from '@/services/db'
import { getPrefixForModel, toObjectId } from '@/utils/converters'
import { buildActivityFilters } from '@/utils/filters/activity.filters'
import { searchFactory } from '@/utils/search'
// See the note in permission-actions.ts: these .server modules form an import
// cycle. Safe for the same reason — hoisted function declarations, called at
// request time, never read at module scope.
import { requireMembership, hasAtLeastRole } from './workspace-actions'

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
  defaultOrderBy: (): Prisma.ActivityOrderByWithRelationInput => ({
    id: 'desc',
  }),
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
      upload: true,
      pin: true,
      edit: true,
      collection: true,
      favorite: true,
      bucket: true,
    },
  },
  access: true,
} satisfies Prisma.ActivityInclude

type ActivityWithRelations = Prisma.ActivityGetPayload<{
  include: typeof defaultInclude
}>

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
export async function findActivityById(
  id: string
): Promise<ActivityWithRelations | null> {
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
export async function findAllActivities(
  args?: Prisma.ActivityFindManyArgs
): Promise<ActivityWithRelations[]> {
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
export async function findManyActivities(
  args: Prisma.ActivityFindManyArgs
): Promise<ActivityWithRelations[]> {
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
export async function findFirstActivity(
  args: Prisma.ActivityFindFirstArgs
): Promise<ActivityWithRelations | null> {
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
export async function createActivity(
  data: Omit<Prisma.ActivityCreateInput, 'id'>
): Promise<ActivityWithRelations> {
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
export async function updateActivity(
  args: Prisma.ActivityUpdateArgs
): Promise<ActivityWithRelations> {
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
export async function deleteActivity(
  id: string
): Promise<ActivityWithRelations> {
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
export async function countActivities(
  args?: Prisma.ActivityCountArgs
): Promise<number> {
  return prisma.activity.count(args)
}

// ---------------------------------------------------------------------------
// Overview feed
// ---------------------------------------------------------------------------

export type OverviewActivityKind =
  | 'viewed'
  | 'created'
  | 'edited'
  | 'renamed'
  | 'moved'
  | 'copied'
  | 'shared'
  | 'restored'
  | 'deleted'
  | 'commented'
  | 'updated'
  | 'uploaded'
  | 'pinned'
  | 'unpinned'
  | 'reordered'
  | 'changed_permission'
  | 'collection_item_added'
  | 'collection_item_removed'
  | 'collection_emptied'
  | 'favorited'
  | 'unfavorited'
  | 'bucket_emptied'

export interface OverviewActivity {
  id: string
  kind: OverviewActivityKind
  observedAt: Date | null
  item: {
    id: string
    name: string
    type: 'file' | 'folder'
    category: ItemCategory
    parentId: string | null
    ownerId: string
  } | null
}

/**
 * Resolves which items' activity a user is entitled to see.
 *
 * | context | who may see an item's activity |
 * | --- | --- |
 * | personal | the item owner only |
 * | workspace | the item owner, or a workspace admin (or workspace owner) |
 *
 * Users an item is merely *shared with* see nothing in either context — sharing
 * grants access to the file, not to the audit trail of who did what to it.
 *
 * @throws When `workspaceId` is given and the user is not a member.
 */
export async function activityScopeFor(
  userId: string,
  workspaceId?: string
): Promise<Prisma.ItemWhereInput> {
  if (!workspaceId) {
    // `workspaceId: null` matters: without it a workspace item the user happens
    // to own would surface in their personal feed, carrying workspace context
    // into a personal view.
    return { ownerId: userId, workspaceId: null }
  }

  await requireMembership(userId, workspaceId)

  // hasAtLeastRole ranks viewer < member < admin < owner, so 'admin' admits
  // admins and owners and excludes the rest.
  const elevated = await hasAtLeastRole(userId, workspaceId, 'admin')
  return elevated ? { workspaceId } : { workspaceId, ownerId: userId }
}

/**
 * Activities recently observed on items the user is entitled to see, projected
 * into a small UI-friendly shape for the overview feed.
 *
 * @param workspaceId - When set, returns workspace activity instead of personal
 *   activity, subject to membership and the admin rule in `activityScopeFor`.
 *
 * @example
 * // Personal overview — the user's own, non-workspace items:
 * await getRecentActivityForUser({ userId: session.user.id, limit: 12 })
 *
 * @example
 * // Workspace overview — everything in the workspace for an admin:
 * await getRecentActivityForUser({ userId: session.user.id, workspaceId })
 */
export async function getRecentActivityForUser({
  userId,
  workspaceId,
  limit = 8,
}: {
  userId: string
  workspaceId?: string
  limit?: number
}): Promise<OverviewActivity[]> {
  const item = await activityScopeFor(userId, workspaceId)
  const newestFirst = { time: { observedAt: 'desc' } } as const

  // Two queries on purpose. Sorting on a relation field keeps Postgres from
  // applying `take` before Prisma's per-row joins, so one query built the nested
  // select below for every activity the user has: 8,798 rows, 694 ms and 3.2 M
  // tuples read for 12 results (31 Oct). Picking the ids first touches only
  // Activity and ActivityTime; the joins then run for `limit` rows.
  const newest = await prisma.activity.findMany({
    where: { item },
    orderBy: newestFirst,
    take: limit,
    select: { id: true },
  })

  const rows = await prisma.activity.findMany({
    where: { id: { in: newest.map((row) => row.id) } },
    orderBy: newestFirst,
    select: {
      id: true,
      time: { select: { observedAt: true } },
      item: {
        select: {
          id: true,
          name: true,
          type: true,
          category: true,
          parentId: true,
          ownerId: true,
        },
      },
      access: { select: { id: true } },
      action: {
        select: {
          create: { select: { id: true } },
          rename: { select: { id: true } },
          move: { select: { id: true } },
          delete: { select: { id: true } },
          restore: { select: { id: true } },
          copy: { select: { id: true } },
          share: { select: { id: true } },
          version: { select: { id: true } },
          comment: { select: { id: true } },
          permission: { select: { id: true } },
          edit: { select: { id: true } },
          pin: { select: { id: true, kind: true } },
          upload: { select: { id: true } },
          collection: { select: { id: true, kind: true } },
          favorite: { select: { id: true, kind: true } },
          bucket: { select: { id: true, kind: true } },
        },
      },
    },
  })

  return rows.map((row) => {
    let kind: OverviewActivityKind = 'viewed'
    const a = row.action
    if (a?.edit) kind = 'edited'
    else if (a?.create) kind = 'created'
    else if (a?.rename) kind = 'renamed'
    else if (a?.move) kind = 'moved'
    else if (a?.copy) kind = 'copied'
    else if (a?.share) kind = 'shared'
    else if (a?.permission) kind = 'changed_permission'
    else if (a?.restore) kind = 'restored'
    else if (a?.delete) kind = 'deleted'
    else if (a?.comment) kind = 'commented'
    else if (a?.version) kind = 'updated'
    else if (a?.upload) kind = 'uploaded'
    else if (a?.pin) kind = a.pin.kind
    else if (a?.collection) {
      kind =
        a.collection.kind === 'item_added'
          ? 'collection_item_added'
          : a.collection.kind === 'item_removed'
            ? 'collection_item_removed'
            : 'collection_emptied'
    } else if (a?.favorite) kind = a.favorite.kind
    else if (a?.bucket) kind = 'bucket_emptied'
    else if (row.access) kind = 'viewed'

    return {
      id: row.id,
      kind,
      observedAt: row.time?.observedAt ?? null,
      item: row.item
        ? {
            id: row.item.id,
            name: row.item.name,
            type: row.item.type as 'file' | 'folder',
            category: row.item.category,
            parentId: row.item.parentId,
            ownerId: row.item.ownerId,
          }
        : null,
    }
  })
}
