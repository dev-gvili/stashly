import { prisma } from '@/services/db'
import { StashlyError, StashlyErrorCode } from '@/services/api.errors'
import { getPrefixForModel, toObjectId } from '@/utils/converters'
import type { Permission, PermissionRole, Prisma } from '@/prisma/client'

type PrismaTx = Omit<
  typeof prisma,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>

// ---------------------------------------------------------------------------
// Core CRUD
// ---------------------------------------------------------------------------

/**
 * Create a new Permission record with the provided data.
 *
 * Use this when you need full control over the permission shape — e.g. when
 * attaching both an item and a link at creation time inside a transaction.
 * For the common cases (granting a user access to an item or a share link)
 * prefer {@link grantItemPermission} or {@link createPermissionForLink}.
 *
 * @param data - Prisma create input for the Permission model.
 * @param tx  - Optional transaction client. Pass when this call is part of a
 *              larger `prisma.$transaction(...)` block.
 * @returns The newly created Permission record.
 *
 * @example
 * // Inside a transaction that creates a ShareLink + its Permission in one shot:
 * const perm = await createPermission(
 *   {
 *     id: toObjectId(getPrefixForModel('Permission')),
 *     roles: 'read',
 *     item: { connect: { id: itemId } },
 *     link: { connect: { id: newLink.id } },
 *   },
 *   tx
 * )
 */
export function createPermission(
  data: Prisma.PermissionCreateInput,
  tx?: PrismaTx
): Promise<Permission> {
  const db = tx ?? prisma
  return db.permission.create({ data })
}

/**
 * Update an existing Permission record.
 *
 * Accepts the full Prisma `UpdateArgs` shape so callers can connect/disconnect
 * users, change the role, or update any scalar field.
 *
 * @param args - Prisma update args (`where` + `data`).
 * @param tx  - Optional transaction client.
 * @returns The updated Permission record.
 *
 * @example
 * // Add a user to an existing permission:
 * await updatePermission({
 *   where: { id: permissionId },
 *   data: { users: { connect: { id: userId } } },
 * })
 *
 * @example
 * // Change the role on a permission:
 * await updatePermission({
 *   where: { id: permissionId },
 *   data: { roles: 'write' },
 * })
 */
export function updatePermission(
  args: Prisma.PermissionUpdateArgs,
  tx?: PrismaTx
): Promise<Permission> {
  const db = tx ?? prisma
  return db.permission.update(args)
}

/**
 * Hard-delete a Permission record by its ID.
 *
 * This permanently removes the record. If you only want to mark a permission
 * as inactive without destroying it, use {@link revokePermission} instead.
 *
 * @param id - The ID of the permission to delete.
 * @param tx - Optional transaction client.
 * @returns The deleted Permission record.
 *
 * @example
 * await deletePermission(perm.id)
 *
 * @example
 * // Inside a transaction:
 * await deletePermission(perm.id, tx)
 */
export function deletePermission(id: string, tx?: PrismaTx): Promise<Permission> {
  const db = tx ?? prisma
  return db.permission.delete({ where: { id } })
}

/**
 * Find a Permission by its unique ID.
 *
 * Returns `null` when no record matches — never throws for a missing record.
 *
 * @param id - The ID of the permission to look up.
 * @param tx - Optional transaction client.
 * @returns The Permission, or `null` if not found.
 *
 * @example
 * const perm = await findPermissionById(permissionId)
 * if (!perm) throw new StashlyError(StashlyErrorCode.NOT_FOUND, 'Permission not found')
 */
export function findPermissionById(
  id: string,
  tx?: PrismaTx
): Promise<Permission | null> {
  const db = tx ?? prisma
  return db.permission.findUnique({ where: { id } })
}

/**
 * Fetch multiple Permission records matching the given Prisma query args.
 *
 * A low-level escape hatch for queries not covered by the higher-level helpers
 * in this module. Prefer the specific finders ({@link getItemPermissions},
 * {@link getLinkPermissions}, etc.) where possible.
 *
 * @param args - Any Prisma `findMany` args (where, include, orderBy, take…).
 * @param tx  - Optional transaction client.
 * @returns An array of matching Permission records (empty if none found).
 *
 * @example
 * // Find all write-role permissions created after a given date:
 * const perms = await findAllPermissions({
 *   where: { roles: 'write', createdAt: { gt: cutoff } },
 *   orderBy: { createdAt: 'desc' },
 * })
 */
