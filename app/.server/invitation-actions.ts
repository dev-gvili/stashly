import type {
  StashItemPdf,
  StashItemVideo,
  StashItemMarkdown,
  StashItemAudio,
  StashItemImage,
} from '@/types/stash.types'
import { StashlyError, StashlyErrorCode, toRouteError } from '@/utils/api.errors'
import {
  getPrefixForModel,
  toCategory,
  toObjectId,
  type IconKey,
} from '@/utils/converters'
import { formatSize } from '@/utils/formaters'
import { hasItemPermission } from '@/services/permission-actions'
import type { Invitation, Prisma } from '@/prisma/client'
import type {
  WorkspaceMemberRole,
  PermissionRole,
  ItemType,
} from '@/prisma/enums'
import { buildInvitationFilters } from '@/utils/filters/invitation.filters'
import { searchFactory } from '@/utils/search'
import type { Folder, ItemCategory } from '@/prisma/browser'
import { prisma } from '@/services/db'
import { createNotification } from './notification-actions'
import { signThumbnails } from './thumbnail-actions'

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/**
 * Paginated, filterable search over Invitation records.
 *
 * @example
 * const page = await searchInvitations({ senderId: 'user_123', take: 20, strategy: 'cursor' })
 */
export const searchInvitations = searchFactory({
  dbDelegate: prisma.invitation,
  buildFilters: buildInvitationFilters,
  defaultOrderBy: (): Prisma.InvitationOrderByWithRelationInput => ({
    createdAt: 'desc',
  }),
})

type PrismaTx = Omit<
  typeof prisma,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RecipientWithPermission = {
  id: string
  email: string
  status: 'pending' | 'accepted' | 'rejected' | 'canceled' | 'expired'
  role: string
  permission: {
    id: string
    roles: PermissionRole
    item: { id: string; name: string } | null
    users: {
      id: string
      name: string
      image: string | null
      displayName: string | null
    }[]
  } | null
}

/**
 * A thumbnail-backed peek at a shared folder/workspace's contents. Matches
 * the client's `StashPickerItem` shape so the detail panel can render each
 * entry through the standard `ItemCard`.
 */
export type InvitationPreview = {
  id: string
  name: string
  type: ItemType
  category: ItemCategory
  size: bigint
  createdAt: Date
  thumbnailUrl?: string | null
}

/**
 * Enriched invitation shape returned by the finders and mutation helpers.
 * Extends the raw record with presentation-only fields the detail panel
 * surfaces: a personal `message`, the sender's `title`, single-item meta
 * (`mimeType` / `fileCount` / `thumbnailUrl`), workspace roll-ups
 * (`size` / `fileCount` / `memberCount`), and thumbnail `previews`.
 */
export type InvitationWithDetails = Invitation & {
  message: string | null
  sender: {
    id: string
    name: string
    email: string
    image: string | null
    title: string | null
  }
  recipients: RecipientWithPermission[]
  previews: InvitationPreview[]
  item: {
    id: string
    name: string
    type: ItemType
    size: bigint
    category: ItemCategory
    file: File | null
    folder: Folder | null
    image: StashItemImage | null
    audio: StashItemAudio | null
    video: StashItemVideo | null
    pdf: StashItemPdf | null
    markdown: StashItemMarkdown | null
    mimeType: string | null
    fileCount: number | null
    thumbnailUrl: string | null
  } | null
  workspace: {
    id: string
    name: string
    members: {
      id: string
      role: WorkspaceMemberRole
      member: { id: string; name: string; image: string | null }
    }[]
    size: string | null
    fileCount: number | null
    memberCount: number | null
  } | null
}

type RecipientInput = {
  email: string
  role: string
}

type SendInvitationOptions = {
  expiresAt?: Date
  message?: string
}

// ---------------------------------------------------------------------------
// Shared include for consistent query shape
// ---------------------------------------------------------------------------

