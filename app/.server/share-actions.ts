import { prisma } from '@/services/db'
import { StashlyError, StashlyErrorCode, toRouteError } from '@/utils/api.errors'
import { getPrefixForModel, toObjectId } from '@/utils/converters'
import {
  createPermission,
  getLinkPermissions,
  hasLinkPermission,
  updatePermission,
} from '@/services/permission-actions'
import {
  buildShareLinkFilters,
  shareLinkFilterSchema,
} from '@/utils/filters/shareLink.filters'
import { searchFactory } from '@/utils/search'
import type {
  ShareLink,
  ShareLinkType,
  ShareScope,
  Prisma,
} from '@/prisma/client'
import { z } from 'zod'

type PrismaTx = Omit<
  typeof prisma,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>

const defaultOrderBy = (
  _params: z.infer<typeof shareLinkFilterSchema>
): Prisma.ShareLinkOrderByWithRelationInput => ({ createdAt: 'desc' })

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/**
 * Paginated, filterable search over ShareLink records.
 *
 * Uses the standard `searchFactory` pattern — accepts cursor/offset
 * pagination, filter schemas, and orderBy options.
 *
 * @example
 * const results = await searchShareLinks({ take: 20, strategy: 'cursor' })
 */
export const searchShareLinks = searchFactory({
  dbDelegate: prisma.shareLink,
  buildFilters: buildShareLinkFilters,
  defaultOrderBy,
})

// ---------------------------------------------------------------------------
// Core CRUD
// ---------------------------------------------------------------------------

/**
 * Find a ShareLink by its unique ID.
 *
 * Returns `null` when no record matches — never throws for a missing record.
 *
 * @param id - The ID of the share link.
 * @param tx - Optional transaction client.
 *
 * @example
 * const link = await findShareLinkById(linkId)
 * if (!link) throw toRouteError(StashlyErrorCode.NOT_FOUND, 'Share link not found')
 */
export function findShareLinkById(
  id: string,
  tx?: PrismaTx
): Promise<ShareLink | null> {
  const db = tx ?? prisma
  return db.shareLink.findUnique({ where: { id } })
}

/**
 * Fetch multiple ShareLink records matching the given Prisma query args.
 *
 * @param args - Any Prisma `findMany` args (where, include, orderBy, take…).
 * @param tx  - Optional transaction client.
 *
 * @example
 * const links = await findAllShareLinks({ where: { type: 'view' } })
 */
export function findAllShareLinks(
  args: Prisma.ShareLinkFindManyArgs,
  tx?: PrismaTx
): Promise<ShareLink[]> {
  const db = tx ?? prisma
  return db.shareLink.findMany(args)
}

/**
 * Create a new ShareLink record.
 *
 * For the common case of creating a link tied to an item with a permission,
 * prefer {@link createShareLinkForItem} instead.
 *
 * @param data - Prisma create input for the ShareLink model.
 * @param tx  - Optional transaction client.
 *
 * @example
 * const link = await createShareLink({ id: toObjectId(...), type: 'view', scope: 'anonymous' })
 */
export function createShareLink(
  data: Prisma.ShareLinkCreateInput,
  tx?: PrismaTx
): Promise<ShareLink> {
  const db = tx ?? prisma
  return db.shareLink.create({ data })
}

/**
 * Update an existing ShareLink record.
 *
 * @param args - Prisma update args (`where` + `data`).
 * @param tx  - Optional transaction client.
 *
 * @example
 * await updateShareLink({
 *   where: { id: linkId },
 *   data: { expiresAt: new Date(Date.now() + 7 * 86_400_000) },
 * })
 */
export function updateShareLink(
  args: Prisma.ShareLinkUpdateArgs,
  tx?: PrismaTx
): Promise<ShareLink> {
  const db = tx ?? prisma
  return db.shareLink.update(args)
}

/**
 * Hard-delete a ShareLink by its ID.
 *
 * @param id - The ID of the share link to delete.
 * @param tx - Optional transaction client.
 *
 * @example
 * await deleteShareLink(linkId)
 */
