import { Prisma } from '@/prisma/client'
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
): Promise<
  | { ownerId: string; workspaceId: null }
  | { workspaceId: string }
  | { workspaceId: string; ownerId: string }
> {
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
  const scope = await activityScopeFor(userId, workspaceId)
  const owner = 'ownerId' in scope ? Prisma.sql`AND i."ownerId" = ${scope.ownerId}` : Prisma.empty
  const space =
    scope.workspaceId === null
      ? Prisma.sql`AND i."workspaceId" IS NULL`
      : Prisma.sql`AND i."workspaceId" = ${scope.workspaceId}`

  // One statement. `newest` picks the rows with inner joins only, so the planner
  // is free to start from the owner's items (`owner_items`) and the joins below
  // run for `limit` rows. The Prisma `findMany` this replaces sorted on a relation
  // field, which made it build every nested select before `take`: 8,798 rows,
  // 694 ms and 3.2 M tuples read for 12 results (31 Oct). Most kinds are just a
  // non-null `…ActionId` on ItemAction; only pin, collection and favorite carry
  // a `kind` column worth a join. `t.id` breaks ties: 680 timestamps are shared.
  const rows = await prisma.$queryRaw<
    {
      id: string
      observedAt: Date | null
      itemId: string
      name: string
      type: 'file' | 'folder'
      category: ItemCategory
      parentId: string | null
      ownerId: string
      kind: OverviewActivityKind
    }[]
  >`
    WITH newest AS (
      SELECT a."id", a."itemId", t."observedAt", t."id" AS "timeId"
      FROM "Activity" a
      JOIN "ActivityTime" t ON t."id" = a."timeId"
      JOIN "Item" i ON i."id" = a."itemId"
      WHERE true ${owner} ${space}
      ORDER BY t."observedAt" DESC, t."id" COLLATE "C" DESC
      LIMIT ${limit}
    )
    SELECT
      n."id", n."observedAt",
      i."id" AS "itemId", i."name", i."type"::text AS "type", i."category",
      i."parentId", i."ownerId",
      CASE
        WHEN ia."editActionId"       IS NOT NULL THEN 'edited'
        WHEN ia."createActionId"     IS NOT NULL THEN 'created'
        WHEN ia."renameActionId"     IS NOT NULL THEN 'renamed'
        WHEN ia."moveActionId"       IS NOT NULL THEN 'moved'
        WHEN ia."copyActionId"       IS NOT NULL THEN 'copied'
        WHEN ia."shareActionId"      IS NOT NULL THEN 'shared'
        WHEN ia."permissionActionId" IS NOT NULL THEN 'changed_permission'
        WHEN ia."restoreActionId"    IS NOT NULL THEN 'restored'
        WHEN ia."deleteActionId"     IS NOT NULL THEN 'deleted'
        WHEN ia."commentActionId"    IS NOT NULL THEN 'commented'
        WHEN ia."versionActionId"    IS NOT NULL THEN 'updated'
        WHEN ia."uploadActionId"     IS NOT NULL THEN 'uploaded'
        WHEN pin."kind"              IS NOT NULL THEN pin."kind"::text
        WHEN col."kind" = 'item_added'           THEN 'collection_item_added'
        WHEN col."kind" = 'item_removed'         THEN 'collection_item_removed'
        WHEN col."kind"              IS NOT NULL THEN 'collection_emptied'
        WHEN fav."kind"              IS NOT NULL THEN fav."kind"::text
        WHEN ia."bucketActionId"     IS NOT NULL THEN 'bucket_emptied'
        ELSE 'viewed'
      END AS "kind"
    FROM newest n
    JOIN "Item" i ON i."id" = n."itemId"
    LEFT JOIN "ItemAction" ia ON ia."activityId" = n."id"
    LEFT JOIN "PinAction" pin ON pin."id" = ia."pinActionId"
    LEFT JOIN "CollectionAction" col ON col."id" = ia."collectionActionId"
    LEFT JOIN "FavoriteAction" fav ON fav."id" = ia."favoriteActionId"
    ORDER BY n."observedAt" DESC, n."timeId" COLLATE "C" DESC
  `

  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    observedAt: row.observedAt,
    item: {
      id: row.itemId,
      name: row.name,
      type: row.type,
      category: row.category,
      parentId: row.parentId,
      ownerId: row.ownerId,
    },
  }))
}
