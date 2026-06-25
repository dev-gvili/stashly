import { prisma } from '@/services/db'
import { StashlyError, StashlyErrorCode } from '@/utils/api.errors'
import { getPrefixForModel, toObjectId } from '@/utils/converters'
import type { Prisma } from '@/prisma/client'
import { buildCommentFilters } from '@/utils/filters/comment.filters'
import { searchFactory } from '@/utils/search'
import { createActivity } from './activity-actions'

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/**
 * Paginated, filterable search over Comment records.
 *
 * @example
 * const page = await searchComments({ itemId: 'item_123', take: 20, strategy: 'cursor' })
 */
export const searchComments = searchFactory({
  dbDelegate: prisma.comment,
  buildFilters: buildCommentFilters,
  defaultOrderBy: (): Prisma.CommentOrderByWithRelationInput => ({ createdAt: 'desc' }),
})

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
  const comment = await prisma.comment.create({
    data: {
      id: toObjectId(getPrefixForModel('Comment')),
      content,
      item: { connect: { id: itemId } },
      owner: { connect: { id: ownerId } },
    },
  })
  createActivity({
    item: { connect: { id: itemId } },
    time: { create: { id: toObjectId(getPrefixForModel('ActivityTime')), observedAt: new Date() } },
    action: {
      create: {
        id: toObjectId(getPrefixForModel('ItemAction')),
        comment: { create: { id: toObjectId(getPrefixForModel('CommentAction')), isReply: false, authorId: ownerId, participants: [ownerId] } },
      },
    },
  }).catch(() => {})
  return comment
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