export function deleteShareLink(id: string, tx?: PrismaTx): Promise<ShareLink> {
  const db = tx ?? prisma
  return db.shareLink.delete({ where: { id } })
}

// ---------------------------------------------------------------------------
// Finders
// ---------------------------------------------------------------------------

/**
 * Find a ShareLink by its public URL, including its permissions and the item
 * each permission is scoped to.
 *
 * Used when resolving an incoming share URL to the underlying item.
 *
 * @param url - The public share URL (e.g. `https://stashly.app/s/abc123`).
 * @param tx  - Optional transaction client.
 *
 * @example
 * const link = await findShareLinkByUrl(url)
 * if (!link) throw toRouteError(StashlyErrorCode.NOT_FOUND, 'Invalid share link')
 * const item = link.permission[0]?.item
 */
export function findShareLinkByUrl(
  url: string,
  tx?: PrismaTx
): Promise<
  | (ShareLink & {
      permission: Prisma.PermissionGetPayload<{ include: { item: true } }>[]
    })
  | null
> {
  const db = tx ?? prisma
  return db.shareLink.findFirst({
    where: { url },
    include: { permission: { include: { item: true } } },
  })
}

/**
 * Find a ShareLink by ID, but only if it has not yet expired.
 *
 * Returns `null` for both missing and expired links — callers should treat
 * both the same way (link invalid / access denied).
 *
 * @param id - The ID of the share link.
 * @param tx - Optional transaction client.
 *
 * @example
 * const link = await findActiveShareLink(linkId)
 * if (!link) return new Response('Link expired or not found', { status: 404 })
 */
export function findActiveShareLink(
  id: string,
  tx?: PrismaTx
): Promise<ShareLink | null> {
  const db = tx ?? prisma
  return db.shareLink.findFirst({
    where: {
      id,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
  })
}

/**
 * Find all ShareLinks attached to a specific item via its permissions.
 *
 * Useful for listing the links an item owner has created, or for revoking
 * all sharing when an item is deleted.
 *
 * @param itemId - The ID of the item.
 * @param tx    - Optional transaction client.
 *
 * @example
 * const links = await findShareLinksForItem(itemId)
 * console.log(`Item has ${links.length} active share links`)
 */
export function findShareLinksForItem(
  itemId: string,
  tx?: PrismaTx
): Promise<ShareLink[]> {
  const db = tx ?? prisma
  return db.shareLink.findMany({
    where: { permission: { some: { itemId } } },
  })
}

/**
 * Check whether a ShareLink is still valid (exists and not expired).
 *
 * @param id - The ID of the share link to check.
 * @returns `true` if the link exists and is not expired.
 *
 * @example
 * if (!await isShareLinkActive(linkId)) {
 *   throw toRouteError(StashlyErrorCode.NOT_FOUND, 'Link expired')
 * }
 */
export async function isShareLinkActive(id: string): Promise<boolean> {
  const link = await findActiveShareLink(id)
  return !!link
}

// ---------------------------------------------------------------------------
// Composite actions
// ---------------------------------------------------------------------------

/**
 * Create a ShareLink for an item and its associated Permission record
 * in a single atomic transaction.
 *
 * This is the primary way to share an item — it ensures both records are
 * always created together and never in an inconsistent state.
 *
 * @param itemId         - The item being shared.
 * @param linkData       - Data for the ShareLink (type, scope, url, etc.).
 *                         Do not include `permission` — it is set automatically.
 * @param permissionData - Data for the Permission (roles, expiresAt, etc.).
 *                         Do not include `id`, `item`, or `link`.
 * @returns The newly created ShareLink.
 *
 * @example
 * const link = await createShareLinkForItem(
 *   itemId,
 *   { id: toObjectId(...), type: 'view', scope: 'anonymous', url: '/s/abc' },
 *   { roles: 'read' }
 * )
 */
export function createShareLinkForItem(
  itemId: string,
  linkData: Omit<Prisma.ShareLinkCreateInput, 'permission'>,
  permissionData: Omit<
    Prisma.PermissionUncheckedCreateInput,
    'itemId' | 'linkId' | 'id'
  >
): Promise<ShareLink> {
  return prisma.$transaction(async (tx) => {
    const newLink = await createShareLink(linkData, tx)
    await createPermission(
      {
        id: toObjectId(getPrefixForModel('Permission')),
        ...permissionData,
        itemId,
        linkId: newLink.id,
      },
      tx
    )
    return newLink
  })
}

/**
 * Revoke a single ShareLink by bulk-deleting its Permission records and the
 * link itself in a single atomic transaction.
 *
 * Prefer this over manually deleting permissions then the link in route code.
 *
 * @param linkId - The ID of the share link to revoke.
 *
 * @example
 * await revokeShareLink(linkId)
 */
export async function revokeShareLink(linkId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.permission.deleteMany({ where: { linkId } })
    await tx.shareLink.delete({ where: { id: linkId } })
  })
}

