import { prisma } from '@/services/db'
import { getPrefixForModel, toObjectId } from '@/utils/converters'
import type { Prisma } from '@/prisma/client'
import type { ItemForSearchEmbedding } from '@/utils/search-text'
import { getObjectHead } from './s3'
import { upsertMarkdownFacet } from './item-actions'
import { isMarkdownName, parseMarkdownMetadata } from '@/utils/markdown'
import {
  MAX_INDEXED_TEXT_CHARS,
  TEXT_EXTENSIONS,
  TEXT_NOISE_NAMES,
  TEXT_NOISE_SUFFIXES,
  isIndexableTextName,
} from '@/utils/text-files'
import {
  RANK_DEPTH,
  SEARCH_VECTOR_DIM,
  normalizeQuery,
  reciprocalRankFusion,
  toVectorLiteral,
} from '@/utils/search-query'

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

/**
 * Append one OCR'd page to an item's search index, incrementally.
 *
 * OCR runs at roughly half a minute per page, so a 15-page document is ~8
 * minutes of work. Submitting only at the end meant closing the tab at page 12
 * discarded all twelve — the user paid the entire cost and kept nothing. This
 * persists each page the moment it is transcribed, so progress is durable and
 * only one page's worth of text is ever held in memory.
 *
 * **Appends rather than replaces.** `upsertSearchContent` + `upsertSearchChunks`
 * do `deleteMany` + `createMany`, which is right when re-indexing a whole
 * document and catastrophic per page: calling it fifteen times would re-chunk
 * and re-embed everything fifteen times over. Here `ord` continues from the
 * current maximum and existing rows are left alone.
 *
 * Also the first thing to populate **`SearchChunk.pageNum`**. The column has
 * existed since the schema landed with nothing writing to it, because
 * `extractPdfText` joins pages and discards their boundaries. Page-at-a-time
 * OCR knows the page number for free, which is what a "jump to page 7" result
 * link would need.
 *
 * @returns The created chunks, so the caller can embed them immediately.
 *
 * @example
 * const chunks = await appendSearchPage({ itemId, pageNum: 3, text })
 */
export async function appendSearchPage(params: {
  itemId: string
  pageNum: number
  text: string
}): Promise<{ id: string; ord: number; content: string }[]> {
  const { itemId, pageNum } = params
  const text = params.text.trim()
  if (!text) return []

  // Document-level fallback content grows page by page. Separated by blank
  // lines to match how `extractPdfText` joins pages, so both paths produce the
  // same shape for the sparse ranker.
  const existing = await prisma.search.findUnique({
    where: { itemId },
    select: { content: true },
  })

  if (existing) {
    await prisma.search.update({
      where: { itemId },
      data: {
        content: existing.content ? `${existing.content}\n\n${text}` : text,
      },
    })
  } else {
    await prisma.search.create({
      data: {
        id: toObjectId(getPrefixForModel('Search')),
        itemId,
        content: text,
      },
    })
  }

  // Continue the existing ordering rather than restarting at zero — `ord` is
  // unique per item, so colliding would fail the whole page.
  const last = await prisma.searchChunk.findFirst({
    where: { itemId },
    orderBy: { ord: 'desc' },
    select: { ord: true },
  })
  const startOrd = (last?.ord ?? -1) + 1

  const rows = chunkText(text).map((chunk, index) => ({
    id: toObjectId(getPrefixForModel('SearchChunk')),
    itemId,
    ord: startOrd + index,
    content: chunk.content,
    pageNum,
    charStart: chunk.charStart,
    charEnd: chunk.charEnd,
  }))

  if (rows.length === 0) return []

  await prisma.searchChunk.createMany({ data: rows })

  return rows.map((r) => ({ id: r.id, ord: r.ord, content: r.content }))
}

// ──────────────────────────────────────────────────────────────────────────
// Re-indexing
//
// Text extraction normally runs in the browser during upload, which leaves two
// permanent holes: a file uploaded before that pipeline shipped was never
// extracted at all, and a file extracted by an older version of the parser
// keeps whatever that version produced forever. Neither is reachable by the
// embedding backfill, which only fills in vectors for chunks that already
// exist.
//
// Anything made of text needs no browser to re-extract — markdown, source,
// config, data, plain `.txt`: `getObjectHead` reads the object and
// `parseMarkdownMetadata` is a pure function — so the whole rebuild runs
// server-side. The chunks it writes land with `vector` NULL, which is exactly
// what `findUnembeddedChunks` already looks for, so the existing embedding
// backfill picks them up with no new machinery.
//
// This is also the only route for code files uploaded before they were indexed
// at all: extraction skipped every non-PDF, non-markdown type, so they have no
// `Search` row and could be found by name alone.
//
// PDFs are deliberately excluded: PDF.js and the OCR fallback are browser-side,
// so those still have to go through the upload pipeline.
// ──────────────────────────────────────────────────────────────────────────

/**
 * Name patterns for every file whose body this rebuild can read: markdown, but
 * also source, config and data files.
 *
 * `TEXT_EXTENSIONS` carries bare filenames (`dockerfile`, `makefile`) alongside
 * real extensions, so the pattern is a plain `%suffix` rather than `%.suffix` —
 * `%dockerfile` has to match a file called exactly that.
 */
const TEXT_NAME_PATTERNS = TEXT_EXTENSIONS.map((ext) => `%${ext}`)

/** The subset `parseMarkdownMetadata` can handle, mirroring `isMarkdownName`. */
const MARKDOWN_NAME_PATTERNS = ['%.md', '%.markdown', '%.mdown', '%.mkd']

/**
 * Generated text excluded from the queue, mirroring `isIndexableTextFile`.
 *
 * The exclusion has to happen here and not only in `reindexTextItem`: a
 * candidate the rebuild then refuses is never repaired and never leaves the
 * list, so 25 lockfiles would occupy every batch and starve the real backlog.
 */
