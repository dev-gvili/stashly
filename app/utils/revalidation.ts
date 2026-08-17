/**
 * Shared `shouldRevalidate` predicates.
 *
 * React Router revalidates every active loader after any fetcher submission,
 * which is the right default: most mutations change what is on screen. Some
 * do not, and background indexing is the clearest case — OCR text and its
 * embeddings feed the search index, never the item list.
 *
 * It became expensive once OCR started saving per page: a 15-page document
 * submits ~30 times, and each submission re-ran the current route's loader
 * *and* the thumbnail presign loader. Sixty round trips that could not change
 * a pixel.
 *
 * Kept as a predicate rather than a full `ShouldRevalidateFunction` so routes
 * can compose it with their own rules instead of choosing between them.
 */

/**
 * Intents that only touch the search index.
 *
 * `save_media_metadata` is deliberately absent: it writes facets (page count,
 * dimensions, EXIF) that a card can display, so it must still revalidate.
 */
const SEARCH_INDEX_INTENTS: ReadonlySet<string> = new Set([
  'save_ocr_page',
  'save_search_chunk_embeddings',
])

/**
 * True when a submission only writes to the search index.
 *
 * @example
 * export const shouldRevalidate: ShouldRevalidateFunction = (args) => {
 *   if (isSearchIndexSubmission(args.formData)) return false
 *   return args.defaultShouldRevalidate
 * }
 */
export function isSearchIndexSubmission(
  formData: FormData | undefined | null
): boolean {
  const intent = formData?.get('intent')
  return typeof intent === 'string' && SEARCH_INDEX_INTENTS.has(intent)
}