/**
 * Revoke all ShareLinks for an item by deleting them and their associated
 * permissions in a single transaction.
 *
 * Call this when deleting an item or when an owner wants to revoke all
 * external access at once.
 *
 * @param itemId - The item whose links to revoke.
 *
 * @example
 * await revokeAllShareLinksForItem(itemId)
 */
export async function revokeAllShareLinksForItem(
  itemId: string
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const links = await findShareLinksForItem(itemId, tx)
    if (!links.length) return

    const linkIds = links.map((l) => l.id)

    await tx.permission.deleteMany({ where: { linkId: { in: linkIds } } })
    await tx.shareLink.deleteMany({ where: { id: { in: linkIds } } })
  })
}

/**
 * Set an expiry date on a ShareLink to make access time-limited.
 *
 * @param id        - The ID of the share link.
 * @param expiresAt - The date/time at which the link should expire.
 * @param tx        - Optional transaction client.
 *
 * @example
 * // Expire a link in 24 hours:
 * await expireShareLink(linkId, new Date(Date.now() + 86_400_000))
 */
export function expireShareLink(
  id: string,
  expiresAt: Date,
  tx?: PrismaTx
): Promise<ShareLink> {
  return updateShareLink({ where: { id }, data: { expiresAt } }, tx)
}

// ---------------------------------------------------------------------------
// User access management
// ---------------------------------------------------------------------------

/**
 * Add a user to the permission record associated with a share link,
 * granting them access to the shared item.
 *
 * @param linkId - The share link to grant access on.
 * @param userId - The user to add.
 * @param tx    - Optional transaction client.
 * @throws {StashlyError} `NOT_FOUND` if no permission record exists for the link.
 *
 * @example
 * // When a user accepts a share link invitation:
 * await addUserToShareLink(linkId, session.user.id)
 */
export async function addUserToShareLink(
  linkId: string,
  userId: string,
  tx?: PrismaTx
) {
  const permissions = await getLinkPermissions(linkId)
  if (!permissions.length) {
    throw toRouteError(
      StashlyErrorCode.NOT_FOUND,
      'Permission for the given share link not found'
    )
  }
  return updatePermission({ users: { connect: { id: userId } } }, tx)
}

/**
 * Remove a user's access to a share link.
 *
 * `actorId` must hold `write` access on the link — only the link owner or
 * a workspace admin can revoke others' access.
 *
 * @param linkId  - The share link to revoke access on.
 * @param userId  - The user being removed.
 * @param actorId - The user performing the revocation (must have write access).
 * @param tx      - Optional transaction client.
 * @throws {StashlyError} `FORBIDDEN` if `actorId` lacks write access on the link.
 * @throws {StashlyError} `NOT_FOUND` if no permission record exists for the link.
 *
 * @example
 * await removeUserFromShareLink(linkId, viewerUserId, ownerUserId)
 */
export async function removeUserFromShareLink(
  linkId: string,
  userId: string,
  actorId: string,
  tx?: PrismaTx
) {
  const canWrite = await hasLinkPermission(actorId, linkId, 'write')
  if (!canWrite) {
    throw toRouteError(
      StashlyErrorCode.FORBIDDEN,
      'You do not have permission to revoke link access'
    )
  }

  const permissions = await getLinkPermissions(linkId)
  if (!permissions.length) {
    throw toRouteError(
      StashlyErrorCode.NOT_FOUND,
      'Permission for the given share link not found'
    )
  }
  return updatePermission({ users: { disconnect: { id: userId } } }, tx)
}