const NOISE_SUFFIX_PATTERNS = [
  ...TEXT_NOISE_NAMES,
  ...TEXT_NOISE_SUFFIXES.map((suffix) => `%${suffix}`),
]

/**
 * Indexed content must be at least `1/STALE_INDEX_DIVISOR` of the file's bytes,
 * or the stored text is treated as a failed extraction rather than a terse
 * document.
 *
 * Markdown reduces to roughly 40–80% of its source once syntax is stripped.
 * The rows this is meant to catch are far below that — `routing-and-ui.md`
 * held 7 characters against 7,672 bytes, its title and nothing else, because
 * an older extractor lost the body.
 *
 * Expressed as an integer divisor rather than a `0.1` ratio on purpose:
 * `Item.size` is a `BigInt`, so Postgres types any literal compared against it
 * as bigint too and rejects a fractional one outright.
 */
const STALE_INDEX_DIVISOR = 10

/** Files smaller than this are exempt: a short file's text is legitimately short. */
const STALE_MIN_BYTES = 1024

/** Ceiling when counting what is left after a batch, purely for the UI's tally. */
const REMAINING_PROBE = 500

export interface ReindexCandidate {
  id: string
  name: string
  /**
   * Why it needs rebuilding, for the UI to explain the queue.
   *
   * `unstructured` is the subtle one: the body is complete, but it was stored
   * by a parser that collapsed every whitespace run, so it has no line breaks
   * and its chunks carry no section. Such a document searches fine and can
   * never tell you *where* a match came from.
   */
  reason: 'missing' | 'truncated' | 'unstructured' | 'outdated'
  indexedChars: number
  fileBytes: number
}

/**
 * Text documents whose search index is missing or demonstrably truncated.
 *
 * @example
 * const stale = await findReindexCandidates(session.user.id, 50)
 */
export async function findReindexCandidates(
  ownerId: string,
  limit = 100,
): Promise<ReindexCandidate[]> {
  const rows = await prisma.$queryRaw<
    {
      id: string
      name: string
      indexedChars: number
      fileBytes: number
      hasLines: boolean
      chunksBehind: boolean
    }[]
  >`
    SELECT i."id", i."name",
      COALESCE(length(s."content"), 0)::int AS "indexedChars",
      COALESCE(i."size", 0)::int AS "fileBytes",
      position(E'\n' IN COALESCE(s."content", '')) > 0 AS "hasLines",
      -- Body rewritten more recently than its passages. A re-index writes the
      -- content first, so a failure between the two steps leaves exactly this:
      -- a healthy-looking body whose chunks still came from the old parser.
      -- Without this the item passes every other check and becomes invisible
      -- to the very tool meant to repair it.
      (
        s."updatedAt" > COALESCE(
          (SELECT MAX(c."updatedAt") FROM "SearchChunk" c WHERE c."itemId" = i."id"),
          'epoch'::timestamp
        )
      ) AS "chunksBehind"
    FROM "Item" i
    LEFT JOIN "Search" s ON s."itemId" = i."id"
    WHERE i."ownerId" = ${ownerId}
      AND i."status" = 'normal'
      AND i."type" = 'file'
      AND lower(i."name") LIKE ANY (${TEXT_NAME_PATTERNS}::text[])
      AND lower(i."name") NOT LIKE ALL (${NOISE_SUFFIX_PATTERNS}::text[])
      AND (
        s."content" IS NULL
        OR length(s."content") = 0
        -- Compared against the *indexable* size, not the file size: a body is
        -- capped at MAX_INDEXED_TEXT_CHARS, so a 10 MB artifact stores its
        -- first 512 KB and would otherwise read as permanently truncated —
        -- re-fetched from S3 on every run, forever, to produce the same bytes.
        OR (
          i."size" > ${STALE_MIN_BYTES}
          AND length(s."content")::bigint * ${STALE_INDEX_DIVISOR}
              < LEAST(i."size", ${MAX_INDEXED_TEXT_CHARS})
        )
        -- No line break in a document long enough to have had several is the
        -- fingerprint of the parser that collapsed all whitespace. Its body is
        -- intact, so nothing else here catches it — but it can resolve neither
        -- a line number nor a section, which is every locator a markdown
        -- result has.
        --
        -- Markdown only: a single-line file is pathological for prose and
        -- perfectly normal for data (an exported .json is routinely one line),
        -- and a rebuild cannot add newlines that were never in the source. Left
        -- unscoped, every such file would re-queue itself after every repair.
        OR (
          i."size" > ${STALE_MIN_BYTES}
          AND position(E'\n' IN s."content") = 0
          AND lower(i."name") LIKE ANY (${MARKDOWN_NAME_PATTERNS}::text[])
        )
        OR s."updatedAt" > COALESCE(
          (SELECT MAX(c."updatedAt") FROM "SearchChunk" c WHERE c."itemId" = i."id"),
          'epoch'::timestamp
        )
      )
    ORDER BY i."size" DESC
    LIMIT ${limit}
  `

  return rows.map(({ hasLines, chunksBehind, ...row }) => ({
    ...row,
    reason:
      row.indexedChars === 0
        ? ('missing' as const)
        : chunksBehind
          ? ('outdated' as const)
          : !hasLines
            ? ('unstructured' as const)
            : ('truncated' as const),
  }))
}

export interface ReindexResult {
  itemId: string
  name: string
  chars: number
  chunks: number
}

/**
 * Rebuild one text item's search index from the object in storage.
 *
 * Ownership is enforced in the lookup rather than checked afterwards — a
 * re-index reads file contents, so an id from another user's drive must not
 * resolve at all.
 *
 * @example
 * const { chunks } = await reindexTextItem(session.user.id, 'itm_abc')
 */