export function findAllPermissions(
  args: Prisma.PermissionFindManyArgs,
  tx?: PrismaTx
): Promise<Permission[]> {
  const db = tx ?? prisma
  return db.permission.findMany(args)
}

// ---------------------------------------------------------------------------
// Finders
// ---------------------------------------------------------------------------

/**
 * Return all Permission records that include a given user.
 *
 * Spans items, share links, and invitations — useful for auditing a user's
 * full access footprint across the app.
 *
 * @param userId - The ID of the user whose permissions to retrieve.
 * @returns An array of Permission records (empty if the user has none).
 *
 * @example
 * const allPerms = await findPermissionsByUserId(session.user.id)
 * console.log(`User has ${allPerms.length} permission records`)
 */
export function findPermissionsByUserId(userId: string): Promise<Permission[]> {
  return prisma.permission.findMany({
    where: { users: { some: { id: userId } } },
  })
}

/**
 * Return all Permission records attached to an item, with their associated
 * users eagerly loaded.
 *
 * The included `users` array lets callers inspect exactly who has access
 * without issuing additional queries.
 *
 * @param itemId - The ID of the item.
 * @returns An array of permissions with `users` included (empty if none exist).
 *
 * @example
 * const permissions = await getItemPermissions(itemId)
 * const editors = permissions
 *   .filter(p => p.roles === 'write')
 *   .flatMap(p => p.users)
 */
export function getItemPermissions(itemId: string) {
  return prisma.permission.findMany({
    where: { itemId },
    include: { users: true },
  })
}

/**
 * Return all Permission records tied to a share link.
 *
 * A share link typically has exactly one permission record, but the function
 * returns an array to handle edge cases where duplicates may exist.
 *
 * @param linkId - The ID of the share link.
 * @returns An array of Permission records (empty if none exist).
 *
 * @example
 * const [perm] = await getLinkPermissions(linkId)
 * if (!perm) throw new Error('Share link has no permission record')
 */
export function getLinkPermissions(linkId: string): Promise<Permission[]> {
  return prisma.permission.findMany({ where: { linkId } })
}

/**
 * Return all Permission records tied to an invitation.
 *
 * Invitations have a unique constraint on `invitationId`, so this will
 * return at most one record in practice.
 *
 * @param invitationId - The ID of the invitation.
 * @returns An array of Permission records (empty if none exist).
 *
 * @example
 * const [perm] = await findInvitationPermission(invitationId)
 * if (perm) console.log('Invitation has role:', perm.roles)
 */
export function findInvitationPermission(
  invitationId: string
): Promise<Permission[]> {
  return prisma.permission.findMany({ where: { invitationId } })
}

// ---------------------------------------------------------------------------
// Permission checks
// ---------------------------------------------------------------------------

/**
 * Return `true` if `userId` has at least the given `role` on `itemId`.
 *
 * Does an exact role match — passing `'write'` will NOT automatically pass
 * for a user who only has `'read'`. Check both explicitly if you need a
 * hierarchy, or use {@link assertItemPermission} for the most common guard.
 *
 * @param userId - The user to check.
 * @param itemId - The item to check against.
 * @param role   - The minimum required role (default: `'read'`).
 * @param tx     - Optional transaction client.
 * @returns `true` if the user has the role, `false` otherwise.
 *
 * @example
 * const canRead = await hasItemPermission(userId, itemId)
 * if (!canRead) throw redirect('/403')
 *
 * @example
 * // Inside a transaction:
 * const canWrite = await hasItemPermission(userId, itemId, 'write', tx)
 */