// ---------------------------------------------------------------------------
// Typed creators
// ---------------------------------------------------------------------------

type ShareLinkOptions = {
  url?: string
  downloadable?: boolean
  password?: string
  expiresAt?: Date
}

/**
 * Create a view-only ShareLink for an item.
 *
 * Pre-sets `type: 'view'` — callers only need to supply `scope` and optional
 * settings. Creates the ShareLink and its Permission atomically.
 *
 * @param itemId  - The item being shared.
 * @param scope   - Who can access the link (`anonymous`, `organization`, `users`).
 * @param options - Optional url, downloadable, password, expiresAt.
 *
 * @example
 * const link = await createViewLink(itemId, 'anonymous', { downloadable: true })
 */
export function createViewLink(
  itemId: string,
  scope: ShareScope,
  options: ShareLinkOptions = {}
): Promise<ShareLink> {
  return createShareLinkForItem(
    itemId,
    {
      id: toObjectId(getPrefixForModel('ShareLink')),
      type: 'view',
      scope,
      ...options,
    },
    { roles: 'read' }
  )
}

/**
 * Create an edit ShareLink for an item.
 *
 * Pre-sets `type: 'edit'` and grants `write` permission to whoever uses it.
 *
 * @param itemId  - The item being shared.
 * @param scope   - Who can access the link.
 * @param options - Optional url, downloadable, password, expiresAt.
 *
 * @example
 * const link = await createEditLink(itemId, 'users', { expiresAt: deadline })
 */
export function createEditLink(
  itemId: string,
  scope: ShareScope,
  options: ShareLinkOptions = {}
): Promise<ShareLink> {
  return createShareLinkForItem(
    itemId,
    {
      id: toObjectId(getPrefixForModel('ShareLink')),
      type: 'edit',
      scope,
      ...options,
    },
    { roles: 'write' }
  )
}

/**
 * Create an embed ShareLink for an item.
 *
 * Always uses `scope: 'anonymous'` — embed links are inherently public.
 * Pre-sets `type: 'embed'` and `downloadable: false`.
 *
 * @param itemId  - The item being embedded.
 * @param options - Optional url, password, expiresAt. `downloadable` is forced false.
 *
 * @example
 * const link = await createEmbedLink(itemId, { url: '/embed/abc' })
 */
export function createEmbedLink(
  itemId: string,
  options: Omit<ShareLinkOptions, 'downloadable'> = {}
): Promise<ShareLink> {
  return createShareLinkForItem(
    itemId,
    {
      id: toObjectId(getPrefixForModel('ShareLink')),
      type: 'embed',
      scope: 'anonymous',
      downloadable: false,
      ...options,
    },
    { roles: 'read' }
  )
}

/**
 * Create an upload ShareLink for an item (e.g. a folder drop zone).
 *
 * Pre-sets `type: 'upload'` and grants `write` permission to uploaders.
 *
 * @param itemId  - The folder or item accepting uploads.
 * @param scope   - Who can use the upload link.
 * @param options - Optional url, password, expiresAt.
 *
 * @example
 * const link = await createUploadLink(folderId, 'organization')
 */
export function createUploadLink(
  itemId: string,
  scope: ShareScope,
  options: ShareLinkOptions = {}
): Promise<ShareLink> {
  return createShareLinkForItem(
    itemId,
    {
      id: toObjectId(getPrefixForModel('ShareLink')),
      type: 'upload',
      scope,
      ...options,
    },
    { roles: 'write' }
  )
}

// ---------------------------------------------------------------------------
// Scope / type finders
// ---------------------------------------------------------------------------