export async function reindexTextItem(
  ownerId: string,
  itemId: string,
): Promise<ReindexResult | null> {
  const item = await prisma.item.findFirst({
    where: { id: itemId, ownerId, status: 'normal', type: 'file' },
    select: {
      id: true,
      name: true,
      file: { select: { bucket: true, key: true, mimeType: true } },
    },
  })
  if (!item?.file) return null

  const isMarkdown = isMarkdownName(item.name, item.file.mimeType)
  if (!isMarkdown && !isIndexableTextName(item.name, item.file.mimeType)) return null

  // Ranged read rather than a full-body GET: a stray 50 MB log would otherwise
  // be buffered in the server process in its entirety just to keep the first
  // 512 KB. A range past the end of an object is not an error — S3 returns
  // what it has — so small files are unaffected. Four bytes per char is UTF-8's
  // worst case, which is what makes the char cap reachable for any encoding.
  const bytes = await getObjectHead(
    item.file.bucket,
    item.file.key,
    MAX_INDEXED_TEXT_CHARS * 4,
  )
  const raw = new TextDecoder('utf-8').decode(bytes).slice(0, MAX_INDEXED_TEXT_CHARS)

  // Source, config and data files have no frontmatter to strip and no headings
  // to name a section with, so they skip the markdown parser entirely: their
  // body *is* the file. Running `parseMarkdownMetadata` over a .ts file would
  // read a leading `---` in a comment as frontmatter and silently eat the top
  // of the document.
  if (!isMarkdown) {
    const body = raw.trim()
    if (!body) return { itemId: item.id, name: item.name, chars: 0, chunks: 0 }

    const chunks = await upsertSearchChunks(item.id, chunkText(body))
    await upsertSearchContent(item.id, body)
    return {
      itemId: item.id,
      name: item.name,
      chars: body.length,
      chunks: chunks.length,
    }
  }

  const meta = parseMarkdownMetadata(raw)
  if (!meta.text) return { itemId: item.id, name: item.name, chars: 0, chunks: 0 }

  // Chunks first. `upsertSearchContent` used to run ahead of this, and a
  // failure in between left the body rewritten with passages still from the
  // old parser — an item that then looked healthy to every staleness check and
  // could no longer be found by the tool meant to repair it. Writing the part
  // that can fail first means a failure changes nothing at all.
  const chunks = await upsertSearchChunks(
    item.id,
    assignChunkSections(chunkText(meta.text), meta.sections),
  )
  await upsertSearchContent(item.id, meta.text)

  // Refresh the facet too. For a file that was never extracted there is no
  // facet at all, and the title/author/tags it carries are what the ranker
  // reads once metadata scoring lands.
  await upsertMarkdownFacet(item.id, {
    title: meta.title,
    author: meta.author,
    description: meta.description,
    tags: meta.tags,
    wordCount: meta.wordCount,
    readingTime: meta.readingTime,
    headingCount: meta.headingCount,
    linkCount: meta.linkCount,
    imageCount: meta.imageCount,
    codeBlockCount: meta.codeBlockCount,
    taskCount: meta.taskCount,
    hasFrontmatter: meta.hasFrontmatter,
    docCreatedAt: meta.docCreatedAt ? new Date(meta.docCreatedAt) : undefined,
    docModifiedAt: meta.docModifiedAt ? new Date(meta.docModifiedAt) : undefined,
  })

  return {
    itemId: item.id,
    name: item.name,
    chars: meta.text.length,
    chunks: chunks.length,
  }
}

/**
 * Rebuild a batch of stale/missing text indexes.
 *
 * One failure doesn't abort the run — a single unreadable object would
 * otherwise block every document behind it in the queue, and the whole point
 * is to make progress across a backlog.
 */
export async function reindexTextItems(
  ownerId: string,
  limit = 25,
): Promise<{
  done: ReindexResult[]
  failed: { itemId: string; name: string; error: string }[]
  remaining: number
}> {
  const candidates = await findReindexCandidates(ownerId, limit)
  const done: ReindexResult[] = []
  const failed: { itemId: string; name: string; error: string }[] = []

  for (const candidate of candidates) {
    try {
      const result = await reindexTextItem(ownerId, candidate.id)
      if (result) done.push(result)
    } catch (e) {
      const err = e as { message?: string }
      failed.push({
        itemId: candidate.id,
        name: candidate.name,
        error: err.message ?? 'Re-index failed',
      })
    }
  }

  // Re-probed with a generous ceiling rather than `limit`, so the UI can say
  // "18 still queued" instead of a number capped at the batch size. Reuses the
  // same finder so the predicate for "needs rebuilding" lives in one place.
  const remaining = (await findReindexCandidates(ownerId, REMAINING_PROBE)).length
  return { done, failed, remaining }
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
  /** Nearest preceding heading, when the source has structure to name. */
  section?: string | null
}

/** Heading boundaries in the same coordinate space as the text being chunked. */
export interface ChunkSection {
  title: string
  start: number
}

/**
 * Tag chunks with the section they fall inside.
 *
 * Split from `chunkText` rather than folded into it because chunk boundaries
 * are decided by size and sentence breaks, while section boundaries come from
 * the document's own structure — a chunk routinely spans a heading. The
 * section reported is the last one that *opened* at or before the chunk starts,
 * which is what a reader scrolling to that offset would see above them.
 */