const invitationInclude = {
  sender: {
    select: { id: true, name: true, email: true, image: true, title: true },
  },
  recipients: {
    select: {
      id: true,
      email: true,
      status: true,
      role: true,
      permission: {
        select: {
          id: true,
          roles: true,
          users: {
            select: {
              id: true,
              name: true,
              image: true,
              displayName: true,
              email: true,
            },
          },
          item: { select: { id: true, name: true } },
        },
      },
    },
  },
  item: {
    select: {
      id: true,
      name: true,
      type: true,
      size: true,
      category: true,
      file: true,
      folder: true,
      image: true,
      audio: true,
      video: true,
      pdf: true,
      markdown: true,
      // Real generated thumbnail for the shared item's hero preview.
      thumbnails: { select: { url: true } },
      // Number of children — surfaced as `fileCount` for shared folders.
      _count: { select: { children: true } },
      // Thumbnail-backed peek at a shared folder's contents.
      children: {
        take: 6,
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          type: true,
          category: true,
          size: true,
          createdAt: true,
          thumbnails: { select: { url: true } },
        },
      },
    },
  },
  workspace: {
    select: {
      id: true,
      name: true,
      // Powers the People section of the invitation details panel — lets a
      // recipient see who they'd be collaborating with before accepting.
      members: {
        select: {
          id: true,
          role: true,
          member: { select: { id: true, name: true, image: true } },
        },
      },
      // Total item + member counts, surfaced as `fileCount` / `memberCount`.
      _count: { select: { items: true, members: true } },
      // Thumbnail-backed peek at the workspace's contents.
      items: {
        take: 6,
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          type: true,
          category: true,
          size: true,
          createdAt: true,
          thumbnails: { select: { url: true } },
        },
      },
    },
  },
} satisfies Prisma.InvitationInclude

/** Raw query result before presentation-only enrichment. */
type InvitationRaw = Prisma.InvitationGetPayload<{
  include: typeof invitationInclude
}>

type PreviewChild = {
  id: string
  name: string
  type: ItemType
  category: ItemCategory
  size: bigint
  createdAt: Date
  thumbnails: { url: string | null }[]
}

// ---------------------------------------------------------------------------
// Enrichment — derive the presentation-only fields the detail panel surfaces
// ---------------------------------------------------------------------------

/** First real (non-placeholder) thumbnail URL, or null. */
function pickThumbnailUrl(
  thumbnails: { url: string | null }[] | null | undefined
): string | null {
  if (!thumbnails) return null
  return thumbnails.find((t) => t.url && !t.url.startsWith('#'))?.url ?? null
}

function toPreview(child: PreviewChild): InvitationPreview {
  return {
    id: child.id,
    name: child.name,
    type: child.type,
    category: child.category,
    size: child.size,
    createdAt: child.createdAt,
    thumbnailUrl: pickThumbnailUrl(child.thumbnails),
  }
}

/**
 * Sum the storage size of every item in each workspace, returned as a map of
 * workspaceId → formatted size string. One `groupBy` covers all workspaces.
 */
async function computeWorkspaceSizes(
  db: PrismaTx | typeof prisma,
  workspaceIds: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  if (!workspaceIds.length) return map
  const rows = await db.item.groupBy({
    by: ['workspaceId'],
    where: { workspaceId: { in: workspaceIds } },
    _sum: { size: true },
  })
  for (const row of rows) {
    if (row.workspaceId) {
      map.set(row.workspaceId, formatSize('byte', 'unit', row._sum.size ?? 0n))
    }
  }
  return map
}

