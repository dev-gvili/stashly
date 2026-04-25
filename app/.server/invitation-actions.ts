import { prisma } from '@/services/db'
import { StashlyError, StashlyErrorCode } from '@/services/api.errors'
import { getPrefixForModel, toObjectId } from '@/utils/converters'
import { hasItemPermission } from '@/services/permission-actions'
import type { Invitation, Prisma } from '@/prisma/client'
import type { WorkspaceMemberRole, PermissionRole } from '@/prisma/enums'
import { buildInvitationFilters } from '@/utils/filters/invitation.filters'
import { searchFactory } from '@/utils/search'

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
  defaultOrderBy: (): Prisma.InvitationOrderByWithRelationInput => ({ createdAt: 'desc' }),
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
  } | null
}

export type InvitationWithDetails = Invitation & {
  sender: { id: string; name: string; email: string; image: string | null }
  recipients: RecipientWithPermission[]
  item: { id: string; name: string } | null
  workspace: { id: string; name: string } | null
}

type RecipientInput = {
  email: string
  role: string
}

type SendInvitationOptions = {
  expiresAt?: Date
}

// ---------------------------------------------------------------------------
// Shared include for consistent query shape
// ---------------------------------------------------------------------------

const invitationInclude = {
  sender: { select: { id: true, name: true, email: true, image: true } },
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
          item: { select: { id: true, name: true } },
        },
      },
    },
  },
  item: { select: { id: true, name: true } },
  workspace: { select: { id: true, name: true } },
} satisfies Prisma.InvitationInclude

// ---------------------------------------------------------------------------
// Finders
// ---------------------------------------------------------------------------

export function findInvitationById(
  id: string,
  tx?: PrismaTx
): Promise<InvitationWithDetails | null> {
  const db = tx ?? prisma
  return db.invitation.findUnique({
    where: { id },
    include: invitationInclude,
  }) as Promise<InvitationWithDetails | null>
}

export function listSentInvitations(senderId: string): Promise<InvitationWithDetails[]> {
  return prisma.invitation.findMany({
    where: { senderId },
    include: invitationInclude,
    orderBy: { createdAt: 'desc' },
  }) as Promise<InvitationWithDetails[]>
}

export function listReceivedInvitations(email: string): Promise<InvitationWithDetails[]> {
  return prisma.invitation.findMany({
    where: {
      recipients: { some: { email, status: 'pending' } },
    },
    include: invitationInclude,
    orderBy: { createdAt: 'desc' },
  }) as Promise<InvitationWithDetails[]>
}

export function listItemInvitations(
  itemId: string
): Promise<InvitationWithDetails[]> {
  return prisma.invitation.findMany({
    where: { itemId },
    include: invitationInclude,
    orderBy: { createdAt: 'desc' },
  }) as Promise<InvitationWithDetails[]>
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
  const item = await prisma.item.findUnique({ where: { id: itemId }, select: { id: true, ownerId: true } })
  if (!item) {
    throw new StashlyError(StashlyErrorCode.NOT_FOUND, 'Item not found')
  }

  const isOwner = item.ownerId === senderId
  if (!isOwner) {
    const canWrite = await hasItemPermission(senderId, itemId, 'write')
    if (!canWrite) {
      throw new StashlyError(StashlyErrorCode.FORBIDDEN, 'You do not have permission to invite others to this item')
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
    throw new StashlyError(
      StashlyErrorCode.CONFLICT,
      `A pending invitation for ${existing.email} already exists`
    )
  }

  return prisma.$transaction(async (tx) => {
    const invitationId = toObjectId(getPrefixForModel('Invitation'))

    await tx.invitation.create({
      data: {
        id: invitationId,
        senderId,
        itemId,
        expiresAt: options.expiresAt ?? null,
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

    return findInvitationById(invitationId, tx) as Promise<InvitationWithDetails>
  })
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
    throw new StashlyError(StashlyErrorCode.NOT_FOUND, 'Workspace not found')
  }

  const senderMembership = workspace.members[0]
  const isAdmin = senderMembership?.role === 'admin' || senderMembership?.role === 'owner'
  if (!isAdmin) {
    throw new StashlyError(StashlyErrorCode.FORBIDDEN, 'Only workspace admins can send invitations')
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
      throw new StashlyError(
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
    throw new StashlyError(
      StashlyErrorCode.CONFLICT,
      `A pending invitation for ${existingInvite.email} already exists`
    )
  }

  return prisma.$transaction(async (tx) => {
    const invitationId = toObjectId(getPrefixForModel('Invitation'))

    await tx.invitation.create({
      data: {
        id: invitationId,
        senderId,
        workspaceId,
        expiresAt: options.expiresAt ?? null,
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

    return findInvitationById(invitationId, tx) as Promise<InvitationWithDetails>
  })
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
    throw new StashlyError(StashlyErrorCode.NOT_FOUND, 'Invitation recipient not found')
  }
  if (recipient.email !== userEmail) {
    throw new StashlyError(StashlyErrorCode.FORBIDDEN, 'This invitation was not sent to you')
  }
  if (recipient.status !== 'pending') {
    throw new StashlyError(StashlyErrorCode.GONE, `Invitation is already ${recipient.status}`)
  }

  const invitation = recipient.invitation
  if (invitation.expiresAt && invitation.expiresAt < new Date()) {
    await prisma.invitationRecipient.update({
      where: { id: recipientId },
      data: { status: 'expired' },
    })
    throw new StashlyError(StashlyErrorCode.GONE, 'Invitation has expired')
  }

  return prisma.$transaction(async (tx) => {
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

    return findInvitationById(invitation.id, tx) as Promise<InvitationWithDetails>
  })
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
    throw new StashlyError(StashlyErrorCode.NOT_FOUND, 'Invitation recipient not found')
  }
  if (recipient.email !== userEmail) {
    throw new StashlyError(StashlyErrorCode.FORBIDDEN, 'This invitation was not sent to you')
  }
  if (recipient.status !== 'pending') {
    throw new StashlyError(StashlyErrorCode.GONE, `Invitation is already ${recipient.status}`)
  }

  await prisma.invitationRecipient.update({
    where: { id: recipientId },
    data: { status: 'rejected' },
  })
  return findInvitationById(recipient.invitationId) as Promise<InvitationWithDetails>
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
    throw new StashlyError(StashlyErrorCode.NOT_FOUND, 'Invitation not found')
  }
  if (invitation.senderId !== senderId) {
    throw new StashlyError(StashlyErrorCode.FORBIDDEN, 'Only the sender can cancel an invitation')
  }

  const pendingRecipients = invitation.recipients.filter((r) => r.status === 'pending')
  if (pendingRecipients.length === 0) {
    throw new StashlyError(StashlyErrorCode.GONE, 'No pending recipients to cancel')
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

    return findInvitationById(invitationId, tx) as Promise<InvitationWithDetails>
  })
}