export function assignChunkSections(
  chunks: TextChunk[],
  sections: ChunkSection[],
): TextChunk[] {
  if (sections.length === 0) return chunks

  // Both lists are already in ascending offset order, so one cursor walks them
  // together instead of scanning all sections per chunk.
  let index = 0
  return chunks.map((chunk) => {
    while (
      index + 1 < sections.length &&
      sections[index + 1].start <= chunk.charStart
    ) {
      index++
    }
    const current = sections[index]
    return {
      ...chunk,
      section: current.start <= chunk.charStart ? current.title : null,
    }
  })
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
    section: chunk.section ?? null,
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

/**
 * Chunks that were written but never embedded, for a single owner.
 *
 * Embeddings are generated in the browser *after* the chunk rows are saved, so
 * anything that ends the run early — closing the tab, navigating away, a
 * WebGPU fault — leaves `vector` NULL and that passage invisible to semantic
 * search, permanently. There is no server-side embedding pass, so the client
 * re-runs these on a later visit (see `useEmbeddingBackfill`).
 *
 * Raw SQL because `vector` is an `Unsupported` column: Prisma can neither
 * select nor filter on it, so `vector IS NULL` is not expressible in the
 * query builder.
 *
 * Ordered newest-first: a document the user just uploaded is the one they are
 * most likely to search for next.
 */
export async function findUnembeddedChunks(
  ownerId: string,
  limit = 32,
): Promise<{ id: string; content: string }[]> {
  return prisma.$queryRaw<{ id: string; content: string }[]>`
    SELECT c."id", c."content"
    FROM "SearchChunk" c
    JOIN "Item" i ON i."id" = c."itemId"
    WHERE c."vector" IS NULL
      AND i."ownerId" = ${ownerId}
      AND i.status = 'normal'
    ORDER BY c."createdAt" DESC
    LIMIT ${limit}
  `
}

// ──────────────────────────────────────────────────────────────────────────
// Query side — hybrid retrieval
//
// Two rankers with no comparable score scale (trigram similarity vs. cosine
// distance) are combined by *rank* through Reciprocal Rank Fusion, then the
// fused ids are hydrated in one Prisma query. Sparse alone misses "what does
// our termination clause say"; dense alone misses exact filename lookups.
// Fusion in TypeScript rather than SQL keeps each query simple enough to read
// and puts the ranking maths somewhere it can be unit tested.
//
// Every query in this section is scoped to `ownerId` — a passage from another
// user's document must never be reachable, and the scope is applied inside
// the SQL rather than layered on afterwards.
// ──────────────────────────────────────────────────────────────────────────

/**
 * Chunks pulled from the vector index before roll-up to items. Deeper than
 * `RANK_DEPTH` because a single long document can occupy many of the nearest
 * chunks, and after `DISTINCT ON` collapses them we still want a full ranking
 * list of *items* to fuse.
 */
const CHUNK_SCAN_DEPTH = 400

/** Minimum trigram similarity for a fuzzy name match to count as a hit. */
const NAME_SIMILARITY_FLOOR = 0.2

/**
 * Minimum cosine similarity for a dense neighbour to be worth showing.
 *
 * `ORDER BY vector <=> query LIMIT n` has no notion of "far enough away to be
 * irrelevant" — it always returns *something*, so on a small drive the nearest
 * neighbours of any query include documents with no relationship to it at all.
 * An icon glyph sheet came back for "deep dive" this way.
 *
 * Deliberately low. A ~1,500-char chunk compared against a three-word query
 * scores well below 1.0 even when it quotes the query verbatim, because the
 * chunk vector encodes the whole passage — so a floor tuned by intuition from
 * other systems cuts real matches. The scores on the cards are now the real
 * cosine values, which is the evidence to raise this with.
 */
const SEMANTIC_SIMILARITY_FLOOR = 0.15

/**
 * Split a query into the individual words worth matching on their own.
 *
 * Shared by the sparse ranker and the match-detail query so both agree on what
 * counts as a term — if they disagreed, an item could rank on a word the hit
 * counter never looks for and come back `hitCount: 0` while sitting in the
 * `content` group.
 */
export function splitQueryTerms(query: string): string[] {
  return query
    .split(/\s+/)
    .map((t) => t.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''))
    .filter((t) => t.length >= 2)
}

/**
 * Why an item is in the result list — the grouping key for the search page.
 *
 * Ordered by how much the user can trust it: a filename hit is the query
 * itself, a content hit is the query inside the document, a fuzzy hit is an
 * approximate name the trigram ranker admitted, and a semantic hit is a
 * neighbour the vector index proposed. Derived on the server because only the
 * server can see `Search.content`; the client has a single passage and would
 * mislabel any document whose literal hits live outside it.
 *
 * `fuzzy` and `semantic` both mean "no literal evidence" and used to share the
 * `semantic` label, which was a lie in fuzzy mode: the sparse ranker admits a
 * typo'd name through `similarity()` without any embedding being loaded, so a
 * card read "closest by meaning" about a match no model ever saw.
 */
export type MatchKind = 'name' | 'content' | 'fuzzy' | 'semantic'

/** Literal-match evidence per item, resolved after ranking. */
export interface SearchMatchDetail {
  matchKind: MatchKind
  /** Literal term occurrences across the whole document body. */
  hitCount: number
}

/**
 * Where the first literal hit is, and enough text around it to quote.
 *
 * The vector-nearest chunk and the chunk containing the typed words are
 * routinely different passages in the same document — semantic retrieval is
 * doing its job when they differ. Showing the dense passage under a "2 hits"
 * label put the two in contradiction: the card claimed literal evidence and
 * then quoted text that contained none of it.
 */
interface LiteralHit {
  text: string
  /**
   * 1-based line in the document body, or null when the body has no line
   * structure to count. Most stored bodies don't: the text passes through
   * `cleanText`, which collapses every whitespace run to a single space, so
   * only the OCR path (which joins pages with `\n\n`) keeps its newlines.
   * Returning 1 for all of them would be a fabricated locator.
   */
  lineNum: number | null
  /** Page the hit falls on, for formats that have pages at all. */
  pageNum: number | null
  /** Heading the hit sits under, for formats with structure instead of pages. */
  section: string | null
}