/** Map a raw invitation record into the enriched detail shape. */
function enrichInvitation(
  inv: InvitationRaw,
  workspaceSize: string | null
): InvitationWithDetails {
  const previews: InvitationPreview[] = inv.workspace
    ? inv.workspace.items.map(toPreview)
    : inv.item?.type === 'folder'
      ? inv.item.children.map(toPreview)
      : []

  let item: InvitationWithDetails['item'] = null
  if (inv.item) {
    const { children, _count, thumbnails, ...rest } = inv.item
    item = {
      ...rest,
      mimeType: inv.item.file?.mimeType ?? null,
      fileCount: inv.item.type === 'folder' ? _count.children : null,
      thumbnailUrl: pickThumbnailUrl(thumbnails),
    } as InvitationWithDetails['item']
  }

  let workspace: InvitationWithDetails['workspace'] = null
  if (inv.workspace) {
    const { items, _count, ...rest } = inv.workspace
    workspace = {
      ...rest,
      size: workspaceSize,
      fileCount: _count.items,
      memberCount: _count.members,
    }
  }

  return {
    ...inv,
    previews,
    item,
    workspace,
  } as InvitationWithDetails
}

/** Enrich a list of invitations, batching workspace-size aggregation. */
async function enrichInvitations(
  db: PrismaTx | typeof prisma,
  invitations: InvitationRaw[]
): Promise<InvitationWithDetails[]> {
  const workspaceIds = [
    ...new Set(
      invitations.flatMap((inv) => (inv.workspace ? [inv.workspace.id] : []))
    ),
  ]
  const sizes = await computeWorkspaceSizes(db, workspaceIds)
  // Signed before enrichment, so `pickThumbnailUrl` selects an already-signed
  // value and stays synchronous. The walk reaches the item, its children and
  // the workspace's items in one pass.
  const signed = await signThumbnails(invitations)
  return signed.map((inv) =>
    enrichInvitation(
      inv,
      inv.workspace ? (sizes.get(inv.workspace.id) ?? null) : null
    )
  )
}

// ---------------------------------------------------------------------------
// Finders
// ---------------------------------------------------------------------------

export async function findInvitationById(
  id: string,
  tx?: PrismaTx
): Promise<InvitationWithDetails | null> {
  const db = tx ?? prisma
  const inv = await db.invitation.findUnique({
    where: { id },
    include: invitationInclude,
  })
  if (!inv) return null
  const sizes = inv.workspace
    ? await computeWorkspaceSizes(db, [inv.workspace.id])
    : null
  return enrichInvitation(
    await signThumbnails(inv),
    inv.workspace ? (sizes?.get(inv.workspace.id) ?? null) : null
  )
}

export async function listSentInvitations(
  senderId: string
): Promise<InvitationWithDetails[]> {
  const invitations = await prisma.invitation.findMany({
    where: { senderId },
    include: invitationInclude,
    orderBy: { createdAt: 'desc' },
  })
  return enrichInvitations(prisma, invitations)
}

export async function listReceivedInvitations(
  email: string
): Promise<InvitationWithDetails[]> {
  // Includes resolved (accepted/rejected) invitations so the invitations
  // view can show history and offer undo — not just pending ones.
  const invitations = await prisma.invitation.findMany({
    where: {
      recipients: { some: { email, status: { not: 'canceled' } } },
    },
    include: invitationInclude,
    orderBy: { createdAt: 'desc' },
  })
  return enrichInvitations(prisma, invitations)
}

export async function listItemInvitations(
  itemId: string
): Promise<InvitationWithDetails[]> {
  const invitations = await prisma.invitation.findMany({
    where: { itemId },
    include: invitationInclude,
    orderBy: { createdAt: 'desc' },
  })
  return enrichInvitations(prisma, invitations)
}

/**
 * A thing the current user can start a new invitation for — an owned
 * file/folder or a workspace they can invite to. Powers the target picker in
 * `NewInvitationDialog`.
 */
export type ShareTargetData = {
  id: string
  type: 'item' | 'workspace'
  name: string
  kind: IconKey
  /** Short parent trail (e.g. "Home / docs") to disambiguate same-named items. */
  path: string | null
}

/** Display name for a path segment — the root folder reads as "Home". */
function toPathSegment(name: string): string {
  return name === 'root' ? 'Home' : name
}

/**
 * Builds a short "grandparent / parent" trail from the 2-level parent chain
 * selected in `listShareTargets`, prefixing "… /" when the tree goes deeper.
 */
