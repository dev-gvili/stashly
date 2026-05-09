import { prisma } from '@/services/db'
import { getPrefixForModel, toObjectId } from '@/utils/converters'

/**
 * Upsert the searchable text content for an item into the `Search` table.
 *
 * Stores `content` only — `vector` is left `null` and filled in by a separate
 * embedding step. Idempotent on `itemId`.
 *
 * @example
 * await upsertSearchContent('item_abc', 'Quarterly review draft. Section 1: ...')
 */
export async function upsertSearchContent(itemId: string, content: string) {
  const trimmed = content.trim()
  if (!trimmed) return null

  return prisma.search.upsert({
    where: { itemId },
    create: {
      id: toObjectId(getPrefixForModel('Search')),
      itemId,
      content: trimmed,
    },
    update: { content: trimmed },
  })
}