export async function hasItemPermission(
  userId: string,
  itemId: string,
  role: PermissionRole = 'read',
  tx?: PrismaTx
): Promise<boolean> {
  const db = tx ?? prisma
  // Role hierarchy: owner ≥ write ≥ read.
  // A user with a higher role satisfies checks for lower roles.
  const satisfyingRoles: PermissionRole[] =
    role === 'read'
      ? ['read', 'write', 'owner']
      : role === 'write'
        ? ['write', 'owner']
        : ['owner']
  const perm = await db.permission.findFirst({
    where: { itemId, users: { some: { id: userId } }, roles: { in: satisfyingRoles } },
  })
  return !!perm
}

/**
 * Return `true` if `userId` has at least the given `role` via a share link.
 *
 * Used to gate actions on items that were shared externally — the user may
 * not own the item but has been granted access through a link.
 *
 * @param userId - The user to check.
 * @param linkId - The share link to check against.
 * @param role   - The minimum required role (default: `'read'`).
 * @param tx     - Optional transaction client.
 * @returns `true` if the user has the role via the link, `false` otherwise.
 *
 * @example
 * const canView = await hasLinkPermission(userId, linkId)
 * if (!canView) return new Response('Forbidden', { status: 403 })
 *
 * @example
 * // Verify edit rights before updating a shared item:
 * const canEdit = await hasLinkPermission(userId, linkId, 'write')
 */
export async function hasLinkPermission(
  userId: string,
  linkId: string,
  role: PermissionRole = 'read',
  tx?: PrismaTx
): Promise<boolean> {
  const db = tx ?? prisma
  const perm = await db.permission.findFirst({
    where: { linkId, users: { some: { id: userId } }, roles: role },
  })
  return !!perm
}

/**
 * Return `true` if `userId` has at least the given `role` on an invitation.
 *
 * @param userId       - The user to check.
 * @param invitationId - The invitation to check against.
 * @param role         - The minimum required role (default: `'read'`).
 * @param tx           - Optional transaction client.
 * @returns `true` if the user has the role, `false` otherwise.
 *
 * @example
 * const canAccept = await hasInvitationPermission(userId, invitationId)
 * if (!canAccept) throw new StashlyError(StashlyErrorCode.FORBIDDEN)
 */
export async function hasInvitationPermission(
  userId: string,
  invitationId: string,
  role: PermissionRole = 'read',
  tx?: PrismaTx
): Promise<boolean> {
  const db = tx ?? prisma
  const perm = await db.permission.findFirst({
    where: { invitationId, users: { some: { id: userId } }, roles: role },
  })
  return !!perm
}

// ---------------------------------------------------------------------------
// Assertion helpers
// ---------------------------------------------------------------------------

/**
 * Assert that `userId` has at least `role` on `itemId`.
 *
 * Throws a `StashlyError` with code `FORBIDDEN` (HTTP 403) if the check
 * fails. Use this at the top of loaders and actions instead of writing the
 * if/throw yourself.
 *
 * @param userId - The user performing the action.
 * @param itemId - The item being accessed.
 * @param role   - The required role (default: `'read'`).
 * @throws {StashlyError} `FORBIDDEN` when the user lacks the required role.
 *
 * @example
 * // In a route action — guard before any mutation:
 * await assertItemPermission(userId, itemId, 'write')
 * await itemRepository.update({ where: { id: itemId }, data })
 *
 * @example
 * // Default role is 'read' — safe for loader guards:
 * await assertItemPermission(userId, itemId)
 * return itemRepository.findById({ where: { id: itemId } })
 */
export async function assertItemPermission(
  userId: string,
  itemId: string,
  role: PermissionRole = 'read'
): Promise<void> {
  const ok = await hasItemPermission(userId, itemId, role)
  if (!ok) {
    throw new StashlyError(
      StashlyErrorCode.FORBIDDEN,
      `You do not have ${role} access to this item`
    )
  }
}

/**
 * Assert that `userId` has `write` access to `itemId`.
 *
 * Convenience alias for `assertItemPermission(userId, itemId, 'write')`.
 * Throws `FORBIDDEN` if the check fails.
 *
 * @param userId - The user performing the update.
 * @param itemId - The item being updated.
 * @throws {StashlyError} `FORBIDDEN` when the user lacks write access.
 *
 * @example
 * await assertCanUpdateItem(userId, itemId)
 * await itemRepository.update({ where: { id: itemId }, data: { name: newName } })
 */