function buildTargetPath(
  parent: {
    name: string
    parentId: string | null
    parent: { name: string; parentId: string | null } | null
  } | null
): string | null {
  if (!parent) return null
  const segments: string[] = []
  let truncated = false
  if (parent.parent) {
    truncated = parent.parent.parentId !== null
    segments.push(toPathSegment(parent.parent.name))
  }
  segments.push(toPathSegment(parent.name))
  return `${truncated ? '… / ' : ''}${segments.join(' / ')}`
}

/**
 * List the shareable targets for a user: workspaces they administer plus their
 * most-recently-touched files and folders.
 */
export async function listShareTargets(
  userId: string
): Promise<ShareTargetData[]> {
  const [workspaces, items] = await Promise.all([
    prisma.workspaceMember.findMany({
      where: { memberId: userId, role: { in: ['admin', 'owner'] } },
      select: { workspace: { select: { id: true, name: true } } },
      orderBy: { workspace: { name: 'asc' } },
    }),
    prisma.item.findMany({
      where: {
        ownerId: userId,
        type: { in: ['file', 'folder'] },
        status: 'normal',
      },
      select: {
        id: true,
        name: true,
        type: true,
        category: true,
        // MIME type feeds toCategory so the picker shows "PDF" / "Image" /
        // "Code" instead of a generic "File" label.
        file: { select: { mimeType: true } },
        // 2-level parent chain for the disambiguating path line.
        parent: {
          select: {
            name: true,
            parentId: true,
            parent: { select: { name: true, parentId: true } },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 25,
    }),
  ])

  const workspaceTargets: ShareTargetData[] = workspaces.map((w) => ({
    id: w.workspace.id,
    type: 'workspace',
    name: w.workspace.name,
    kind: 'workspace',
    path: null,
  }))

  const itemTargets: ShareTargetData[] = items.map((i) => ({
    id: i.id,
    type: 'item',
    name: i.name,
    kind: i.type === 'folder' ? 'folder' : i.category,
    path: buildTargetPath(i.parent),
  }))

  return [...workspaceTargets, ...itemTargets]
}

// ---------------------------------------------------------------------------
// Send
// ---------------------------------------------------------------------------

/**
 * Send invitations to multiple recipients to access an item.
 *
 * Creates one Invitation with N InvitationRecipient records + N Permission
 * records atomically. Access is only granted once a recipient calls
 * `acceptInvitation`.
 *
 * @throws {StashlyError} NOT_FOUND if the item doesn't exist.
 * @throws {StashlyError} FORBIDDEN if the sender lacks write access on the item.
 * @throws {StashlyError} CONFLICT if a pending invitation for any email+item already exists.
 */
export async function sendItemInvitation(
  senderId: string,
  itemId: string,
  recipients: RecipientInput[],
  options: SendInvitationOptions = {}
): Promise<InvitationWithDetails> {
  const item = await prisma.item.findUnique({
    where: { id: itemId },
    select: { id: true, ownerId: true },
  })
  if (!item) {
    throw toRouteError(StashlyErrorCode.NOT_FOUND, 'Item not found')
  }

  const isOwner = item.ownerId === senderId
  if (!isOwner) {
    const canWrite = await hasItemPermission(senderId, itemId, 'write')
    if (!canWrite) {
      throw toRouteError(
        StashlyErrorCode.FORBIDDEN,
        'You do not have permission to invite others to this item'
      )
    }
  }

  // Check for existing pending invitations for any of these emails+item
  const emails = recipients.map((r) => r.email)
  const existing = await prisma.invitationRecipient.findFirst({
    where: {
      email: { in: emails },
      status: 'pending',
      invitation: { itemId },
    },
  })
  if (existing) {
    throw toRouteError(
      StashlyErrorCode.CONFLICT,
      `A pending invitation for ${existing.email} already exists`
    )
  }

  const invitation = await prisma.$transaction(async (tx) => {
    const invitationId = toObjectId(getPrefixForModel('Invitation'))

    await tx.invitation.create({
      data: {
        id: invitationId,
        senderId,
        itemId,
        expiresAt: options.expiresAt ?? null,
        message: options.message?.trim() || null,
      },
    })

    for (const recipient of recipients) {
      const recipientId = toObjectId(getPrefixForModel('InvitationRecipient'))
      const permissionId = toObjectId(getPrefixForModel('Permission'))

      await tx.invitationRecipient.create({
        data: {
          id: recipientId,
          email: recipient.email,
          role: recipient.role,
          invitationId,
          status: 'pending',
        },
      })

      await tx.permission.create({
        data: {
          id: permissionId,
          roles: recipient.role as PermissionRole,
          recipientId,
          itemId,
          expiresAt: options.expiresAt ?? null,
        },
      })
    }

    return findInvitationById(
      invitationId,
      tx
    ) as Promise<InvitationWithDetails>
  })

  await notifyInvitationSent(invitation, recipients)
  return invitation
}

/**
 * Send workspace membership invitations to multiple recipients by email.
 *
 * @throws {StashlyError} NOT_FOUND if the workspace doesn't exist.
 * @throws {StashlyError} FORBIDDEN if the sender is not a workspace admin/owner.
 * @throws {StashlyError} CONFLICT if any email is already a member or has a pending invite.
 */
export async function sendWorkspaceInvitation(
  senderId: string,
  workspaceId: string,
  recipients: RecipientInput[],
  options: SendInvitationOptions = {}
): Promise<InvitationWithDetails> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      members: { where: { memberId: senderId } },
    },
  })
  if (!workspace) {
    throw toRouteError(StashlyErrorCode.NOT_FOUND, 'Workspace not found')
  }

  const senderMembership = workspace.members[0]
  const isAdmin =
    senderMembership?.role === 'admin' || senderMembership?.role === 'owner'
  if (!isAdmin) {
    throw toRouteError(
      StashlyErrorCode.FORBIDDEN,
      'Only workspace admins can send invitations'
    )
  }

  const emails = recipients.map((r) => r.email)

  // Check if any email user is already a member
  const existingUsers = await prisma.user.findMany({
    where: { email: { in: emails } },
    select: { id: true, email: true },
  })
  if (existingUsers.length > 0) {
    const existingMembers = await prisma.workspaceMember.findMany({
      where: {
        workspaceId,
        memberId: { in: existingUsers.map((u) => u.id) },
      },
      select: { memberId: true },
    })
    if (existingMembers.length > 0) {
      const memberEmails = existingUsers
        .filter((u) => existingMembers.some((m) => m.memberId === u.id))
        .map((u) => u.email)
      throw toRouteError(
        StashlyErrorCode.CONFLICT,
        `Already workspace members: ${memberEmails.join(', ')}`
      )
    }
  }

  // Check for existing pending invitations
  const existingInvite = await prisma.invitationRecipient.findFirst({
    where: {
      email: { in: emails },
      status: 'pending',
      invitation: { workspaceId },
    },
  })
  if (existingInvite) {
    throw toRouteError(
      StashlyErrorCode.CONFLICT,
      `A pending invitation for ${existingInvite.email} already exists`
    )
  }

  const invitation = await prisma.$transaction(async (tx) => {
    const invitationId = toObjectId(getPrefixForModel('Invitation'))

    await tx.invitation.create({
      data: {
        id: invitationId,
        senderId,
        workspaceId,
        expiresAt: options.expiresAt ?? null,
        message: options.message?.trim() || null,
      },
    })

    for (const recipient of recipients) {
      const recipientId = toObjectId(getPrefixForModel('InvitationRecipient'))

      await tx.invitationRecipient.create({
        data: {
          id: recipientId,
          email: recipient.email,
          role: recipient.role,
          invitationId,
          status: 'pending',
        },
      })
    }

    return findInvitationById(
      invitationId,
      tx
    ) as Promise<InvitationWithDetails>
  })

  await notifyInvitationSent(invitation, recipients)
  return invitation
}