/** The passage that made an item match, for snippet rendering in the UI. */
export interface SearchPassageRow {
  /** Null when the passage was cut from the document body, not from a chunk. */
  chunkId: string | null
  content: string
  pageNum: number | null
  /** 1-based line. Resolvable for anything indexed since line breaks were kept. */
  lineNum: number | null
  /** Nearest preceding heading, for documents with sections rather than pages. */
  section: string | null
  charStart: number
  charEnd: number
  /** Cosine similarity in `[0, 1]`. Null when the passage was located literally. */
  similarity: number | null
}

export interface SearchRanking {
  /** Item ids in fused-relevance order. */
  ids: string[]
  /**
   * Relevance per item id, 0–100.
   *
   * RRF produces a score with no absolute meaning — it is a sum of reciprocal
   * ranks, so its ceiling depends on how many lists were fused, not on how
   * good the match is. Normalizing against the top result turns it into the
   * only thing it can honestly express: how this result compares with the best
   * one found. The leader is therefore always 100.
   */
  scores: Map<string, number>
  /** Best-matching passage per item id, present only for dense hits. */
  passages: Map<string, SearchPassageRow>
  /** Whether the dense half actually contributed to this ranking. */
  semantic: boolean
  /** Ids the sparse ranker returned, for diagnostics in the response. */
  keywordCount: number
  /** Ids the dense ranker returned, for diagnostics in the response. */
  semanticCount: number
}

/**
 * Sparse ranker: trigram + substring matching over item names, tags and the
 * document-level `Search.content`.
 *
 * `similarity()` is length-normalized over the whole string, which makes it
 * useless against a 20,000-char document body — a one-word query scores near
 * zero. `word_similarity()` compares the query against the best-matching
 * *extent* of the target instead, which is the right operator for finding a
 * short query inside a long passage.
 *
 * Backed by `item_name_trgm_idx` (already migrated) and the `Search.content`
 * GIN index added alongside this function.
 */
async function rankByKeyword(
  ownerId: string,
  query: string,
  depth: number,
): Promise<string[]> {
  const like = `%${query}%`
  // Individual words, so a multi-word query can match documents that contain
  // its terms without containing the exact phrase. Matching only the phrase
  // made the sparse half nearly inert for natural-language queries — every
  // document except a verbatim copy scored zero, which left RRF fusing one
  // real list with an empty one and effectively demoted it to dense-only
  // search.
  const terms = splitQueryTerms(query)
  const termPatterns = terms.map((t) => `%${t}%`)

  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT i."id",
      GREATEST(
        similarity(i."name", ${query}),
        word_similarity(${query}, COALESCE(s."content", '')),
        -- An exact phrase beats any partial signal. Ranked above a name hit
        -- because a document whose *body* quotes the query verbatim is the
        -- strongest keyword evidence there is.
        CASE WHEN s."content" ILIKE ${like} THEN 0.95 ELSE 0 END,
        CASE WHEN i."name" ILIKE ${like} THEN 0.9 ELSE 0 END,
        -- Partial credit: the share of query words present anywhere in the
        -- document, so "browser-side WebGPU AI inference" still ranks a file
        -- that discusses three of the four.
        CASE WHEN ${termPatterns.length} = 0 THEN 0 ELSE (
          SELECT COUNT(*)::float / ${Math.max(termPatterns.length, 1)}
          FROM unnest(${termPatterns}::text[]) AS pat
          WHERE i."name" ILIKE pat OR COALESCE(s."content", '') ILIKE pat
        ) * 0.8 END
      ) AS score
    FROM "Item" i
    LEFT JOIN "Search" s ON s."itemId" = i."id"
    WHERE i."ownerId" = ${ownerId}
      AND i."status" = 'normal'
      AND (
        i."name" ILIKE ${like}
        OR s."content" ILIKE ${like}
        OR similarity(i."name", ${query}) > ${NAME_SIMILARITY_FLOOR}
        OR EXISTS (
          SELECT 1 FROM unnest(i."tags") AS tag WHERE tag ILIKE ${like}
        )
        OR EXISTS (
          SELECT 1 FROM unnest(${termPatterns}::text[]) AS pat
          WHERE i."name" ILIKE pat OR COALESCE(s."content", '') ILIKE pat
        )
      )
    ORDER BY score DESC, i."id" ASC
    LIMIT ${depth}
  `
  return rows.map((row) => row.id)
}

/**
 * Dense ranker: nearest chunks by cosine distance, rolled up to one best
 * passage per item.
 *
 * The inner query is the index-friendly shape — a plain `ORDER BY vector <=>
 * … LIMIT n` is what an HNSW index can answer. Doing `DISTINCT ON` in the
 * *outer* query keeps that property; putting it inside would force a scan of
 * every chunk the user owns.
 *
 * Chunks with a NULL vector (written but never embedded — see
 * `findUnembeddedChunks`) are excluded rather than sorted to the end: pgvector
 * treats NULL as farthest, but the predicate makes that explicit and lets the
 * planner skip them.
 */
async function rankByVector(
  ownerId: string,
  vector: number[],
  depth: number,
): Promise<{ ids: string[]; passages: Map<string, SearchPassageRow> }> {
  const literal = toVectorLiteral(vector)

  const rows = await prisma.$queryRaw<
    {
      itemId: string
      chunkId: string
      content: string
      pageNum: number | null
      charStart: number
      charEnd: number
      lineNum: number | null
      section: string | null
      distance: number
    }[]
  >`
    WITH nearest AS (
      SELECT
        c."itemId"      AS "itemId",
        c."id"          AS "chunkId",
        c."content"     AS "content",
        c."pageNum"     AS "pageNum",
        c."section"     AS "section",
        c."charStart"   AS "charStart",
        c."charEnd"     AS "charEnd",
        c."vector" <=> ${literal}::vector AS "distance"
      FROM "SearchChunk" c
      JOIN "Item" i ON i."id" = c."itemId"
      WHERE c."vector" IS NOT NULL
        AND i."ownerId" = ${ownerId}
        AND i."status" = 'normal'
      ORDER BY c."vector" <=> ${literal}::vector
      LIMIT ${CHUNK_SCAN_DEPTH}
    )
    SELECT DISTINCT ON (n."itemId")
      n."itemId", n."chunkId", n."content", n."pageNum", n."section",
      n."charStart", n."charEnd", n."distance",
      -- Line the chunk opens on, when the body has line structure to count —
      -- see \`fetchMatchDetails\` for why older rows don't. Joined out here
      -- rather than inside \`nearest\`, which has to stay the bare
      -- \`ORDER BY … LIMIT\` shape HNSW can answer.
      CASE WHEN position(E'\n' IN COALESCE(s."content", '')) > 0 THEN
        (length(left(COALESCE(s."content", ''), n."charStart"))
          - length(replace(left(COALESCE(s."content", ''), n."charStart"), E'\n', ''))
          + 1)::int
      END AS "lineNum"
    FROM nearest n
    LEFT JOIN "Search" s ON s."itemId" = n."itemId"
    ORDER BY n."itemId", n."distance" ASC
  `;

  // DISTINCT ON forces an itemId-major sort, so relevance order is restored
  // here rather than in a third SQL layer. The floor is applied here rather
  // than as a SQL predicate so the HNSW scan keeps its plain `ORDER BY … LIMIT`
  // shape — filtering inside it would force a full scan.
  const ordered = [...rows]
    .filter((row) => 1 - row.distance >= SEMANTIC_SIMILARITY_FLOOR)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, depth)

  const passages = new Map<string, SearchPassageRow>()
  for (const row of ordered) {
    passages.set(row.itemId, {
      chunkId: row.chunkId,
      content: row.content,
      pageNum: row.pageNum,
      lineNum: row.lineNum,
      section: row.section,
      charStart: row.charStart,
      charEnd: row.charEnd,
      // `<=>` is cosine *distance*; the UI wants an intuitive 0–1 score.
      similarity: 1 - row.distance,
    })
  }

  return { ids: ordered.map((row) => row.itemId), passages }
}

