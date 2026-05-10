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

// ──────────────────────────────────────────────────────────────────────────
// Chunk-level retrieval (multi-vector)
//
// Industry-standard semantic search over long documents stores one embedding
// per ~300-token passage rather than per-document. Mirrors what Drive,
// OneDrive, Confluence, etc. do under the hood. See
// `docs/thumbnail-pipeline.md` § Search architecture for the full rationale.
// ──────────────────────────────────────────────────────────────────────────

const CHUNK_CHARS = 1500
const OVERLAP_CHARS = 250

export interface TextChunk {
  content: string
  charStart: number
  charEnd: number
  pageNum: number | null
}

/**
 * Split a long string into ~CHUNK_CHARS-sized chunks with OVERLAP_CHARS of
 * context preserved across boundaries. Snaps chunk ends to sentence/newline
 * breaks where possible so passages aren't cut mid-sentence.
 *
 * Browser-safe (no Prisma deps) — exported for both client and server use.
 */
export function chunkText(
  fullText: string,
  options: { chunkChars?: number; overlapChars?: number } = {},
): TextChunk[] {
  const chunkChars = options.chunkChars ?? CHUNK_CHARS
  const overlapChars = options.overlapChars ?? OVERLAP_CHARS
  const text = fullText.trim()
  if (text.length === 0) return []

  const chunks: TextChunk[] = []
  let pos = 0
  while (pos < text.length) {
    let end = Math.min(pos + chunkChars, text.length)
    // Snap to sentence/newline break in the last 200 chars of the window.
    if (end < text.length) {
      const snapWindowStart = Math.max(end - 200, pos + 1)
      const snapWindow = text.slice(snapWindowStart, end)
      const breakOffset = findLastSentenceBreak(snapWindow)
      if (breakOffset !== -1) end = snapWindowStart + breakOffset
    }
    const content = text.slice(pos, end).trim()
    if (content) {
      chunks.push({ content, charStart: pos, charEnd: end, pageNum: null })
    }
    if (end >= text.length) break
    pos = Math.max(end - overlapChars, pos + 1)
  }
  return chunks
}

function findLastSentenceBreak(s: string): number {
  for (let i = s.length - 1; i >= 0; i--) {
    const c = s[i]
    if (c === '.' || c === '!' || c === '?' || c === '\n') return i + 1
  }
  return -1
}

/**
 * Replace all chunks for an item with the given set. Returns the created
 * rows (with their ids) so the caller can run embedding generation and
 * write the vectors back via `setSearchChunkVectors`.
 *
 * Replaces (delete + createMany) rather than upserts because chunk
 * boundaries shift when the source content changes — the previous
 * `ord`/`charStart` mapping isn't meaningful.
 */
export async function upsertSearchChunks(
  itemId: string,
  chunks: TextChunk[],
): Promise<{ id: string; ord: number; content: string }[]> {
  if (chunks.length === 0) return []

  const rows = chunks.map((chunk, ord) => ({
    id: toObjectId(getPrefixForModel('SearchChunk')),
    itemId,
    ord,
    content: chunk.content,
    pageNum: chunk.pageNum,
    charStart: chunk.charStart,
    charEnd: chunk.charEnd,
  }))

  await prisma.$transaction([
    prisma.searchChunk.deleteMany({ where: { itemId } }),
    prisma.searchChunk.createMany({ data: rows }),
  ])

  return rows.map((r) => ({ id: r.id, ord: r.ord, content: r.content }))
}

/**
 * Write embedding vectors for previously-created chunks. Uses raw SQL with
 * pgvector's text-cast (`'[1.0,2.0,...]'::vector`) because Prisma can't write
 * `Unsupported("vector(768)")` columns directly.
 *
 * Runs in a single transaction so partial writes don't leave the index
 * half-populated.
 */
export async function setSearchChunkVectors(
  entries: { chunkId: string; vector: number[] }[],
): Promise<number> {
  if (entries.length === 0) return 0

  const updates = entries.map(({ chunkId, vector }) => {
    if (vector.length !== SEARCH_VECTOR_DIM) {
      throw new Error(
        `Expected ${SEARCH_VECTOR_DIM}-dim vector, got ${vector.length}`,
      )
    }
    const literal = `[${vector.join(',')}]`
    return prisma.$executeRaw`
      UPDATE "SearchChunk"
      SET vector = ${literal}::vector, "updatedAt" = NOW()
      WHERE id = ${chunkId}
    `
  })

  const results = await prisma.$transaction(updates)
  return results.reduce((sum, n) => sum + n, 0)
}
