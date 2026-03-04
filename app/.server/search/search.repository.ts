import { prisma } from '@/services/db'
import { getPrefixForModel, toObjectId } from '@/utils/converters'
import type { Search } from '@/prisma/client'

export type SemanticSearchResult = {
  id: string
  similarity: number
}

export type SearchResult = {
  id: string
  itemId: string
  content: string | null
  similarity?: number
  createdAt: Date
  updatedAt: Date
}

class SearchRepository {
  /**
   * Upsert a search embedding for an item.
   * Creates or updates the search record with the vector embedding.
   * Note: Uses raw SQL because the vector field is Unsupported in Prisma
   */
  async upsertSearchEmbedding(
    itemId: string,
    embedding: number[],
    content?: string
  ): Promise<Search | null> {
    // Check if exists
    const existing = await prisma.search.findUnique({
      where: { itemId },
    })

    const embeddingStr = JSON.stringify(embedding)
    const searchId = toObjectId(getPrefixForModel('Search'))

    if (existing) {
      // Update existing - use raw SQL for vector
      await prisma.$executeRawUnsafe(
        `UPDATE "Search" SET "vector" = $1::vector, "content" = $2, "updatedAt" = NOW() WHERE "itemId" = $3`,
        embeddingStr,
        content || null,
        itemId
      )
    } else {
      // Create new - use raw SQL for vector
      await prisma.$executeRawUnsafe(
        `INSERT INTO "Search" (id, "itemId", "vector", content, "createdAt", "updatedAt") 
         VALUES ($1, $2, $3::vector, $4, NOW(), NOW())`,
        searchId,
        itemId,
        embeddingStr,
        content || null
      )
    }

    return await prisma.search.findUnique({
      where: { itemId },
    })
  }

  /**
   * Delete search embedding for an item.
   */
  async deleteSearchEmbedding(itemId: string): Promise<void> {
    await prisma.search.delete({
      where: { itemId },
    })
  }

  /**
   * Delete search embeddings for multiple items.
   */
  async deleteSearchEmbeddingBatch(itemIds: string[]): Promise<number> {
    const result = await prisma.search.deleteMany({
      where: { itemId: { in: itemIds } },
    })
    return result.count
  }

  /**
   * Perform semantic search using vector similarity.
   * Returns items ranked by cosine similarity to the query vector.
   */
  async semanticSearch(
    queryVector: number[],
    topK: number
  ): Promise<SemanticSearchResult[]> {
    const result = await prisma.$queryRaw<SemanticSearchResult[]>`
      SELECT
          i.id,
          1 - (s.vector <=> ${queryVector}::vector) as similarity
      FROM "Item" AS i
      JOIN "Search" AS s ON i.id = s."itemId"
      ORDER BY similarity DESC
      LIMIT ${topK}
    `
    return result
  }

  /**
   * Perform semantic search with filters using parameterized queries.
   * Includes workspace and item type filtering.
   */
  async semanticSearchWithFilters(
    queryVector: number[],
    topK: number,
    filters?: {
      workspaceId?: string
      itemType?: string
      excludeIds?: string[]
    }
  ): Promise<SemanticSearchResult[]> {
    const results = await prisma.item.findMany({
      where: {
        ...(filters?.workspaceId && { workspaceId: filters.workspaceId }),
        ...(filters?.itemType && { type: filters.itemType as any }),
        ...(filters?.excludeIds && { id: { notIn: filters.excludeIds } }),
        search: { isNot: null },
      },
      include: { search: true },
      take: topK,
    })

    // Map results to include similarity (would need vector comparison in practice)
    return results
      .filter((item) => item.search !== null)
      .map((item) => ({
        id: item.id,
        similarity: 0, // Placeholder - would need actual vector similarity calculation
      }))
  }

  /**
   * Get search record by item ID.
   */
  async getSearchByItemId(itemId: string): Promise<Search | null> {
    return await prisma.search.findUnique({
      where: { itemId },
    })
  }

  /**
   * Get search records by multiple item IDs.
   */
  async getSearchByItemIds(itemIds: string[]): Promise<Search[]> {
    return await prisma.search.findMany({
      where: { itemId: { in: itemIds } },
    })
  }

  /**
   * Search by content using case-insensitive contains.
   */
  async searchByContent(query: string, topK: number): Promise<SearchResult[]> {
    const results = await prisma.search.findMany({
      where: {
        content: {
          contains: query,
          mode: 'insensitive',
        },
      },
      take: topK,
      orderBy: {
        createdAt: 'desc',
      },
    })

    return results.map((r) => ({
      id: r.id,
      itemId: r.itemId,
      content: r.content,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }))
  }

  /**
   * Update content for a search record.
   */
  async updateSearchContent(
    itemId: string,
    content: string
  ): Promise<Search | null> {
    return await prisma.search.update({
      where: { itemId },
      data: { content },
    })
  }

  /**
   * Get all search records with optional pagination.
   */
  async getAllSearchRecords(
    limit: number = 100,
    offset: number = 0
  ): Promise<Search[]> {
    return await prisma.search.findMany({
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
    })
  }

  /**
   * Count total search records.
   */
  async countSearchRecords(): Promise<number> {
    return await prisma.search.count()
  }

  /**
   * Check if search embedding exists for an item.
   */
  async existsSearchEmbedding(itemId: string): Promise<boolean> {
    const result = await prisma.search.findUnique({
      where: { itemId },
      select: { id: true },
    })
    return result !== null
  }

  /**
   * Batch upsert search embeddings for multiple items.
   */
  async upsertSearchEmbeddingBatch(
    items: Array<{ itemId: string; embedding: number[]; content?: string }>
  ): Promise<(Search | null)[]> {
    const results = await Promise.all(
      items.map((item) =>
        this.upsertSearchEmbedding(item.itemId, item.embedding, item.content)
      )
    )
    return results
  }

  /**
   * Clear all search embeddings (use with caution - typically for maintenance).
   */
  async clearAllSearchEmbeddings(): Promise<number> {
    const result = await prisma.search.deleteMany({})
    return result.count
  }
}

export const searchRepository = new SearchRepository()