/**
 * Literal evidence for already-ranked ids: did the name match, and how many
 * times does the query appear in the body.
 *
 * Runs after ranking rather than inside it, over the handful of ids that
 * survived, so the cost is bounded by the page rather than by the drive.
 *
 * Counting is `length - length(without the term)` over the term length, which
 * is the standard Postgres idiom for occurrences and needs no extension. It
 * counts overlapping occurrences the way a reader would ("aa" in "aaa" is one
 * hit, not two) — close enough for a UI that renders "3 hits".
 */
async function fetchMatchDetails(
  ownerId: string,
  ids: string[],
  query: string,
): Promise<Map<string, SearchMatchDetail & { hit: LiteralHit | null }>> {
  const details = new Map<
    string,
    SearchMatchDetail & { hit: LiteralHit | null }
  >()
  if (ids.length === 0) return details

  const like = `%${query}%`
  const terms = splitQueryTerms(query)
  // The whole query still counts as a term: a single-word query survives the
  // split, and a phrase that appears verbatim should register as a hit even
  // when its individual words are too short to make the list.
  const countable = terms.length > 0 ? terms : [query]
  const patterns = countable.map((t) => `%${t}%`)

  const rows = await prisma.$queryRaw<
    {
      id: string
      nameHit: boolean
      hitCount: number
      hitText: string | null
      hitLine: number | null
      hitPage: number | null
      hitSection: string | null
    }[]
  >`
    WITH hits AS (
      SELECT i."id" AS "id",
        COALESCE(s."content", '') AS "body",
        (
          i."name" ILIKE ${like}
          OR EXISTS (
            SELECT 1 FROM unnest(${patterns}::text[]) AS pat
            WHERE i."name" ILIKE pat
          )
        ) AS "nameHit",
        COALESCE((
          SELECT SUM(
            (length(lower(COALESCE(s."content", '')))
              - length(replace(lower(COALESCE(s."content", '')), lower(term), '')))
            / NULLIF(length(term), 0)
          )
          FROM unnest(${countable}::text[]) AS term
        ), 0)::int AS "hitCount",
        -- Earliest occurrence of any term. strpos returns 0 for "not found",
        -- so the filter is what keeps MIN from collapsing to zero whenever a
        -- single term is missing.
        (
          SELECT MIN(strpos(lower(COALESCE(s."content", '')), lower(term)))
          FROM unnest(${countable}::text[]) AS term
          WHERE strpos(lower(COALESCE(s."content", '')), lower(term)) > 0
        ) AS "offset"
      FROM "Item" i
      LEFT JOIN "Search" s ON s."itemId" = i."id"
      WHERE i."ownerId" = ${ownerId}
        AND i."id" = ANY(${ids}::text[])
    )
    SELECT h."id", h."nameHit", h."hitCount",
      -- A window around the hit rather than the whole body: enough to read,
      -- small enough that the payload doesn't carry a novel per result.
      -- \`buildSnippet\` narrows it further client-side.
      substring(h."body" FROM GREATEST(h."offset" - 220, 1) FOR 700) AS "hitText",
      -- Lines before the hit, +1 — but only when the body has lines at all.
      -- Anything indexed before line breaks were preserved collapsed to a
      -- single line, and counting there would make every such result claim
      -- "line 1". Those documents report no line until they are re-indexed.
      CASE WHEN position(E'\n' IN h."body") > 0 THEN
        (length(left(h."body", h."offset" - 1))
          - length(replace(left(h."body", h."offset" - 1), E'\n', '')) + 1)::int
      END AS "hitLine",
      -- Page and section both come from the chunk spanning the hit, so one
      -- lookup answers both. Ordered by ord because overlapping chunks mean
      -- more than one can contain the offset; the earliest is the one whose
      -- heading actually precedes it.
      chunk."pageNum" AS "hitPage",
      chunk."section" AS "hitSection"
    FROM hits h
    LEFT JOIN LATERAL (
      SELECT c."pageNum", c."section"
      FROM "SearchChunk" c
      WHERE c."itemId" = h."id"
        AND c."charStart" <= h."offset"
        AND c."charEnd" >= h."offset"
      ORDER BY c."ord" ASC
      LIMIT 1
    ) chunk ON TRUE
    WHERE h."offset" IS NOT NULL
       OR h."nameHit"
  `

  for (const row of rows) {
    details.set(row.id, {
      // A name hit outranks a body hit even when the body has more of them —
      // the user searching a file manager for "invoice" means the file called
      // invoice, not the one that says the word forty times.
      matchKind: row.nameHit ? 'name' : row.hitCount > 0 ? 'content' : 'semantic',
      hitCount: row.hitCount,
      hit: row.hitText
        ? {
            text: row.hitText,
            lineNum: row.hitLine,
            pageNum: row.hitPage,
            section: row.hitSection,
          }
        : null,
    })
  }
  return details
}

