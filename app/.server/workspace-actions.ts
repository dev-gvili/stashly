import { prisma } from '@/services/db'
import { StashlyError, StashlyErrorCode } from '@/services/api.errors'
import { getPrefixForModel, toObjectId } from '@/utils/converters'
import {
  grantItemPermission,
  hasItemPermission,
  getItemPermissions,
  deletePermission,
  syncWorkspaceItemPermissions,
  removeAllWorkspaceItemPermissions,
} from '@/services/permission-actions'
import {
  findItem,
  createItem,
  updateItem,
  deleteItem,
  findWorkspaceItems,
  addFavorite,
  removeFavorite,
} from '@/services/item-actions'
import {
  buildWorkspaceMemberFilters,
  workspaceMemberFilterSchema,
} from '@/utils/filters/workspaceMember.filters'
import {
  buildWorkspaceFilters,
  workspaceFilterSchema,
} from '@/utils/filters/workspace.filters'
import { searchFactory } from '@/utils/search'
import type { Workspace, WorkspaceMember, Permission, Prisma } from '@/prisma/client'
import type { WorkspaceMemberRole, PermissionRole } from '@/prisma/enums'
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PrismaTx = Omit<
  typeof prisma,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>

/**
 * Options for customising guard/assertion error shape.
 */
export interface GuardErrorOptions {
  message?: string
  statusCode?: number
  /** e.g. 'ForbiddenError', 'UnauthorizedError' */
  errorType?: string
}

