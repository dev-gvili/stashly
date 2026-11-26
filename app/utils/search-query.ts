/**
 * Pure query-side search helpers.
 *
 * Deliberately free of Prisma, `fetch` and DOM so both halves of the search
 * feature can share them and they can be unit tested without a database:
 *
 *   • server — `app/.server/search-actions.ts` (rank fusion, vector literals)
 *   • client — `app/hooks/useItemSearch.ts` (thresholds, snippet rendering)
 *
 * Mirrors the `embedding-backfill.ts` / `useEmbeddingBackfill.ts` split on the
 * index side.
 */

/** Dimension of every stored vector. Tied to MPNet — see `embedding.ai.ts`. */
export const SEARCH_VECTOR_DIM = 768

/** Shortest query worth running at all. One char matches half the drive. */
export const MIN_QUERY_LENGTH = 2

/**
 * Shortest query worth *embedding*. Dense retrieval on a 2-char fragment is
 * noise — the vector for "re" is nowhere near the vector for "revenue report"
 * — while trigram matching handles short prefixes well. Below this we skip the
 * model entirely rather than pay a GPU round trip for a worse ranking.
 */
export const SEMANTIC_MIN_LENGTH = 4

/** Default page size for a search request. */
export const SEARCH_PAGE_SIZE = 25

/** Hard ceiling on a client-supplied page size. */
export const SEARCH_MAX_TAKE = 100

/**
 * How deep each ranker goes before fusion. Both lists are truncated to this
 * before RRF, so a document ranked #300 by one signal can't be dragged into
 * the results by a mediocre showing in the other.
 */
export const RANK_DEPTH = 100

/**
 * RRF's smoothing constant. 60 is the value from Cormack et al. (2009) and
 * what Elastic/OpenSearch ship as their default — it damps the top of each
 * list so rank #1 doesn't dominate a document that both rankers liked.
 */
export const RRF_K = 60

/** Why a search fell back from semantic to keyword-only. */
export type SearchDegradedReason =
  | 'query_too_short'
  | 'no_webgpu'
  | 'embedding_failed'
  | 'request_failed'

/** Lifecycle of a search request, for driving the view's states. */
export type SearchStatus = 'idle' | 'keyword' | 'upgrading' | 'ready' | 'error'

/**
 * Collapse whitespace and trim. Applied on both sides so the client's
 * "did this change?" check and the server's cache key agree on the string.
 */
export function normalizeQuery(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim()
}

/** Whether a query is worth sending to the server at all. */
export function isSearchableQuery(raw: string): boolean {
  return normalizeQuery(raw).length >= MIN_QUERY_LENGTH
}

/**
 * Whether a query should also be embedded for dense retrieval.
 *
 * @example
 * shouldEmbedQuery('tax')                  // false — trigrams do this better
 * shouldEmbedQuery('what is our refund policy') // true
 */
export function shouldEmbedQuery(raw: string): boolean {
  return normalizeQuery(raw).length >= SEMANTIC_MIN_LENGTH
}

/**
 * Reciprocal Rank Fusion.
 *
 * Combines ranked lists that have no comparable score scale — a trigram
 * similarity of 0.4 and a cosine distance of 0.22 mean nothing to each other,
 * but their *positions* do. Each list contributes `1 / (k + rank)` per
 * document and the sums are sorted descending, so a document both rankers
 * placed mid-list beats one that only a single ranker loved.
 *
 * Ranks are 1-based. Ids missing from a list simply contribute nothing.
 *
 * @example
 * reciprocalRankFusion([['a', 'b'], ['b', 'c']])
 * // b first (present in both), then a and c
 */
export function reciprocalRankFusion(
  rankedLists: string[][],
  options: { k?: number; limit?: number } = {},
): { id: string; score: number }[] {
  const { k = RRF_K, limit } = options
  const scores = new Map<string, number>()

  for (const list of rankedLists) {
    list.forEach((id, index) => {
      const contribution = 1 / (k + index + 1)
      scores.set(id, (scores.get(id) ?? 0) + contribution)
    })
  }

  const fused = [...scores.entries()]
    .map(([id, score]) => ({ id, score }))
    // Ties broken by id so pagination is stable across requests — two
    // documents with identical fused scores must not swap places between
    // page 1 and page 2.
    .sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1))

  return limit === undefined ? fused : fused.slice(0, limit)
}

/** A passage window with the matched terms located inside it. */
export interface SearchSnippet {
  /** The extracted window of text. */
  text: string
  /** Whether text was dropped from the start / end of the passage. */
  truncatedStart: boolean
  truncatedEnd: boolean
  /** Match offsets *within `text`*, ready to wrap in `<mark>`. */
  matches: { start: number; end: number }[]
}