// ---------------------------------------------------------------------------
// Notification fan-out (best-effort)
//
// Runs AFTER the invitation transaction commits, using the shared `prisma`
// (not the tx client), so a notification hiccup can never roll back or fail the
// invitation itself. Inserting a Notification row also pushes it live to the
// recipient's bell via the DB NOTIFY → SSE stream — no extra plumbing needed.
//
// Recipients are addressed by email; only those that map to an existing user
// account get a notification (invitees without an account will see the pending
// invitation once they sign up).
// ---------------------------------------------------------------------------

async function notifyInvitationSent(
  invitation: InvitationWithDetails,
  recipients: RecipientInput[]
) {
  try {
    const emails = recipients.map((r) => r.email)
    const users = await prisma.user.findMany({
      where: { email: { in: emails } },
      select: { id: true },
    })
    if (users.length === 0) return

    const senderName = invitation.sender?.name || 'Someone'
    const isWorkspace = Boolean(invitation.workspace)
    const target =
      invitation.item?.name ?? invitation.workspace?.name ?? 'a resource'
    const message = isWorkspace
      ? `${senderName} invited you to the "${target}" workspace.`
      : `${senderName} shared "${target}" with you.`

    await Promise.all(
      users.map((u) =>
        createNotification({
          userId: u.id,
          message,
          type: 'info',
          kind: 'invitation',
        })
      )
    )
  } catch (err) {
    console.error(
      '[invitations] failed to create recipient notifications:',
      err
    )
  }
}