function throwGuardError(defaultMessage: string, opts?: GuardErrorOptions): never {
  const err: any = new Error(opts?.message ?? defaultMessage)
  if (opts?.statusCode) err.statusCode = opts.statusCode
  if (opts?.errorType) err.name = opts.errorType
  throw err
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/**
 * Paginated, filterable search over Workspace records.
 *
 * @example
 * const page = await searchWorkspaces({ name: 'acme', take: 10 })
 */
export const searchWorkspaces = searchFactory({
  dbDelegate: prisma.workspace,
  buildFilters: buildWorkspaceFilters,
  defaultOrderBy: (_params: z.infer<typeof workspaceFilterSchema>) => ({} as Prisma.WorkspaceOrderByWithRelationInput),
})

/**
 * Paginated, filterable search over WorkspaceMember records.
 *
 * @example
 * const page = await searchWorkspaceMembers({ workspaceId: 'ws_123', roles: ['admin'] })
 */
export const searchWorkspaceMembers = searchFactory({
  dbDelegate: prisma.workspaceMember,
  buildFilters: buildWorkspaceMemberFilters,
  defaultOrderBy: (params: z.infer<typeof workspaceMemberFilterSchema>) => ({
    ...(params.workspaceId
      ? { member: { name: 'asc' as const }, role: 'asc' as const }
      : { workspace: { name: 'asc' as const }, member: { name: 'asc' as const } }),
  }),
})

// ---------------------------------------------------------------------------
// Workspace CRUD
// ---------------------------------------------------------------------------

/**
 * Find a workspace by its unique ID.
 *
 * @param id - The workspace ID.
 * @returns The workspace or `null` if not found.
 *
 * @example
 * const ws = await findWorkspaceById('ws_123')
 */
export function findWorkspaceById(id: string): Promise<Workspace | null> {
  return prisma.workspace.findUnique({ where: { id } })
}

/**
 * Find a workspace by its URL slug.
 *
 * @param slug - The unique slug.
 * @returns The workspace or `null` if not found.
 *
 * @example
 * const ws = await findWorkspaceBySlug('my-team')
 */
export function findWorkspaceBySlug(slug: string): Promise<Workspace | null> {
  return prisma.workspace.findUnique({ where: { slug } })
}

/**
 * Return all workspaces matching the provided Prisma args.
 *
 * @param args - Optional `findMany` args (where, orderBy, take, skip …).
 *
 * @example
 * const all = await findAllWorkspaces()
 * const active = await findAllWorkspaces({ where: { default: false } })
 */
export function findAllWorkspaces(args?: Prisma.WorkspaceFindManyArgs): Promise<Workspace[]> {
  return prisma.workspace.findMany(args)
}

/**
 * Create a new workspace. Generates a prefixed object-ID automatically.
 *
 * @param data - Prisma create input for the Workspace model.
 * @returns The created workspace.
 *
 * @example
 * const ws = await createWorkspace({ name: 'Design Team', slug: 'design-team' })
 */
export function createWorkspace(data: Omit<Prisma.WorkspaceCreateInput, 'id'>): Promise<Workspace> {
  return prisma.workspace.create({
    data: { ...data, id: toObjectId(getPrefixForModel('Workspace')) },
  })
}

/**
 * Update an existing workspace.
 *
 * @param args - Prisma update args (`where` + `data`).
 * @returns The updated workspace.
 *
 * @example
 * const ws = await updateWorkspace({ where: { id: 'ws_123' }, data: { name: 'New Name' } })
 */
export function updateWorkspace(args: Prisma.WorkspaceUpdateArgs): Promise<Workspace> {
  return prisma.workspace.update(args)
}

/**
 * Delete a workspace by ID.
 *
 * @param id - The workspace ID.
 * @returns The deleted workspace record.
 *
 * @example
 * await deleteWorkspace('ws_123')
 */
export function deleteWorkspace(id: string): Promise<Workspace> {
  return prisma.workspace.delete({ where: { id } })
}

// ---------------------------------------------------------------------------
// Member CRUD
// ---------------------------------------------------------------------------

/**
 * Find a workspace member record by its own ID.
 *
 * @param id - The WorkspaceMember record ID.
 * @param tx - Optional transaction client.
 *
 * @example
 * const mem = await findMemberById('wm_abc')
 */
export function findMemberById(id: string, tx?: PrismaTx): Promise<WorkspaceMember | null> {
  const db = tx ?? prisma
  return db.workspaceMember.findUnique({ where: { id } })
}

/**
 * Find the membership record linking a user to a workspace.
 *
 * @param userId - The user's ID.
 * @param workspaceId - The workspace ID.
 * @param tx - Optional transaction client.
 * @returns The member record or `null` if the user is not a member.
 *
 * @example
 * const mem = await findMemberByUserAndWorkspace(userId, workspaceId)
 */
export function findMemberByUserAndWorkspace(
  userId: string,
  workspaceId: string,
  tx?: PrismaTx
): Promise<WorkspaceMember | null> {
  const db = tx ?? prisma
  return db.workspaceMember.findFirst({ where: { memberId: userId, workspaceId } })
}

/**
 * Return all members of a workspace.
 *
 * @param workspaceId - The workspace ID.
 * @param tx - Optional transaction client.
 *
 * @example
 * const members = await getMembersForWorkspace('ws_123')
 */
export function getMembersForWorkspace(
  workspaceId: string,
  tx?: PrismaTx
): Promise<WorkspaceMember[]> {
  const db = tx ?? prisma
  return db.workspaceMember.findMany({ where: { workspaceId } })
}

/**
 * Add a user to a workspace with the given role (default `member`).
 *
 * @param userId - The user to add.
 * @param workspaceId - The workspace to join.
 * @param role - The initial role (defaults to `member`).
 * @param tx - Optional transaction client.
 * @returns The created WorkspaceMember record.
 *
 * @example
 * const mem = await addMember(userId, workspaceId, 'admin')
 */
export function addMember(
  userId: string,
  workspaceId: string,
  role: WorkspaceMemberRole = 'member',
  tx?: PrismaTx
): Promise<WorkspaceMember> {
  const db = tx ?? prisma
  return db.workspaceMember.create({
    data: {
      id: toObjectId(getPrefixForModel('WorkspaceMember')),
      member: { connect: { id: userId } },
      workspace: { connect: { id: workspaceId } },
      role,
    },
  })
}

/**
 * Update a workspace member record.
 *
 * @param args - Prisma update args (`where` + `data`).
 * @param tx - Optional transaction client.
 * @returns The updated WorkspaceMember record.
 *
 * @example
 * await updateMember({ where: { id: 'wm_abc' }, data: { role: 'admin' } })
 */
export function updateMember(
  args: Prisma.WorkspaceMemberUpdateArgs,
  tx?: PrismaTx
): Promise<WorkspaceMember> {
  const db = tx ?? prisma
  return db.workspaceMember.update(args)
}

// ---------------------------------------------------------------------------
// Member Checks
// ---------------------------------------------------------------------------

/**
 * Returns `true` if the user is a member of the workspace (any role).
 *
 * @example
 * if (await isMember(userId, workspaceId)) { ... }
 */
export async function isMember(
  userId: string,
  workspaceId: string,
  tx?: PrismaTx
): Promise<boolean> {
  const db = tx ?? prisma
  const count = await db.workspaceMember.count({ where: { memberId: userId, workspaceId } })
  return count > 0
}

/**
 * Returns the total number of members in a workspace.
 *
 * @example
 * const n = await countMembers('ws_123')
 */
export async function countMembers(workspaceId: string, tx?: PrismaTx): Promise<number> {
  const db = tx ?? prisma
  return db.workspaceMember.count({ where: { workspaceId } })
}

/**
 * Returns `true` if the user holds exactly the specified role in the workspace.
 *
 * @example
 * if (await hasRole(userId, workspaceId, 'owner')) { ... }
 */
export async function hasRole(
  userId: string,
  workspaceId: string,
  role: WorkspaceMemberRole,
  tx?: PrismaTx
): Promise<boolean> {
  const member = await findMemberByUserAndWorkspace(userId, workspaceId, tx)
  return !!member && member.role === role
}

/**
 * Returns `true` if the user's role is equal to or higher than `role`.
 * Role order (ascending): viewer → member → admin → owner.
 *
 * @example
 * if (await hasAtLeastRole(userId, workspaceId, 'admin')) { ... }
 */
export async function hasAtLeastRole(
  userId: string,
  workspaceId: string,
  role: WorkspaceMemberRole,
  tx?: PrismaTx
): Promise<boolean> {
  const member = await findMemberByUserAndWorkspace(userId, workspaceId, tx)
  if (!member) return false
  const order = ['viewer', 'member', 'admin', 'owner'] as const
  return order.indexOf(member.role) >= order.indexOf(role)
}

// ---------------------------------------------------------------------------
// Member Guards (throw on failure)
// ---------------------------------------------------------------------------

/**
 * Asserts the user has exactly the given role in the workspace.
 * Throws a customisable error if not.
 *
 * @throws When the user does not hold `role`.
 *
 * @example
 * await requireRole(userId, workspaceId, 'owner')
 */
export async function requireRole(
  userId: string,
  workspaceId: string,
  role: WorkspaceMemberRole,
  opts?: GuardErrorOptions
): Promise<void> {
  const has = await hasRole(userId, workspaceId, role)
  if (!has) {
    throwGuardError(
      `Access denied: user ${userId} must have role "${role}" in workspace ${workspaceId}`,
      opts
    )
  }
}

/**
 * Asserts the user has at least the specified role.
 * Throws a customisable error if not.
 *
 * @throws When the user's role is below `role`.
 *
 * @example
 * await requireAtLeastRole(userId, workspaceId, 'member', { statusCode: 403 })
 */
export async function requireAtLeastRole(
  userId: string,
  workspaceId: string,
  role: WorkspaceMemberRole,
  opts?: GuardErrorOptions
): Promise<void> {
  const has = await hasAtLeastRole(userId, workspaceId, role)
  if (!has) {
    throwGuardError(
      `Access denied: user ${userId} must have at least role "${role}" in workspace ${workspaceId}`,
      opts
    )
  }
}

/**
 * Asserts the user is a member of the workspace (any role).
 * Throws a customisable error if not.
 *
 * @throws When the user is not a member.
 *
 * @example
 * await requireMembership(userId, workspaceId, { statusCode: 403 })
 */
export async function requireMembership(
  userId: string,
  workspaceId: string,
  opts?: GuardErrorOptions
): Promise<void> {
  const ok = await isMember(userId, workspaceId)
  if (!ok) {
    throwGuardError(
      `Access denied: user ${userId} is not a member of workspace ${workspaceId}`,
      opts
    )
  }
}

/**
 * Asserts the user has exactly `role` and returns the member record in one query.
 *
 * @throws When the user does not hold `role`.
 * @returns The WorkspaceMember record.
 *
 * @example
 * const mem = await requireRoleAndFetch(userId, workspaceId, 'owner')
 */
export async function requireRoleAndFetch(
  userId: string,
  workspaceId: string,
  role: WorkspaceMemberRole,
  opts?: GuardErrorOptions
): Promise<WorkspaceMember> {
  const member = await findMemberByUserAndWorkspace(userId, workspaceId)
  if (!member || member.role !== role) {
    throwGuardError(
      `Access denied: user ${userId} must have role "${role}" in workspace ${workspaceId}`,
      opts
    )
  }
  return member
}

/**
 * Asserts the user has at least `role` and returns the member record.
 *
 * @throws When the user's role is below `role`.
 * @returns The WorkspaceMember record.
 *
 * @example
 * const mem = await requireAtLeastRoleAndFetch(userId, workspaceId, 'admin')
 */
export async function requireAtLeastRoleAndFetch(
  userId: string,
  workspaceId: string,
  role: WorkspaceMemberRole,
  opts?: GuardErrorOptions
): Promise<WorkspaceMember> {
  const member = await findMemberByUserAndWorkspace(userId, workspaceId)
  if (!member) {
    throwGuardError(
      `Access denied: user ${userId} is not a member of workspace ${workspaceId}`,
      opts
    )
  }
  const order = ['viewer', 'member', 'admin', 'owner'] as const
  if (order.indexOf(member.role) < order.indexOf(role)) {
    throwGuardError(
      `Access denied: user ${userId} must have at least role "${role}" in workspace ${workspaceId}`,
      opts
    )
  }
  return member
}

/**
 * Asserts the user is a member of the workspace and returns the record.
 *
 * @throws When the user is not a member.
 * @returns The WorkspaceMember record.
 *
 * @example
 * const mem = await requireMembershipAndFetch(userId, workspaceId)
 */
export async function requireMembershipAndFetch(
  userId: string,
  workspaceId: string,
  opts?: GuardErrorOptions
): Promise<WorkspaceMember> {
  const member = await findMemberByUserAndWorkspace(userId, workspaceId)
  if (!member) {
    throwGuardError(
      `Access denied: user ${userId} is not a member of workspace ${workspaceId}`,
      opts
    )
  }
  return member
}

// ---------------------------------------------------------------------------
// Role Management
// ---------------------------------------------------------------------------

/**
 * Change a member's role in a workspace and sync their item-level permissions
 * to reflect the new role — all in one transaction.
 *
 * @param userId - The user whose role is changing.
 * @param workspaceId - The workspace ID.
 * @param newRole - The new role to assign.
 * @returns The updated WorkspaceMember record.
 *
 * @throws {StashlyError} NOT_FOUND if the user is not a member.
 *
 * @example
 * const mem = await changeRole(userId, workspaceId, 'admin')
 */
export async function changeRole(
  userId: string,
  workspaceId: string,
  newRole: WorkspaceMemberRole
): Promise<WorkspaceMember> {
  return prisma.$transaction(async (tc) => {
    const updated = await tc.workspaceMember.update({
      where: { memberId_workspaceId: { memberId: userId, workspaceId } },
      data: { role: newRole },
    })
    await syncMemberItemPermissions(userId, workspaceId, tc)
    return updated
  })
}

/**
 * Remove a user from a workspace and delete all their item-level permissions
 * within that workspace — all in one transaction.
 *
 * @param userId - The user to remove.
 * @param workspaceId - The workspace ID.
 * @returns The removed WorkspaceMember record.
 *
 * @example
 * await removeMember(userId, workspaceId)
 */
export async function removeMember(
  userId: string,
  workspaceId: string
): Promise<WorkspaceMember> {
  return prisma.$transaction(async (tc) => {
    const removed = await tc.workspaceMember.delete({
      where: { memberId_workspaceId: { memberId: userId, workspaceId } },
    })
    await removeAllMemberItemPermissions(userId, workspaceId, tc)
    return removed
  })
}

// ---------------------------------------------------------------------------
// Workspace Items
// ---------------------------------------------------------------------------

/**
 * Get all items in a workspace (no permission check — internal use).
 *
 * @param workspaceId - The workspace ID.
 *
 * @example
 * const items = await getWorkspaceItems('ws_123')
 */
export function getWorkspaceItems(workspaceId: string) {
  return findWorkspaceItems(workspaceId)
}

/**
 * List items in a workspace the user can access.
 * Requires workspace membership.
 *
 * @throws When the user is not a member.
 *
 * @example
 * const items = await listWorkspaceItems(userId, workspaceId)
 */
export async function listWorkspaceItems(userId: string, workspaceId: string) {
  await requireMembership(userId, workspaceId, {
    statusCode: 403,
    message: 'You are not a member of this workspace',
  })
  return findWorkspaceItems(workspaceId)
}

/**
 * Create a new item in a workspace.
 * Requires the user to be at least a `member`.
 *
 * @throws {StashlyError} When the user is not a member or parent item is missing.
 *
 * @example
 * const item = await createWorkspaceItem(userId, workspaceId, { name: 'Report.pdf', type: 'file', ... })
 */
export async function createWorkspaceItem(
  userId: string,
  workspaceId: string,
  data: Prisma.ItemUncheckedCreateInput
) {
  await requireAtLeastRole(userId, workspaceId, 'member', {
    statusCode: 403,
    message: 'You must be a workspace member to create items',
  })

  if (data.parentId) {
    const parent = await findItem({ where: { id: data.parentId } })
    if (!parent) throw new Error('Parent item not found')
  }

  const { workspaceId: _wid, ownerId: _oid, ...rest } = data
  const item = await createItem({
    data: {
      ...rest,
      id: toObjectId(getPrefixForModel('Item')),
      workspaceId,
      ownerId: userId,
    },
  })

  await grantItemPermission(userId, item.id, 'write')
  return item
}

/**
 * Update an item.
 * Requires item-level write permission **or** workspace admin/owner.
 *
 * @throws {StashlyError} NOT_FOUND if the item does not exist.
 * @throws {StashlyError} FORBIDDEN if the user lacks write access.
 *
 * @example
 * const updated = await updateWorkspaceItem(userId, itemId, { name: 'New Name' })
 */
export async function updateWorkspaceItem(
  userId: string,
  itemId: string,
  updateData: Prisma.ItemUpdateInput
) {
  const item = await findItem({ where: { id: itemId } })
  if (!item) throw new StashlyError(StashlyErrorCode.NOT_FOUND, 'Item not found')

  const canEdit = await hasItemPermission(userId, itemId, 'write')
  if (!canEdit && item.workspaceId) {
    await requireAtLeastRole(userId, item.workspaceId, 'admin', {
      statusCode: 403,
      message: 'You do not have permission to edit this item',
    })
  }

  return updateItem({ where: { id: itemId }, data: updateData })
}

/**
 * Delete an item.
 * Requires item-level write permission **or** workspace admin/owner.
 *
 * @throws {StashlyError} NOT_FOUND if the item does not exist.
 * @throws {StashlyError} FORBIDDEN if the user lacks delete access.
 *
 * @example
 * await deleteWorkspaceItem(userId, itemId)
 */
export async function deleteWorkspaceItem(userId: string, itemId: string) {
  const item = await findItem({ where: { id: itemId } })
  if (!item) throw new StashlyError(StashlyErrorCode.NOT_FOUND, 'Item not found')

  const canDelete = await hasItemPermission(userId, itemId, 'write')
  if (!canDelete && item.workspaceId) {
    await requireAtLeastRole(userId, item.workspaceId, 'admin', {
      statusCode: 403,
      message: 'Only admins or owners can delete items',
    })
  }

  return deleteItem(itemId, userId)
}

/**
 * Mark an item as a favourite for the user.
 * Requires read access (item-level) or workspace membership.
 *
 * @throws {StashlyError} NOT_FOUND if the item does not exist.
 * @throws When the user has no access to the item.
 *
 * @example
 * await favoriteItem(userId, itemId)
 */
export async function favoriteItem(userId: string, itemId: string) {
  const item = await findItem({ where: { id: itemId } })
  if (!item) throw new StashlyError(StashlyErrorCode.NOT_FOUND, 'Item not found')

  const canRead = await hasItemPermission(userId, itemId, 'read')
  if (!canRead && item.workspaceId) {
    await requireMembership(userId, item.workspaceId, {
      statusCode: 403,
      message: 'You do not have access to this item',
    })
  }

  return addFavorite(itemId, userId)
}

/**
 * Remove an item from the user's favourites.
 *
 * @throws {StashlyError} NOT_FOUND if the item does not exist.
 *
 * @example
 * await unfavoriteItem(userId, itemId)
 */
export async function unfavoriteItem(userId: string, itemId: string) {
  const item = await findItem({ where: { id: itemId } })
  if (!item) throw new StashlyError(StashlyErrorCode.NOT_FOUND, 'Item not found')

  return removeFavorite(itemId, userId)
}

// ---------------------------------------------------------------------------
// Item Permissions (workspace-scoped)
// ---------------------------------------------------------------------------

/**
 * Grant a specific role on an item to another user.
 * Only the item owner or workspace admin/owner can do this.
 *
 * @param actingUserId - The user performing the grant.
 * @param targetUserId - The user receiving the permission.
 * @param itemId - The item to grant access to.
 * @param role - The permission role to grant.
 *
 * @throws {StashlyError} NOT_FOUND if the item does not exist.
 * @throws {StashlyError} FORBIDDEN if the acting user lacks authority.
 *
 * @example
 * await grantItemPermissionToUser(adminId, memberId, itemId, 'read')
 */
export async function grantItemPermissionToUser(
  actingUserId: string,
  targetUserId: string,
  itemId: string,
  role: PermissionRole
) {
  const item = await findItem({ where: { id: itemId } })
  if (!item) throw new StashlyError(StashlyErrorCode.NOT_FOUND, 'Item not found')

  const isOwner = item.ownerId === actingUserId
  const isAdmin =
    item.workspaceId != null &&
    (await hasAtLeastRole(actingUserId, item.workspaceId, 'admin'))

  if (!isOwner && !isAdmin) {
    throw new StashlyError(StashlyErrorCode.FORBIDDEN, 'You cannot grant permissions on this item')
  }

  return grantItemPermission(targetUserId, itemId, role)
}

/**
 * Revoke a user's permission on an item.
 * Only the item owner or workspace admin/owner can do this.
 *
 * @param actingUserId - The user performing the revocation.
 * @param targetUserId - The user whose permission is being revoked.
 * @param itemId - The item ID.
 *
 * @throws {StashlyError} NOT_FOUND if the item or permission does not exist.
 * @throws {StashlyError} FORBIDDEN if the acting user lacks authority.
 *
 * @example
 * await revokeItemPermissionFromUser(adminId, memberId, itemId)
 */
export async function revokeItemPermissionFromUser(
  actingUserId: string,
  targetUserId: string,
  itemId: string
) {
  const item = await findItem({ where: { id: itemId } })
  if (!item) throw new StashlyError(StashlyErrorCode.NOT_FOUND, 'Item not found')

  const isOwner = item.ownerId === actingUserId
  const isAdmin =
    item.workspaceId != null &&
    (await hasAtLeastRole(actingUserId, item.workspaceId, 'admin'))

  if (!isOwner && !isAdmin) {
    throw new StashlyError(StashlyErrorCode.FORBIDDEN, 'You cannot revoke permissions on this item')
  }

  const perms = await getItemPermissions(itemId)
  const perm = perms.find((p) => p.users.some((u) => u.id === targetUserId))

  if (!perm) {
    throw new StashlyError(StashlyErrorCode.NOT_FOUND, 'Permission not found for this user')
  }

  return deletePermission(perm.id)
}

/**
 * List all permissions for an item.
 * Only the item owner or workspace admin/owner can view this.
 *
 * @throws {StashlyError} NOT_FOUND if the item does not exist.
 * @throws {StashlyError} FORBIDDEN if the acting user lacks authority.
 *
 * @example
 * const perms = await listItemPermissions(adminId, itemId)
 */
export async function listItemPermissions(
  actingUserId: string,
  itemId: string
): Promise<Permission[]> {
  const item = await findItem({ where: { id: itemId } })
  if (!item) throw new StashlyError(StashlyErrorCode.NOT_FOUND, 'Item not found')

  const isOwner = item.ownerId === actingUserId
  const isAdmin =
    item.workspaceId != null &&
    (await hasAtLeastRole(actingUserId, item.workspaceId, 'admin'))

  if (!isOwner && !isAdmin) {
    throw new StashlyError(StashlyErrorCode.FORBIDDEN, 'You cannot view permissions for this item')
  }

  return getItemPermissions(itemId)
}

/**
 * Sync a member's item-level permissions across the workspace to match their
 * current workspace role. Runs inside the provided transaction.
 *
 * Role → item permission mapping:
 * - `owner` / `admin` → `write`
 * - `member` / `viewer` → `read`
 *
 * @param userId - The workspace member.
 * @param workspaceId - The workspace ID.
 * @param client - An active Prisma transaction client.
 *
 * @throws {StashlyError} NOT_FOUND if the user is not a member.
 *
 * @example
 * await prisma.$transaction(async (tx) => {
 *   await syncMemberItemPermissions(userId, workspaceId, tx)
 * })
 */
export async function syncMemberItemPermissions(
  userId: string,
  workspaceId: string,
  client: Prisma.TransactionClient
): Promise<void> {
  const member = await findMemberByUserAndWorkspace(userId, workspaceId)
  if (!member) {
    throw new StashlyError(StashlyErrorCode.NOT_FOUND, 'User is not a member of this workspace')
  }
  await syncWorkspaceItemPermissions(userId, workspaceId, member.role, client)
}

/**
 * Remove all item-level permissions a user holds within a workspace.
 * Runs inside the provided transaction.
 *
 * @param userId - The user whose permissions should be deleted.
 * @param workspaceId - The workspace to scope the deletion to.
 * @param client - An active Prisma transaction client.
 *
 * @example
 * await prisma.$transaction(async (tx) => {
 *   await removeAllMemberItemPermissions(userId, workspaceId, tx)
 * })
 */
export async function removeAllMemberItemPermissions(
  userId: string,
  workspaceId: string,
  client: Prisma.TransactionClient
): Promise<void> {
  await removeAllWorkspaceItemPermissions(userId, workspaceId, client)
}