export function assertCanUpdateItem(userId: string, itemId: string) {
  return assertItemPermission(userId, itemId, 'write')
}

// ---------------------------------------------------------------------------
// Item permission actions
// ---------------------------------------------------------------------------

/**
 * Grant `userId` the given `role` on `itemId` by creating a new Permission.
 *
 * Generates a prefixed object ID automatically — callers do not need to
 * supply an `id`. Safe to call inside a transaction via `tx`.
 *
 * @param userId - The user being granted access.
 * @param itemId - The item to grant access on.
 * @param role   - The role to assign (default: `'read'`).
 * @param tx     - Optional transaction client.
 * @returns The newly created Permission record.
 *
 * @example
 * // Give the uploader write access to their newly created item:
 * await grantItemPermission(userId, item.id, 'write')
 *
 * @example
 * // Share an item as read-only with another user inside a transaction:
 * await prisma.$transaction(async (tx) => {
 *   const item = await itemRepository.create({ data: { ... } }, tx)
 *   await grantItemPermission(viewerId, item.id, 'read', tx)
 * })
 */
export function grantItemPermission(
  userId: string,
  itemId: string,
  role: PermissionRole = 'read',
  tx?: PrismaTx
): Promise<Permission> {
  return createPermission(
    {
      id: toObjectId(getPrefixForModel('Permission')),
      item: { connect: { id: itemId } },
      users: { connect: { id: userId } },
      roles: role,
    },
    tx
  )
}

/**
 * Remove `userId`'s access to `itemId` by disconnecting them from the item's
 * permission record.
 *
 * Silently no-ops if the user has no permission on the item — safe to call
 * without a prior existence check.
 *
 * @param userId - The user whose access to remove.
 * @param itemId - The item to revoke access on.
 * @param tx     - Optional transaction client.
 *
 * @example
 * // Revoke a collaborator's access when they leave a project:
 * await revokeItemPermission(removedUserId, itemId)
 *
 * @example
 * // Inside a transaction that also logs the removal:
 * await prisma.$transaction(async (tx) => {
 *   await revokeItemPermission(userId, itemId, tx)
 *   await auditLog.create({ data: { action: 'permission_revoked', userId, itemId } }, tx)
 * })
 */
export async function revokeItemPermission(
  userId: string,
  itemId: string,
  tx?: PrismaTx
): Promise<void> {
  const permissions = await getItemPermissions(itemId)
  const perm = permissions.find((p) => p.users.some((u) => u.id === userId))
  if (!perm) return

  await updatePermission(
    {
      where: { id: perm.id },
      data: { users: { disconnect: { id: userId } } },
    },
    tx
  )
}

// ---------------------------------------------------------------------------
// Share link permission actions
// ---------------------------------------------------------------------------

/**
 * Create a Permission that ties a share link to an item.
 *
 * Typically called inside a `prisma.$transaction` when creating a ShareLink
 * so both records are committed atomically. Generates the permission ID
 * automatically.
 *
 * @param itemId - The item being shared.
 * @param linkId - The share link granting access.
 * @param data   - Additional permission fields (e.g. `roles`, `expiresAt`).
 *                 Do not include `id`, `item`, or `link` — these are set
 *                 automatically.
 * @param tx     - Optional transaction client.
 * @returns The newly created Permission record.
 *
 * @example
 * await prisma.$transaction(async (tx) => {
 *   const link = await shareLinkRepository.create(linkData, tx)
 *   await createPermissionForLink(itemId, link.id, { roles: 'read' }, tx)
 * })
 */
export function createPermissionForLink(
  itemId: string,
  linkId: string,
  data: Omit<Prisma.PermissionCreateInput, 'item' | 'link' | 'id'>,
  tx?: PrismaTx
): Promise<Permission> {
  return createPermission(
    {
      id: toObjectId(getPrefixForModel('Permission')),
      ...data,
      item: { connect: { id: itemId } },
      link: { connect: { id: linkId } },
    },
    tx
  )
}