async function notifyInvitationAccepted(
  invitation: {
    senderId: string
    workspaceId: string | null
    item: { name: string } | null
    workspace: { name: string } | null
  },
  accepterUserId: string,
  accepterEmail: string
) {
  try {
    // Don't notify yourself if you somehow accept your own invite.
    if (invitation.senderId === accepterUserId) return

    const accepter = await prisma.user.findUnique({
      where: { id: accepterUserId },
      select: { name: true },
    })
    const accepterName = accepter?.name || accepterEmail
    const isWorkspace = Boolean(invitation.workspaceId)
    const target =
      invitation.item?.name ?? invitation.workspace?.name ?? 'your invitation'
    const message = isWorkspace
      ? `${accepterName} joined the "${target}" workspace.`
      : `${accepterName} accepted your invitation to "${target}".`

    await createNotification({
      userId: invitation.senderId,
      message,
      type: 'success',
      kind: isWorkspace ? 'member' : 'invitation',
    })
  } catch (err) {
    console.error(
      '[invitations] failed to notify sender of acceptance:',
      err
    )
  }
}

// ---------------------------------------------------------------------------
// Lifecycle mutations (per-recipient)
// ---------------------------------------------------------------------------

/**
 * Accept an invitation for a specific recipient.
 *
 * For item invitations: connects the accepting user to the Permission record.
 * For workspace invitations: creates a WorkspaceMember record.
 *
 * @throws {StashlyError} NOT_FOUND if the recipient doesn't exist.
 * @throws {StashlyError} FORBIDDEN if the user's email doesn't match the recipient.
 * @throws {StashlyError} GONE if the recipient is not in pending state or invitation expired.
 */