/**
 * Rank an owner's items for a query, fusing whichever signals are available.
 *
 * Pass `vector` to get hybrid retrieval; omit it (no WebGPU on the client, a
 * query too short to be worth embedding) and the ranking degrades to
 * keyword-only rather than failing. That degradation is the normal path for a
 * meaningful share of sessions, not an error case.
 */
export async function rankSearchResults(params: {
  ownerId: string
  query: string
  vector?: number[] | null
  depth?: number
}): Promise<SearchRanking> {
  const { ownerId, vector, depth = RANK_DEPTH } = params
  const query = normalizeQuery(params.query)

  if (!query) {
    return {
      ids: [],
      scores: new Map(),
      passages: new Map(),
      semantic: false,
      keywordCount: 0,
      semanticCount: 0,
    }
  }

  const [keywordIds, dense] = await Promise.all([
    rankByKeyword(ownerId, query, depth),
    vector?.length
      ? rankByVector(ownerId, vector, depth)
      : Promise.resolve({
          ids: [] as string[],
          passages: new Map<string, SearchPassageRow>(),
        }),
  ])

  const lists = dense.ids.length ? [keywordIds, dense.ids] : [keywordIds]
  const fused = reciprocalRankFusion(lists, { limit: depth })

  // `fused` is already sorted, so the first entry is the yardstick. Guarded
  // against a zero top score so an empty-ish ranking can't produce NaN%.
  const top = fused[0]?.score ?? 0
  const scores = new Map(
    fused.map((entry) => [
      entry.id,
      top > 0 ? Math.round((entry.score / top) * 100) : 0,
    ]),
  )

  return {
    ids: fused.map((entry) => entry.id),
    scores,
    passages: dense.passages,
    semantic: dense.ids.length > 0,
    keywordCount: keywordIds.length,
    semanticCount: dense.ids.length,
  }
}

/**
 * Item shape for search result cards.
 *
 * Mirrors `getFolderContent`'s select exactly — anything rendered through
 * `<ItemCard>` needs the full `StashAncestor` parent shape (all scalars plus
 * `file`/`folder`/`favorites`/`thumbnails`/`locked` and a shallow `parent`).
 * A narrower select typechecks here and only fails at the spread site.
 */
const searchResultSelect = {
  id: true,
  name: true,
  type: true,
  size: true,
  inclusiveSize: true,
  category: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  ownerId: true,
  parentId: true,
  workspaceId: true,
  driveId: true,
  file: true,
  folder: true,
  locked: true,
  tags: true,
  favorites: {
    select: {
      id: true,
      favoritedById: true,
      favoritedBy: {
        select: { id: true, name: true, displayName: true, image: true },
      },
    },
  },
  thumbnails: {
    select: {
      height: true,
      width: true,
      url: true,
      view: true,
      size: true,
      id: true,
      stage: true,
    },
  },
  parent: {
    select: {
      id: true,
      name: true,
      type: true,
      size: true,
      inclusiveSize: true,
      category: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      ownerId: true,
      parentId: true,
      workspaceId: true,
      driveId: true,
      file: true,
      folder: true,
      locked: true,
      tags: true,
      favorites: {
        select: {
          id: true,
          favoritedById: true,
          favoritedBy: {
            select: { id: true, name: true, displayName: true, image: true },
          },
        },
      },
      thumbnails: {
        select: {
          height: true,
          width: true,
          url: true,
          view: true,
          size: true,
          id: true,
          stage: true,
        },
      },
      parent: true,
    },
  },
} satisfies Prisma.ItemSelect

export type SearchResultRow = Prisma.ItemGetPayload<{
  select: typeof searchResultSelect
}>

export interface SearchItemsParams {
  ownerId: string
  query: string
  /** 768-dim query embedding. Omit for keyword-only retrieval. */
  vector?: number[] | null
  /** Structured filters, already built by `buildItemFilters`. */
  where?: Prisma.ItemWhereInput
  take?: number
  /** Offset into the fused ranking. Search ranks by score, so it can't use a row cursor. */
  skip?: number
}

export interface SearchItemsResult {
  items: (SearchResultRow &
    SearchMatchDetail & {
      passage: SearchPassageRow | null
      /** Fused relevance, 0–100, normalized against the top hit. */
      score: number
    })[]
  total: number
  hasMore: boolean
  semantic: boolean
  keywordCount: number
  semanticCount: number
}