/**
 * Add `userId` to the permission record associated with `linkId`.
 *
 * Used when a user accepts a share link invitation — they are connected to
 * the existing permission so subsequent {@link hasLinkPermission} checks pass.
 *
 * @param linkId - The share link whose permission to update.
 * @param userId - The user to grant access to.
 * @param tx     - Optional transaction client.
 * @returns The updated Permission record.
 * @throws {StashlyError} `NOT_FOUND` if no permission record exists for the link.
 *
 * @example
 * // When a user clicks "Accept" on a shared link:
 * await grantLinkPermission(linkId, session.user.id)
 */
export async function grantLinkPermission(
  linkId: string,
  userId: string,
  tx?: PrismaTx
): Promise<Permission> {
  const permissions = await getLinkPermissions(linkId)
  if (!permissions.length) {
    throw new StashlyError(
      StashlyErrorCode.NOT_FOUND,
      'Permission for the given share link not found'
    )
  }
  return updatePermission(
    {
      where: { id: permissions[0].id },
      data: { users: { connect: { id: userId } } },
    },
    tx
  )
}

/**
 * Remove `userId`'s access via a share link.
 *
 * `actorId` must hold `write` access on the link — only the user who created
 * the link (or an admin with write rights) can revoke others' access.
 *
 * @param linkId  - The share link to revoke access on.
 * @param userId  - The user being removed.
 * @param actorId - The user performing the revocation (must have write access).
 * @param tx      - Optional transaction client.
 * @returns The updated Permission record.
 * @throws {StashlyError} `FORBIDDEN` if `actorId` lacks write access on the link.
 * @throws {StashlyError} `NOT_FOUND` if no permission record exists for the link.
 *
 * @example
 * // Owner removes a viewer from a shared link:
 * await revokeLinkPermission(linkId, viewerUserId, ownerUserId)
 *
 * @example
 * // Inline in a route action:
 * const { linkId, targetUserId } = await request.json()
 * await revokeLinkPermission(linkId, targetUserId, session.user.id)
 */
export async function revokeLinkPermission(
  linkId: string,
  userId: string,
  actorId: string,
  tx?: PrismaTx
): Promise<Permission> {
  const canWrite = await hasLinkPermission(actorId, linkId, 'write')
  if (!canWrite) {
    throw new StashlyError(
      StashlyErrorCode.FORBIDDEN,
      'You do not have permission to revoke link access'
    )
  }

  const permissions = await getLinkPermissions(linkId)
  if (!permissions.length) {
    throw new StashlyError(
      StashlyErrorCode.NOT_FOUND,
      'Permission for the given share link not found'
    )
  }
  return updatePermission(
    {
      where: { id: permissions[0].id },
      data: { users: { disconnect: { id: userId } } },
    },
    tx
  )
}

// ---------------------------------------------------------------------------
// Lifecycle helpers
// ---------------------------------------------------------------------------

/**
 * Set an expiry date on a permission to make it time-limited.
 *
 * After `expiresAt` passes the permission will still exist in the database
 * but should be treated as inactive by any code that reads it. Pair with a
 * query filter (`expiresAt: null | { gt: new Date() }`) when checking access.
 *
 * @param id        - The ID of the permission to expire.
 * @param expiresAt - The date/time at which the permission should expire.
 * @param tx        - Optional transaction client.
 * @returns The updated Permission record.
 *
 * @example
 * // Grant read access that expires in 7 days:
 * const perm = await grantItemPermission(userId, itemId, 'read')
 * await expirePermission(perm.id, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))
 */
export function expirePermission(
  id: string,
  expiresAt: Date,
  tx?: PrismaTx
): Promise<Permission> {
  const db = tx ?? prisma
  return db.permission.update({ where: { id }, data: { expiresAt } })
}