export async function acceptInvitation(
  recipientId: string,
  userId: string,
  userEmail: string
): Promise<InvitationWithDetails> {
  const recipient = await prisma.invitationRecipient.findUnique({
    where: { id: recipientId },
    include: {
      invitation: { include: invitationInclude },
      permission: true,
    },
  })
  if (!recipient) {
    throw toRouteError(
      StashlyErrorCode.NOT_FOUND,
      'Invitation recipient not found'
    )
  }
  if (recipient.email !== userEmail) {
    throw toRouteError(
      StashlyErrorCode.FORBIDDEN,
      'This invitation was not sent to you'
    )
  }
  if (recipient.status !== 'pending') {
    throw toRouteError(
      StashlyErrorCode.GONE,
      `Invitation is already ${recipient.status}`
    )
  }

  const invitation = recipient.invitation
  if (invitation.expiresAt && invitation.expiresAt < new Date()) {
    await prisma.invitationRecipient.update({
      where: { id: recipientId },
      data: { status: 'expired' },
    })
    throw toRouteError(StashlyErrorCode.GONE, 'Invitation has expired')
  }

  const result = await prisma.$transaction(async (tx) => {
    // Item invitation: connect user to the permission
    if (recipient.permission) {
      await tx.permission.update({
        where: { id: recipient.permission.id },
        data: { users: { connect: { id: userId } } },
      })
    }

    // Workspace invitation: add as member
    if (invitation.workspaceId) {
      await tx.workspaceMember.create({
        data: {
          id: toObjectId(getPrefixForModel('WorkspaceMember')),
          memberId: userId,
          workspaceId: invitation.workspaceId,
          role: recipient.role as WorkspaceMemberRole,
        },
      })
    }

    await tx.invitationRecipient.update({
      where: { id: recipientId },
      data: { status: 'accepted' },
    })

    return findInvitationById(
      invitation.id,
      tx
    ) as Promise<InvitationWithDetails>
  })

  await notifyInvitationAccepted(invitation, userId, userEmail)
  return result
}

/**
 * Reject a pending invitation for a specific recipient.
 *
 * @throws {StashlyError} NOT_FOUND if the recipient doesn't exist.
 * @throws {StashlyError} FORBIDDEN if the user's email doesn't match.
 * @throws {StashlyError} GONE if already resolved.
 */
export async function rejectInvitation(
  recipientId: string,
  userId: string,
  userEmail: string
): Promise<InvitationWithDetails> {
  const recipient = await prisma.invitationRecipient.findUnique({
    where: { id: recipientId },
    include: { invitation: true },
  })
  if (!recipient) {
    throw toRouteError(
      StashlyErrorCode.NOT_FOUND,
      'Invitation recipient not found'
    )
  }
  if (recipient.email !== userEmail) {
    throw toRouteError(
      StashlyErrorCode.FORBIDDEN,
      'This invitation was not sent to you'
    )
  }
  if (recipient.status !== 'pending') {
    throw toRouteError(
      StashlyErrorCode.GONE,
      `Invitation is already ${recipient.status}`
    )
  }

  await prisma.invitationRecipient.update({
    where: { id: recipientId },
    data: { status: 'rejected' },
  })
  return findInvitationById(
    recipient.invitationId
  ) as Promise<InvitationWithDetails>
}

/**
 * Undo an accepted or rejected response, returning the recipient to pending.
 *
 * If the invitation was accepted, revokes what acceptance granted: disconnects
 * the user from the item Permission, or removes the WorkspaceMember record.
 *
 * @throws {StashlyError} NOT_FOUND if the recipient doesn't exist.
 * @throws {StashlyError} FORBIDDEN if the user's email doesn't match.
 * @throws {StashlyError} GONE if the recipient is not accepted/rejected or the invitation expired.
 */
export async function undoInvitationResponse(
  recipientId: string,
  userId: string,
  userEmail: string
): Promise<InvitationWithDetails> {
  const recipient = await prisma.invitationRecipient.findUnique({
    where: { id: recipientId },
    include: { invitation: true, permission: true },
  })
  if (!recipient) {
    throw toRouteError(
      StashlyErrorCode.NOT_FOUND,
      'Invitation recipient not found'
    )
  }
  if (recipient.email !== userEmail) {
    throw toRouteError(
      StashlyErrorCode.FORBIDDEN,
      'This invitation was not sent to you'
    )
  }
  if (recipient.status !== 'accepted' && recipient.status !== 'rejected') {
    throw toRouteError(
      StashlyErrorCode.GONE,
      `Cannot undo a ${recipient.status} invitation`
    )
  }
  const invitation = recipient.invitation
  if (invitation.expiresAt && invitation.expiresAt < new Date()) {
    throw toRouteError(StashlyErrorCode.GONE, 'Invitation has expired')
  }

  return prisma.$transaction(async (tx) => {
    if (recipient.status === 'accepted') {
      if (recipient.permission) {
        await tx.permission.update({
          where: { id: recipient.permission.id },
          data: { users: { disconnect: { id: userId } } },
        })
      }
      if (invitation.workspaceId) {
        await tx.workspaceMember.deleteMany({
          where: { workspaceId: invitation.workspaceId, memberId: userId },
        })
      }
    }

    await tx.invitationRecipient.update({
      where: { id: recipientId },
      data: { status: 'pending' },
    })

    return findInvitationById(
      invitation.id,
      tx
    ) as Promise<InvitationWithDetails>
  })
}

