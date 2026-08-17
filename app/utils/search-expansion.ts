/**
 * Query expansion for the search page's second highlight tier.
 *
 * A semantic result contains none of the words the user typed — that is what
 * makes it semantic — so its snippet renders with nothing marked, and the card
 * silently declines to explain why it is in the list at all. The dotted tier
 * answers that: it marks the words in the passage that the *query vector*
 * matched, so "Prisma" can be shown as the reason a search for "data model"
 * found the file, without ever being mistaken for something the user typed.
 *
 * The work is done client-side and after the fact. The query vector already
 * exists there (the semantic pass built it), the model is already warm, and
 * nothing on screen depends on the answer — results paint first and gain their
 * dotted marks a moment later.
 *
 * Pure functions only: no model, no fetch. `useItemSearch` supplies the
 * vectors, which keeps every scoring decision here unit-testable.
 */

/**
 * Words too common to be evidence of anything. Broader than the tokenizer's
 * list in `search-helpers`, because that one only has to avoid marking noise
 * the user typed, while this one is choosing what to *promote*.
 */
const COMMON_WORDS = new Set([
  'about', 'above', 'after', 'again', 'against', 'because', 'been', 'before',
  'being', 'below', 'between', 'both', 'cannot', 'could', 'does', 'doing',
  'down', 'during', 'each', 'from', 'further', 'have', 'having', 'here',
  'into', 'itself', 'more', 'most', 'once', 'only', 'other', 'over', 'own',
  'same', 'should', 'some', 'such', 'than', 'that', 'their', 'them', 'then',
  'there', 'these', 'they', 'this', 'those', 'through', 'under', 'until',
  'very', 'were', 'what', 'when', 'where', 'which', 'while', 'will', 'with',
  'would', 'your', 'also', 'just', 'like', 'make', 'made', 'many', 'much',
  'must', 'need', 'said', 'says', 'used', 'uses', 'using', 'well', 'when',
])

/** Shortest word worth proposing. Below this, matches are mostly noise. */
const MIN_TERM_LENGTH = 4

/** How many distinct words get embedded per search. One batch, so keep it small. */
export const EXPANSION_MAX_CANDIDATES = 24

/** How many expansions may be marked. More than a few turns a snippet into soup. */
export const EXPANSION_MAX_TERMS = 6

/**
 * Cosine floor for calling a word an expansion.
 *
 * A single word compared against a multi-word query scores well below the
 * similarity two sentences reach, so this sits lower than a general-purpose
 * threshold would. Deliberately conservative in the other direction too: a
 * false expansion is worse than a missing one, because it claims the engine
 * matched on a word it did not.
 */
export const EXPANSION_MIN_SIMILARITY = 0.35

/** Strip punctuation from both ends, preserving inner marks like `pg_trgm`. */
function normalizeWord(raw: string): string {
  return raw.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '').toLowerCase()
}

/**
 * The query's own words, for excluding them from the candidate pool.
 *
 * Intentionally looser than `tokenizeQuery` in the view layer: that one picks
 * what to *mark*, so it drops short words, while this one decides what to
 * *exclude*, where dropping a word would let it come back as its own
 * expansion.
 */
export function queryWords(query: string): string[] {
  return query
    .split(/\s+/)
    .map(normalizeWord)
    .filter(Boolean)
}

/**
 * Whether a candidate overlaps a term the user typed.
 *
 * Substring either way, not equality: if the query is "model" then "models"
 * must not become a candidate, because `highlightSegments` would already mark
 * the "model" inside it as a literal hit — leaving one word wearing both
 * tiers at once.
 */
function overlapsQuery(candidate: string, queryTerms: string[]): boolean {
  return queryTerms.some(
    (term) => candidate.includes(term) || term.includes(candidate)
  )
}

/**
 * Distinct words from the result passages that could be expansions.
 *
 * Ranked by how many passages contain them rather than raw frequency: a word
 * repeated forty times in one document describes that document, while a word
 * present in four different results describes the *query*, which is what an
 * expansion is meant to be.
 *
 * @example
 * collectCandidateTerms(['Prisma models the rows'], ['data', 'model'])
 * // → ['prisma', 'rows']
 */
export function collectCandidateTerms(
  passages: string[],
  queryTerms: string[],
  limit = EXPANSION_MAX_CANDIDATES
): string[] {
  const documentCount = new Map<string, number>()

  for (const passage of passages) {
    if (!passage) continue
    const seen = new Set<string>()
    for (const raw of passage.split(/[\s,;:.!?()[\]{}"'`/\\|<>]+/)) {
      const word = normalizeWord(raw)
      if (word.length < MIN_TERM_LENGTH) continue
      if (COMMON_WORDS.has(word)) continue
      if (/^\d+$/.test(word)) continue
      if (overlapsQuery(word, queryTerms)) continue
      seen.add(word)
    }
    for (const word of seen) {
      documentCount.set(word, (documentCount.get(word) ?? 0) + 1)
    }
  }

  return [...documentCount.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([word]) => word)
}

/**
 * Cosine similarity of two pre-normalized vectors.
 *
 * `embedTexts` normalizes its output, so the dot product *is* the cosine and
 * the magnitudes never have to be recomputed.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0
  let sum = 0
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i]
  return sum
}

/**
 * Keep the candidates the query vector actually matched.
 *
 * @param candidates Words, aligned index-for-index with `vectors`.
 * @param vectors One embedding per candidate.
 * @param queryVector The embedded query.
 *
 * @example
 * pickExpandedTerms(['prisma', 'lunch'], [vecA, vecB], queryVec)
 * // → ['prisma']
 */
export function pickExpandedTerms(
  candidates: string[],
  vectors: number[][],
  queryVector: number[],
  options: { minSimilarity?: number; max?: number } = {}
): string[] {
  const {
    minSimilarity = EXPANSION_MIN_SIMILARITY,
    max = EXPANSION_MAX_TERMS,
  } = options

  // A vector count that doesn't line up means the two lists are no longer
  // aligned, and pairing a word with someone else's embedding would mark
  // arbitrary text. Refusing outright is the only safe reading.
  if (vectors.length !== candidates.length) return []
  if (!queryVector?.length) return []

  return candidates
    .map((term, index) => ({
      term,
      similarity: cosineSimilarity(queryVector, vectors[index]),
    }))
    .filter((entry) => entry.similarity >= minSimilarity)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, max)
    .map((entry) => entry.term)
}