/** True for characters that can sit inside a word. */
function isWordChar(char: string): boolean {
  return char !== '' && /[\p{L}\p{N}]/u.test(char)
}

/**
 * Terms worth highlighting: 2+ chars, deduped, lowercased.
 *
 * Only *leading and trailing* punctuation is trimmed — internal punctuation is
 * kept. Stripping it everywhere turned `browser-side` into `browserside`,
 * which then matched nothing, because the passage still contains the hyphen.
 */
function queryTerms(query: string): string[] {
  const seen = new Set<string>()
  for (const term of normalizeQuery(query).toLowerCase().split(' ')) {
    const cleaned = term
      .replace(/^[^\p{L}\p{N}]+/u, '')
      .replace(/[^\p{L}\p{N}]+$/u, '')
    if (cleaned.length >= MIN_QUERY_LENGTH) seen.add(cleaned)
  }
  return [...seen]
}

/**
 * Find every occurrence of any query term in `haystack` (already lowercased),
 * as absolute offsets, sorted and non-overlapping.
 *
 * A match must begin on a word boundary. Without that check a short term
 * highlights inside unrelated words — `AI` lit up the middle of `chain` and
 * `thumbnails`, which reads as broken rather than helpful.
 *
 * The *end* is deliberately not boundary-checked, so a term still highlights
 * as a prefix: searching `infer` marks the start of `inference`. That keeps
 * partial-word typing useful while killing the mid-word noise.
 */
function findMatches(
  haystack: string,
  terms: string[],
): { start: number; end: number }[] {
  const hits: { start: number; end: number }[] = []
  for (const term of terms) {
    let from = 0
    while (from <= haystack.length - term.length) {
      const at = haystack.indexOf(term, from)
      if (at === -1) break
      if (!isWordChar(at > 0 ? haystack[at - 1] : '')) {
        hits.push({ start: at, end: at + term.length })
      }
      from = at + term.length
    }
  }
  hits.sort((a, b) => a.start - b.start || a.end - b.end)

  // Merge overlaps so "report" and "port" don't produce nested highlights.
  const merged: { start: number; end: number }[] = []
  for (const hit of hits) {
    const last = merged[merged.length - 1]
    if (last && hit.start <= last.end) last.end = Math.max(last.end, hit.end)
    else merged.push({ ...hit })
  }
  return merged
}

/**
 * Cut a readable window out of a matched passage, centred on the first hit.
 *
 * A chunk is ~1500 chars; a result card can show ~250. Showing the first 250
 * would often miss the very sentence that matched, so centre on the earliest
 * term occurrence and snap the edges to word boundaries. Falls back to the
 * head of the passage when nothing matches literally — which is normal for a
 * semantic hit, where the passage is *about* the query without containing it.
 *
 * @example
 * buildSnippet('…our refund policy allows 30 days…', 'refund policy')
 * // → { text: '…our refund policy allows 30 days…', matches: [{ start, end }] }
 */
export function buildSnippet(
  passage: string,
  query: string,
  options: { maxLength?: number; leading?: number } = {},
): SearchSnippet {
  const { maxLength = 260, leading = 60 } = options
  const text = passage.replace(/\s+/g, ' ').trim()

  if (text.length <= maxLength) {
    return {
      text,
      truncatedStart: false,
      truncatedEnd: false,
      matches: findMatches(text.toLowerCase(), queryTerms(query)),
    }
  }

  const terms = queryTerms(query)
  const allMatches = findMatches(text.toLowerCase(), terms)
  const first = allMatches[0]

  // No literal hit (typical for semantic matches) — show the opening.
  let start = 0
  if (first) start = Math.max(0, first.start - leading)

  // Snap the left edge forward to a word boundary so we don't open mid-word.
  if (start > 0) {
    const space = text.indexOf(' ', start)
    if (space !== -1 && space - start < 20) start = space + 1
  }

  let end = Math.min(text.length, start + maxLength)
  // Snap the right edge back to a word boundary.
  if (end < text.length) {
    const space = text.lastIndexOf(' ', end)
    if (space > start && end - space < 20) end = space
  }

  const windowed = text.slice(start, end).trim()
  return {
    text: windowed,
    truncatedStart: start > 0,
    truncatedEnd: end < text.length,
    matches: findMatches(windowed.toLowerCase(), terms),
  }
}