/**
 * Run a search and hydrate the ranked ids into full item cards.
 *
 * Structured filters (category, type, extension, …) are applied during
 * hydration rather than inside the ranking SQL. That keeps two already-dense
 * queries readable, at one cost worth knowing: filters narrow the top
 * {@link RANK_DEPTH} ranked matches rather than searching the whole drive with
 * the filter pre-applied, so a heavily-filtered query over a large drive can
 * return fewer rows than exist. Raise the depth if that becomes real.
 *
 * @example
 * const { items } = await searchItemsHybrid({
 *   ownerId: session.user.id,
 *   query: 'termination clause',
 *   vector,                       // omit for keyword-only
 *   where: buildItemFilters({ category: ['pdf'] }),
 * })
 */
export async function searchItemsHybrid(
  params: SearchItemsParams,
): Promise<SearchItemsResult> {
  const { ownerId, vector, where, take = 25, skip = 0 } = params

  const ranking = await rankSearchResults({
    ownerId,
    query: params.query,
    vector,
  })

  if (ranking.ids.length === 0) {
    return {
      items: [],
      total: 0,
      hasMore: false,
      semantic: ranking.semantic,
      keywordCount: 0,
      semanticCount: 0,
    }
  }

  const rows = await prisma.item.findMany({
    where: { ...where, id: { in: ranking.ids } },
    select: searchResultSelect,
  })

  // `findMany` returns rows in table order — relevance is re-applied here.
  // Building the index map once keeps this O(n) rather than an indexOf scan
  // per row.
  const rank = new Map(ranking.ids.map((id, index) => [id, index]))
  const ordered = rows.sort(
    (a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity),
  )

  const page = ordered.slice(skip, skip + take)

  // Only the page's ids — the ranking can hold 100 and the user sees 25.
  const details = await fetchMatchDetails(
    ownerId,
    page.map((item) => item.id),
    normalizeQuery(params.query),
  )

  return {
    items: page.map((item) => {
      // An id that ranked but has no row in the detail query has no literal
      // evidence anywhere in it. Which ranker put it there is what separates
      // the two ways that can happen: a dense passage means the vector index
      // proposed it, and no passage means the trigram half admitted it on
      // approximate name similarity alone — the typo case, which in fuzzy
      // mode never touches an embedding at all.
      const detail = details.get(item.id)
      const dense = ranking.passages.get(item.id)
      const { hit, ...match } = detail ?? {
        matchKind: dense ? ('semantic' as const) : ('fuzzy' as const),
        hitCount: 0,
        hit: null,
      }

      // Two scales, one per group, because the groups answer different
      // questions and are never compared against each other on the page.
      //
      // A semantic result is scored by its actual cosine similarity. Scoring
      // it by fused rank was wrong in a way that hid the very thing this page
      // exists to show: RRF is `1/(k + rank)`, so the fourth-nearest chunk
      // scores ~47% of the leader whether it is a close match or unrelated
      // noise. An icon glyph sheet read 50% against "deep dive" that way.
      //
      // A `fuzzy` result keeps the fused-rank number, which the card doesn't
      // render: a trigram distance isn't a relevance figure worth showing.
      const score =
        match.matchKind === 'semantic' && dense?.similarity != null
          ? Math.round(dense.similarity * 100)
          : (ranking.scores.get(item.id) ?? 0)

      return {
        ...item,
        ...match,
        score,
        // Quote the words the user typed whenever they exist. The dense
        // passage is the *nearest* text, not the *matching* text, and under a
        // "2 hits" label it reads as a bug: the card asserts literal evidence
        // and then shows a paragraph containing none of it.
        passage: hit
          ? {
              chunkId: null,
              content: hit.text,
              pageNum: hit.pageNum,
              lineNum: hit.lineNum,
              section: hit.section,
              charStart: 0,
              charEnd: hit.text.length,
              similarity: null,
            }
          : (ranking.passages.get(item.id) ?? null),
      }
    }),
    total: ordered.length,
    hasMore: skip + take < ordered.length,
    semantic: ranking.semantic,
    keywordCount: ranking.keywordCount,
    semanticCount: ranking.semanticCount,
  }
}

/**
 * Coverage of the semantic index for one owner.
 *
 * Feeds the search UI's explanation when semantic results look thin: a drive
 * whose documents were uploaded before chunked indexing shipped, or whose
 * embeddings never completed, will keyword-match fine while returning nothing
 * from the dense half. Without this the UI can only show an empty list, which
 * reads as "no matches" rather than "not indexed yet".
 *
 * Raw SQL because `vector` is an `Unsupported` column — Prisma can neither
 * select nor filter on it, so `vector IS NULL` is not expressible in the
 * query builder.
 */
export async function getSearchIndexStats(ownerId: string): Promise<{
  indexedChunks: number
  pendingChunks: number
  indexedItems: number
}> {
  const [row] = await prisma.$queryRaw<
    { indexed: bigint; pending: bigint; items: bigint }[]
  >`
    SELECT
      COUNT(*) FILTER (WHERE c."vector" IS NOT NULL)     AS "indexed",
      COUNT(*) FILTER (WHERE c."vector" IS NULL)         AS "pending",
      COUNT(DISTINCT c."itemId") FILTER (WHERE c."vector" IS NOT NULL) AS "items"
    FROM "SearchChunk" c
    JOIN "Item" i ON i."id" = c."itemId"
    WHERE i."ownerId" = ${ownerId}
      AND i."status" = 'normal'
  `

  return {
    indexedChunks: Number(row?.indexed ?? 0),
    pendingChunks: Number(row?.pending ?? 0),
    indexedItems: Number(row?.items ?? 0),
  }
}