/**
 * Find all ShareLinks of a given type attached to an item.
 *
 * Useful when you need to check whether a specific kind of link (e.g. embed)
 * already exists before creating a duplicate.
 *
 * @param itemId - The item to look up links for.
 * @param type   - The link type to filter by.
 * @param tx     - Optional transaction client.
 *
 * @example
 * const embedLinks = await findShareLinksByType(itemId, 'embed')
 * if (embedLinks.length) return embedLinks[0]
 */
export function findShareLinksByType(
  itemId: string,
  type: ShareLinkType,
  tx?: PrismaTx
): Promise<ShareLink[]> {
  const db = tx ?? prisma
  return db.shareLink.findMany({
    where: { type, permission: { some: { itemId } } },
  })
}

/**
 * Find all ShareLinks with a given scope, optionally filtered by item.
 *
 * Useful for auditing which items are publicly accessible (`anonymous`)
 * or finding all org-scoped links before a workspace is deactivated.
 *
 * @param scope  - The scope to filter by.
 * @param itemId - Optional item ID to narrow results.
 * @param tx     - Optional transaction client.
 *
 * @example
 * // All public links across the app:
 * const publicLinks = await findShareLinksByScope('anonymous')
 *
 * @example
 * // All org-scoped links for one item:
 * const orgLinks = await findShareLinksByScope('organization', itemId)
 */
export function findShareLinksByScope(
  scope: ShareScope,
  itemId?: string,
  tx?: PrismaTx
): Promise<ShareLink[]> {
  const db = tx ?? prisma
  return db.shareLink.findMany({
    where: {
      scope,
      ...(itemId ? { permission: { some: { itemId } } } : {}),
    },
  })
}

// ---------------------------------------------------------------------------
// Scope / type guard helpers
// ---------------------------------------------------------------------------

/**
 * Return `true` if the link is publicly accessible without authentication.
 *
 * Use this to gate whether a request needs a valid session before granting
 * access via the link.
 *
 * @param link - The ShareLink record to check.
 *
 * @example
 * if (!isPublicLink(link) && !session) throw redirect('/auth/sign-in')
 */
export function isPublicLink(link: ShareLink): boolean {
  return link.scope === 'anonymous'
}

/**
 * Return `true` if the link grants write (edit or upload) access.
 *
 * @param link - The ShareLink record to check.
 *
 * @example
 * if (isWriteLink(link)) await assertWorkspaceMembership(userId, workspaceId)
 */
export function isWriteLink(link: ShareLink): boolean {
  return link.type === 'edit' || link.type === 'upload'
}

// ---------------------------------------------------------------------------
// Mutation helpers
// ---------------------------------------------------------------------------

/**
 * Change the scope of an existing ShareLink.
 *
 * For example, downgrade a public (`anonymous`) link to `users`-only after
 * a workspace policy change.
 *
 * @param id    - The ID of the share link to update.
 * @param scope - The new scope.
 * @param tx    - Optional transaction client.
 *
 * @example
 * await updateShareLinkScope(linkId, 'organization')
 */
export function updateShareLinkScope(
  id: string,
  scope: ShareScope,
  tx?: PrismaTx
): Promise<ShareLink> {
  return updateShareLink({ where: { id }, data: { scope } }, tx)
}

/**
 * Change the type of an existing ShareLink.
 *
 * For example, downgrade an `edit` link to `view` to revoke write access
 * without invalidating the URL.
 *
 * Atomically updates the ShareLink type and syncs the associated Permission
 * role so the two are never out of step:
 *   view | embed  →  roles: 'read'
 *   edit | upload →  roles: 'write'
 *
 * @param id   - The ID of the share link to update.
 * @param type - The new link type.
 *
 * @example
 * // Downgrade to read-only — type AND permission role are updated together:
 * await updateShareLinkType(linkId, 'view')
 */
export async function updateShareLinkType(
  id: string,
  type: ShareLinkType
): Promise<ShareLink> {
  const role = type === 'edit' || type === 'upload' ? 'write' : 'read'
  const [link] = await prisma.$transaction([
    prisma.shareLink.update({ where: { id }, data: { type } }),
    prisma.permission.updateMany({
      where: { linkId: id },
      data: { roles: role },
    }),
  ])
  return link
}