/**
 * A sentence ends at `.`, `!`, `?` or `…` (with any closing quote or bracket)
 * followed by whitespace. Requiring the whitespace keeps `3.5`, `search.prisma`
 * and `e.g.x` whole; an abbreviation followed by a space still splits, which
 * only ever shortens the window.
 */
const SENTENCE_END = /[.!?…]["'”’)\]]*\s+/g

/**
 * Longest excerpt a result card shows, in characters. Short enough to sit in
 * the card's fixed-height snippet box (owner, 26 Nov: 250 overflowed it).
 */
export const SENTENCE_SNIPPET_MAX_LENGTH = 128

/**
 * Cut whole sentences out of a matched passage, within the paragraph holding
 * the first hit (paragraphs split on blank lines):
 * the sentence holding the hit, then the following one while the two stay within `maxLength`
 * ({@link SENTENCE_SNIPPET_MAX_LENGTH}). At most `maxSentences` (2), so the evidence reads as a
 * statement rather than a slab.
 *
 * A sentence longer than the cap on its own falls back to `buildSnippet`'s
 * word-boundary window around the hit. With no literal hit (a semantic match)
 * it opens on the first sentence.
 *
 * @example
 * buildSentenceSnippet('Intro. The vector index is HNSW. It is fast. More.', 'vector')
 * // → { text: 'The vector index is HNSW. It is fast.', truncatedStart: true, truncatedEnd: true, … }
 */
export function buildSentenceSnippet(
  passage: string,
  query: string,
  options: { maxLength?: number; maxSentences?: number } = {},
): SearchSnippet {
  const { maxLength = SENTENCE_SNIPPET_MAX_LENGTH, maxSentences = 2 } = options
  const terms = queryTerms(query)

  // Stay inside the paragraph holding the hit, so an excerpt never runs on
  // into unrelated blocks (OCR'd slides, tables, headings).
  const paragraphs = passage
    .split(PARAGRAPH_BREAK)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
  if (paragraphs.length === 0) return buildSnippet('', query, { maxLength })
  const at = Math.max(0, paragraphs.findIndex((p) => findMatches(p.toLowerCase(), terms).length > 0))
  const scoped = sentenceWindow(paragraphs[at], terms, query, maxLength, maxSentences)
  return {
    ...scoped,
    truncatedStart: scoped.truncatedStart || at > 0,
    truncatedEnd: scoped.truncatedEnd || at < paragraphs.length - 1,
  }
}

/** A blank line: what separates paragraphs in extracted and OCR'd text. */
const PARAGRAPH_BREAK = /\r?\n[ \t]*\r?\n/

function sentenceWindow(
  text: string,
  terms: string[],
  query: string,
  maxLength: number,
  maxSentences: number,
): SearchSnippet {
  const firstHit = findMatches(text.toLowerCase(), terms)[0]

  const spans: { start: number; end: number }[] = []
  let from = 0
  for (const m of text.matchAll(SENTENCE_END)) {
    spans.push({ start: from, end: m.index + m[0].trimEnd().length })
    from = m.index + m[0].length
  }
  if (from < text.length) spans.push({ start: from, end: text.length })
  if (spans.length === 0) return buildSnippet(text, query, { maxLength })

  const at = firstHit?.start ?? 0
  let index = 0
  for (let i = 0; i < spans.length; i++) if (spans[i].start <= at) index = i

  const first = spans[index]
  if (first.end - first.start > maxLength) {
    return buildSnippet(text, query, { maxLength, leading: 80 })
  }

  let end = first.end
  for (let k = 1; k < maxSentences && index + k < spans.length; k++) {
    const next = spans[index + k]
    if (next.end - first.start > maxLength) break
    end = next.end
  }

  const windowed = text.slice(first.start, end)
  return {
    text: windowed,
    truncatedStart: first.start > 0,
    truncatedEnd: end < text.length,
    matches: findMatches(windowed.toLowerCase(), terms),
  }
}

/**
 * Where each literal hit starts in a document body: every occurrence of every
 * term, case-insensitively, sorted, with a repeat at the same offset dropped
 * (`vector` and `vectors` starting together are one place to jump to).
 *
 * A hit must start a word, the rule the excerpt highlighter uses
 * (`findMatches`), so every stop has a highlighted hit: `vectors` inside
 * `setSearchChunkVectors` is skipped. The server's hit counter
 * (`fetchMatchDetails`) counts by the same rule, so the arrows' "k/N" agrees
 * with the card's count before and after they load.
 *
 * @example
 * findHitOffsets('The vectors and a vector', ['vector', 'vectors']) // → [4, 18]
 */
export function findHitOffsets(body: string, terms: string[]): number[] {
  if (!body || terms.length === 0) return []
  const needles = terms.map((t) => t.toLowerCase()).filter(Boolean)
  return findMatches(body.toLowerCase(), needles).map((m) => m.start)
}

/**
 * Characters kept before a hit, and the window's length (as `fetchMatchDetails`).
 * The excerpt cut from it is at most 250 characters, so 250 either side of the
 * hit holds any sentence the excerpt can show.
 */
const HIT_WINDOW_LEAD = 250
const HIT_WINDOW_LENGTH = 500
const NEWLINE = String.fromCharCode(10)

/**
 * The text around one hit, cut the way the first-hit query cuts it (250
 * before, 500 long), so a stepped-to passage reads like the first one. The
 * line is 1-based and reported only when the body has line breaks at all; the
 * column, 1-based too, with it (as `fetchMatchDetails` computes `hitColumn`).
 *
 * @example
 * hitPassageWindow(body, body.indexOf('HIT')) // → { content: '…HIT…', lineNum: 3, column: 7 }
 */
export function hitPassageWindow(
  body: string,
  offset: number,
): { content: string; lineNum: number | null; column: number | null } {
  // No snapping to a sentence here: `buildSentenceSnippet` finds the sentence,
  // and a window cut differently from the SQL one would show the first stop
  // with a different leading "…" than the result arrived with.
  const start = Math.max(0, offset - HIT_WINDOW_LEAD)
  const content = body.slice(start, start + HIT_WINDOW_LENGTH)
  const lined = body.includes(NEWLINE)
  const lineNum = lined ? body.slice(0, offset).split(NEWLINE).length : null
  // Characters since the newline before the hit; -1 (none) gives offset + 1.
  const column = lined ? offset - body.lastIndexOf(NEWLINE, offset - 1) : null
  return { content, lineNum, column }
}

/** URL param that limits a search to one folder's subtree or one collection. */
export const SEARCH_SCOPE_KEY = 'in'

/** Where a search looks: a folder (its whole subtree) or a collection. */
export type SearchScope = { kind: 'folder' | 'collection'; id: string }

/**
 * Read `?in=folder:<id>` / `?in=collection:<id>`. Anything else is no scope,
 * so a malformed value widens the search to the whole stash rather than
 * erroring: the param is a convenience, not a security boundary (the server
 * checks access to the scope item on its own).
 *
 * @example
 * parseSearchScope('folder:fol_abc') // { kind: 'folder', id: 'fol_abc' }
 * parseSearchScope('nope')           // null
 */
export function parseSearchScope(raw: string | null | undefined): SearchScope | null {
  if (!raw) return null
  const at = raw.indexOf(':')
  if (at < 1) return null
  const kind = raw.slice(0, at)
  const id = raw.slice(at + 1).trim()
  if ((kind !== 'folder' && kind !== 'collection') || !id) return null
  return { kind, id }
}

/** The `?in=` value for a scope; inverse of {@link parseSearchScope}. */
export function formatSearchScope(scope: SearchScope): string {
  return `${scope.kind}:${scope.id}`
}

/**
 * Clamp a caller-supplied page size into `[1, SEARCH_MAX_TAKE]`.
 *
 * The value arrives as an untrusted URL param: absent, `''`, `'abc'`, `'-5'`
 * and `'1e9'` all have to land somewhere sane rather than reaching SQL as
 * `LIMIT NaN`.
 */
export function clampTake(raw: string | number | null | undefined): number {
  if (raw === null || raw === undefined || raw === '') return SEARCH_PAGE_SIZE
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) return SEARCH_PAGE_SIZE
  const truncated = Math.trunc(parsed)
  if (truncated < 1) return 1
  return Math.min(truncated, SEARCH_MAX_TAKE)
}

/**
 * Validate an untrusted embedding and render it as a pgvector literal.
 *
 * The vector is generated in the browser and posted back, so it is user
 * input: every element has to be a finite number and the length has to match
 * the column, or the `::vector` cast fails inside the query with a Postgres
 * error rather than a clean 400.
 *
 * @throws if the shape is wrong — callers should map this to a 400.
 */
export function toVectorLiteral(
  vector: unknown,
  dim: number = SEARCH_VECTOR_DIM,
): string {
  if (!Array.isArray(vector)) {
    throw new Error('Expected an array of numbers')
  }
  if (vector.length !== dim) {
    throw new Error(`Expected ${dim}-dim vector, got ${vector.length}`)
  }
  for (const value of vector) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error('Vector contains a non-finite value')
    }
  }
  return `[${vector.join(',')}]`
}
