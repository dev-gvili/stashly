import { prisma } from '@/services/db'
import { StashlyError, StashlyErrorCode } from '@/services/api.errors'
import { getPrefixForModel, toObjectId } from '@/utils/converters'
import { hasItemPermission } from '@/services/permission-actions'
import type { Invitation, Prisma, InvitationStatus } from '@/prisma/client'
import type { WorkspaceMemberRole, PermissionRole } from '@/prisma/enums'

type PrismaTx = Omit<
  typeof prisma,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type InvitationWithDetails = Invitation & {
  sender: { id: string; name: string; email: string; image: string | null }
  permission: {
    id: string
    roles: PermissionRole
    item: { id: string; name: string } | null
  } | null
  workspace: { id: string; name: string } | null
}

type SendItemInvitationOptions = {
  expiresAt?: Date
}

type SendWorkspaceInvitationOptions = {
  expiresAt?: Date
}

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
    include: {
      sender: { select: { id: true, name: true, email: true, image: true } },
      permission: {
        select: {
          id: true,
          roles: true,
          item: { select: { id: true, name: true } },
        },
      },
      workspace: { select: { id: true, name: true } },
    },
  }) as Promise<InvitationWithDetails | null>
}

export function listSentInvitations(senderId: string): Promise<InvitationWithDetails[]> {
  return prisma.invitation.findMany({
    where: { senderId },
    include: {
      sender: { select: { id: true, name: true, email: true, image: true } },
      permission: {
        select: {
          id: true,
          roles: true,
          item: { select: { id: true, name: true } },
        },
      },
      workspace: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  }) as Promise<InvitationWithDetails[]>
}

export function listReceivedInvitations(email: string): Promise<InvitationWithDetails[]> {
  return prisma.invitation.findMany({
    where: { email, status: 'pending' },
    include: {
      sender: { select: { id: true, name: true, email: true, image: true } },
      permission: {
        select: {
          id: true,
          roles: true,
          item: { select: { id: true, name: true } },
        },
      },
      workspace: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  }) as Promise<InvitationWithDetails[]>
}

export function listItemInvitations(
  itemId: string
): Promise<InvitationWithDetails[]> {
  return prisma.invitation.findMany({
    where: {
      permission: { is: { itemId } },
    },
    include: {
      sender: { select: { id: true, name: true, email: true, image: true } },
      permission: {
        select: {
          id: true,
          roles: true,
          item: { select: { id: true, name: true } },
        },
      },
      workspace: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  }) as Promise<InvitationWithDetails[]>
}

// ---------------------------------------------------------------------------
// Send
// ---------------------------------------------------------------------------

/**
 * Send a direct invitation to access an item.
 *
 * Creates an Invitation + Permission atomically. The Permission is linked to
 * the invitation via `invitationId`. Access is only granted once the recipient
 * calls `acceptInvitation`.
 *
 * @throws {StashlyError} NOT_FOUND if the item doesn't exist.
 * @throws {StashlyError} FORBIDDEN if the sender lacks write access on the item.
 * @throws {StashlyError} CONFLICT if a pending invitation for this email+item already exists.
 */
export async function sendItemInvitation(
  senderId: string,
  itemId: string,
  email: string,
  role: PermissionRole,
  options: SendItemInvitationOptions = {}
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

  // Check for existing pending invitation for this email+item
  const existing = await prisma.invitation.findFirst({
    where: {
      email,
      status: 'pending',
      permission: { is: { itemId } },
    },
  })
  if (existing) {
    throw new StashlyError(StashlyErrorCode.CONFLICT, 'A pending invitation for this email already exists')
  }

  return prisma.$transaction(async (tx) => {
    const invitationId = toObjectId(getPrefixForModel('Invitation'))
    const permissionId = toObjectId(getPrefixForModel('Permission'))

    await tx.invitation.create({
      data: {
        id: invitationId,
        email,
        senderId,
        status: 'pending',
        expiresAt: options.expiresAt ?? null,
      },
    })

    await tx.permission.create({
      data: {
        id: permissionId,
        roles: role,
        invitationId,
        itemId,
        expiresAt: options.expiresAt ?? null,
      },
    })

    return findInvitationById(invitationId, tx) as Promise<InvitationWithDetails>
  })
}

/**
 * Send a workspace membership invitation by email.
 *
 * @throws {StashlyError} NOT_FOUND if the workspace doesn't exist.
 * @throws {StashlyError} FORBIDDEN if the sender is not a workspace admin/owner.
 * @throws {StashlyError} CONFLICT if the email is already a member or has a pending invite.
 */
export async function sendWorkspaceInvitation(
  senderId: string,
  workspaceId: string,
  email: string,
  role: WorkspaceMemberRole,
  options: SendWorkspaceInvitationOptions = {}
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

  // Check if email user is already a member
  const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  if (existingUser) {
    const alreadyMember = await prisma.workspaceMember.findUnique({
      where: { memberId_workspaceId: { memberId: existingUser.id, workspaceId } },
    })
    if (alreadyMember) {
      throw new StashlyError(StashlyErrorCode.CONFLICT, 'This user is already a workspace member')
    }
  }

  // Check for existing pending invitation
  const existing = await prisma.invitation.findFirst({
    where: { email, workspaceId, status: 'pending' },
  })
  if (existing) {
    throw new StashlyError(StashlyErrorCode.CONFLICT, 'A pending invitation for this email already exists')
  }

  const invitationId = toObjectId(getPrefixForModel('Invitation'))
  await prisma.invitation.create({
    data: {
      id: invitationId,
      email,
      senderId,
      status: 'pending',
      workspaceId,
      role,
      expiresAt: options.expiresAt ?? null,
    },
  })

  return findInvitationById(invitationId) as Promise<InvitationWithDetails>
}

// ---------------------------------------------------------------------------
// Lifecycle mutations
// ---------------------------------------------------------------------------

/**
 * Accept an invitation.
 *
 * For item invitations: connects the accepting user to the Permission record,
 * making the item accessible.
 * For workspace invitations: creates a WorkspaceMember record.
 *
 * @throws {StashlyError} NOT_FOUND if the invitation doesn't exist.
 * @throws {StashlyError} FORBIDDEN if the user's email doesn't match the invitation.
 * @throws {StashlyError} GONE if the invitation is not in pending state.
 */
export async function acceptInvitation(
  invitationId: string,
  userId: string,
  userEmail: string
): Promise<InvitationWithDetails> {
  const invitation = await findInvitationById(invitationId)
  if (!invitation) {
    throw new StashlyError(StashlyErrorCode.NOT_FOUND, 'Invitation not found')
  }
  if (invitation.email !== userEmail) {
    throw new StashlyError(StashlyErrorCode.FORBIDDEN, 'This invitation was not sent to you')
  }
  if (invitation.status !== 'pending') {
    throw new StashlyError(StashlyErrorCode.GONE, `Invitation is already ${invitation.status}`)
  }
  if (invitation.expiresAt && invitation.expiresAt < new Date()) {
    await prisma.invitation.update({ where: { id: invitationId }, data: { status: 'expired' } })
    throw new StashlyError(StashlyErrorCode.GONE, 'Invitation has expired')
  }

  return prisma.$transaction(async (tx) => {
    // Item invitation: connect user to the permission
    if (invitation.permission) {
      await tx.permission.update({
        where: { id: invitation.permission.id },
        data: { users: { connect: { id: userId } } },
      })
    }

    // Workspace invitation: add as member
    if (invitation.workspaceId && invitation.role) {
      await tx.workspaceMember.create({
        data: {
          id: toObjectId(getPrefixForModel('WorkspaceMember')),
          memberId: userId,
          workspaceId: invitation.workspaceId,
          role: invitation.role,
        },
      })
    }

    await tx.invitation.update({ where: { id: invitationId }, data: { status: 'accepted' } })

    return findInvitationById(invitationId, tx) as Promise<InvitationWithDetails>
  })
}

/**
 * Reject a pending invitation.
 *
 * @throws {StashlyError} NOT_FOUND if the invitation doesn't exist.
 * @throws {StashlyError} FORBIDDEN if the user's email doesn't match.
 * @throws {StashlyError} GONE if already resolved.
 */
export async function rejectInvitation(
  invitationId: string,
  userId: string,
  userEmail: string
): Promise<InvitationWithDetails> {
  const invitation = await findInvitationById(invitationId)
  if (!invitation) {
    throw new StashlyError(StashlyErrorCode.NOT_FOUND, 'Invitation not found')
  }
  if (invitation.email !== userEmail) {
    throw new StashlyError(StashlyErrorCode.FORBIDDEN, 'This invitation was not sent to you')
  }
  if (invitation.status !== 'pending') {
    throw new StashlyError(StashlyErrorCode.GONE, `Invitation is already ${invitation.status}`)
  }

  await prisma.invitation.update({ where: { id: invitationId }, data: { status: 'rejected' } })
  return findInvitationById(invitationId) as Promise<InvitationWithDetails>
}

/**
 * Cancel an invitation (sender only).
 *
 * Also soft-deletes the associated Permission record so the item is not
 * accidentally accessible if the invitation is re-activated somehow.
 *
 * @throws {StashlyError} NOT_FOUND if the invitation doesn't exist.
 * @throws {StashlyError} FORBIDDEN if the caller is not the sender.
 * @throws {StashlyError} GONE if already resolved.
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
  if (invitation.status !== 'pending') {
    throw new StashlyError(StashlyErrorCode.GONE, `Invitation is already ${invitation.status}`)
  }

  return prisma.$transaction(async (tx) => {
    // Mark associated permission as deleted so it no longer grants access
    if (invitation.permission) {
      await tx.permission.update({
        where: { id: invitation.permission.id },
        data: { deletedAt: new Date() },
      })
    }

    await tx.invitation.update({ where: { id: invitationId }, data: { status: 'canceled' } })

    return findInvitationById(invitationId, tx) as Promise<InvitationWithDetails>
  })
}
