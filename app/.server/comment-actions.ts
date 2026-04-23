import { prisma } from '@/services/db'
import { StashlyError, StashlyErrorCode } from '@/services/api.errors'
import { getPrefixForModel, toObjectId } from '@/utils/converters'

/**
 * List all comments for a given item, ordered by creation time ascending.
 */
export async function listComments(itemId: string) {
  return prisma.comment.findMany({
    where: { itemId },
    orderBy: { createdAt: 'asc' },
  })
}

/**
 * Create a new comment on an item.
 */
export async function createComment({
  content,
  itemId,
  ownerId,
}: {
  content: string
  itemId: string
  ownerId: string
}) {
  return prisma.comment.create({
    data: {
      id: toObjectId(getPrefixForModel('Comment')),
      content,
      item: { connect: { id: itemId } },
      owner: { connect: { id: ownerId } },
    },
  })
}

/**
 * Update the content of a comment. Only the comment owner may update it.
 */
export async function updateComment({
  commentId,
  content,
  ownerId,
}: {
  commentId: string
  content: string
  ownerId: string
}) {
  const comment = await prisma.comment.findUnique({ where: { id: commentId } })
  if (!comment) {
    throw new StashlyError(StashlyErrorCode.NOT_FOUND, 'Comment not found')
  }
  if (comment.ownerId !== ownerId) {
    throw new StashlyError(
      StashlyErrorCode.FORBIDDEN,
      'You do not have permission to update this comment'
    )
  }
  return prisma.comment.update({
    where: { id: commentId },
    data: { content },
  })
}

/**
 * Delete a comment. Only the comment owner may delete it.
 */
export async function deleteComment({
  commentId,
  ownerId,
}: {
  commentId: string
  ownerId: string
}) {
  const comment = await prisma.comment.findUnique({ where: { id: commentId } })
  if (!comment) {
    throw new StashlyError(StashlyErrorCode.NOT_FOUND, 'Comment not found')
  }
  if (comment.ownerId !== ownerId) {
    throw new StashlyError(
      StashlyErrorCode.FORBIDDEN,
      'You do not have permission to delete this comment'
    )
  }
  return prisma.comment.delete({ where: { id: commentId } })
}