/**
 * Cancel a single pending recipient of an invitation (sender only).
 *
 * Soft-deletes the associated Permission record for item invitations.
 *
 * @throws {StashlyError} NOT_FOUND if the recipient doesn't exist.
 * @throws {StashlyError} FORBIDDEN if the caller is not the sender.
 * @throws {StashlyError} GONE if the recipient is not pending.
 */
export async function cancelInvitationRecipient(
  recipientId: string,
  senderId: string
): Promise<InvitationWithDetails> {
  const recipient = await prisma.invitationRecipient.findUnique({
    where: { id: recipientId },
    include: { invitation: true, permission: true },
  })
  if (!recipient) {
    throw toRouteError(
      StashlyErrorCode.NOT_FOUND,
      'Invitation recipient not found'
    )
  }
  if (recipient.invitation.senderId !== senderId) {
    throw toRouteError(
      StashlyErrorCode.FORBIDDEN,
      'Only the sender can cancel an invitation'
    )
  }
  if (recipient.status !== 'pending') {
    throw toRouteError(
      StashlyErrorCode.GONE,
      `Invitation is already ${recipient.status}`
    )
  }

  return prisma.$transaction(async (tx) => {
    if (recipient.permission) {
      await tx.permission.update({
        where: { id: recipient.permission.id },
        data: { deletedAt: new Date() },
      })
    }

    await tx.invitationRecipient.update({
      where: { id: recipientId },
      data: { status: 'canceled' },
    })

    return findInvitationById(
      recipient.invitationId,
      tx
    ) as Promise<InvitationWithDetails>
  })
}

/**
 * Cancel an entire invitation (sender only).
 *
 * Cancels all pending recipients and soft-deletes their Permission records.
 *
 * @throws {StashlyError} NOT_FOUND if the invitation doesn't exist.
 * @throws {StashlyError} FORBIDDEN if the caller is not the sender.
 */
export async function cancelInvitation(
  invitationId: string,
  senderId: string
): Promise<InvitationWithDetails> {
  const invitation = await findInvitationById(invitationId)
  if (!invitation) {
    throw toRouteError(StashlyErrorCode.NOT_FOUND, 'Invitation not found')
  }
  if (invitation.senderId !== senderId) {
    throw toRouteError(
      StashlyErrorCode.FORBIDDEN,
      'Only the sender can cancel an invitation'
    )
  }

  const pendingRecipients = invitation.recipients.filter(
    (r) => r.status === 'pending'
  )
  if (pendingRecipients.length === 0) {
    throw toRouteError(
      StashlyErrorCode.GONE,
      'No pending recipients to cancel'
    )
  }

  return prisma.$transaction(async (tx) => {
    for (const recipient of pendingRecipients) {
      // Soft-delete associated permission
      if (recipient.permission) {
        await tx.permission.update({
          where: { id: recipient.permission.id },
          data: { deletedAt: new Date() },
        })
      }

      await tx.invitationRecipient.update({
        where: { id: recipient.id },
        data: { status: 'canceled' },
      })
    }

    return findInvitationById(
      invitationId,
      tx
    ) as Promise<InvitationWithDetails>
  })
}
