import { prisma } from '@/services/db'
import { getPrefixForModel, toObjectId } from '@/utils/converters'
import type { Prisma } from '@/prisma/client'
import type { ItemForSearchEmbedding } from '@/utils/search-text'

const SEARCH_VECTOR_DIM = 768

/**
 * Adapter: flatten a Prisma item payload into the shape `buildSearchTextFromItem`
 * expects. Server-only because it depends on `Prisma.ItemGetPayload`.
 */
export type ItemSearchPayload = Prisma.ItemGetPayload<{
  select: {
    name: true
    description: true
    tags: true
    status: true
    createdAt: true
    updatedAt: true
    category: true
    type: true
    owner: { select: { name: true } }
    file: { select: { extension: true; mimeType: true } }
  }
}> & {
  extraText?: string | null
  caption?: string | null
  summary?: string | null
}

export function mapItemToSearch(item: ItemSearchPayload): ItemForSearchEmbedding {
  return {
    name: item.name,
    description: item.description,
    tags: item.tags,
    category: item.category,
    type: item.type,
    status: item.status,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    ownerName: item.owner?.name,
    extension: item.file?.extension,
    mimeType: item.file?.mimeType,
    extraText: item.extraText,
    caption: item.caption,
    summary: item.summary,
  }
}

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