/**
 * Soft-delete a permission by stamping `deletedAt` with the current time.
 *
 * The record remains in the database for audit purposes. Any active
 * permission checks should filter out records where `deletedAt` is not null.
 * For a hard delete, use {@link deletePermission} instead.
 *
 * @param id - The ID of the permission to soft-delete.
 * @param tx - Optional transaction client.
 * @returns The updated Permission record with `deletedAt` set.
 *
 * @example
 * // Soft-delete when a workspace member is removed:
 * const perms = await getItemPermissions(itemId)
 * for (const perm of perms.filter(p => p.users.some(u => u.id === removedUserId))) {
 *   await revokePermission(perm.id)
 * }
 */
export function revokePermission(id: string, tx?: PrismaTx): Promise<Permission> {
  const db = tx ?? prisma
  return db.permission.update({ where: { id }, data: { deletedAt: new Date() } })
}

// ---------------------------------------------------------------------------
// Workspace-scoped permission actions
// ---------------------------------------------------------------------------

/**
 * Sync a user's item-level permissions across an entire workspace to match
 * their current workspace role.
 *
 * Role → item permission mapping:
 * - `owner` / `admin` → `write`
 * - `member`          → `read`
 * - `viewer` / other  → permission removed
 *
 * Must be called inside a `prisma.$transaction` — pass the transaction client
 * as `tx`. Iterates every item in the workspace and creates, updates, or
 * deletes the user's permission record accordingly.
 *
 * @param userId      - The user whose permissions to sync.
 * @param workspaceId - The workspace to sync within.
 * @param memberRole  - The user's current workspace role.
 * @param tx          - Transaction client (required — this always runs in a tx).
 *
 * @example
 * // When promoting a viewer to member:
 * await prisma.$transaction(async (tx) => {
 *   await workspaceMemberRepository.update({ where: { id }, data: { role: 'member' } }, tx)
 *   await syncWorkspaceItemPermissions(userId, workspaceId, 'member', tx)
 * })
 */
export async function syncWorkspaceItemPermissions(
  userId: string,
  workspaceId: string,
  memberRole: 'owner' | 'admin' | 'member' | 'viewer',
  tx: Prisma.TransactionClient
): Promise<void> {
  let desiredRole: PermissionRole | null = null
  if (memberRole === 'owner' || memberRole === 'admin') desiredRole = 'write'
  else if (memberRole === 'member') desiredRole = 'read'

  const allItems = await tx.item.findMany({
    where: { workspaceId },
    select: { id: true },
  })

  for (const { id: itemId } of allItems) {
    const perms = await tx.permission.findMany({
      where: { itemId, users: { some: { id: userId } } },
      select: { id: true, roles: true },
    })
    const existing = perms[0]

    if (desiredRole) {
      if (!existing) {
        await tx.permission.create({
          data: {
            id: toObjectId(getPrefixForModel('Permission')),
            item: { connect: { id: itemId } },
            users: { connect: { id: userId } },
            roles: desiredRole,
          },
        })
      } else if (existing.roles !== desiredRole) {
        await tx.permission.update({
          where: { id: existing.id },
          data: { roles: desiredRole },
        })
      }
    } else if (existing) {
      await tx.permission.delete({ where: { id: existing.id } })
    }
  }
}

/**
 * Hard-delete all item-level permissions for a user within a workspace in a
 * single bulk query.
 *
 * Called when a member is removed from a workspace to ensure they lose access
 * to every item inside it. Must be called inside a `prisma.$transaction`.
 *
 * @param userId      - The user whose permissions to remove.
 * @param workspaceId - The workspace to scope the deletion to.
 * @param tx          - Transaction client (required — this always runs in a tx).
 *
 * @example
 * await prisma.$transaction(async (tx) => {
 *   await workspaceMemberRepository.delete({ where: { id: memberId } }, tx)
 *   await removeAllWorkspaceItemPermissions(userId, workspaceId, tx)
 * })
 */
export async function removeAllWorkspaceItemPermissions(
  userId: string,
  workspaceId: string,
  tx: Prisma.TransactionClient
): Promise<void> {
  await tx.permission.deleteMany({
    where: {
      users: { some: { id: userId } },
      item: { workspaceId },
    },
  })
}
