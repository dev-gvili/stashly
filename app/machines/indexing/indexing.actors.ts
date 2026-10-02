/**
 * The async steps of indexing one file, one actor per step.
 *
 * Each actor does exactly one thing: read the file, or call one endpoint, or
 * run one model. The order, the retries and what a failure means live in
 * `indexing-item.machine.ts`, not here.
 *
 * Every HTTP call is a plain `fetch`, never a React Router fetcher. A fetcher
 * would re-run every loader on the page after each submit, and these writes
 * happen several times per file. The one write the page shows
 * (`save_media_metadata`) is turned into a single page reload per batch by
 * `useIndexingRevalidation`.
 *
 * Convention: an actor throws when a retry could plausibly succeed (network,
 * 5xx) and returns normally otherwise.
 */
import { fromPromise } from 'xstate'
import {
  extractMediaMetadata,
  buildMediaMetadataFormData,
  type MediaMetadata,
} from '@/utils/thumbnail-pipeline'
import type { SearchChunkDraft } from './indexing.types'

/**
 * Reads metadata out of the file in the compute worker: image dimensions and
 * EXIF, PDF text and page count, markdown facets, audio tags. Nothing is sent
 * anywhere.
 *
 * @example
 * invoke: { src: 'readMetadataFromFile', input: ({ context }) => ({ file: context.file }) }
 */
export const readMetadataFromFile = fromPromise<MediaMetadata, { file: File }>(
  ({ input }) => extractMediaMetadata(input.file)
)

/**
 * Saves the metadata facets and the file's text, and returns the
 * `SearchChunk` rows the server cut that text into.
 *
 * `POST /api/items` with `intent=save_media_metadata`. `needsOcr` never reaches
 * the server: `buildMediaMetadataFormData` drops it as a client-only flag.
 *
 * @throws On a non-2xx response, so the machine's retry budget applies.
 * @example
 * invoke: { src: 'saveMetadataToServer', input: ({ context }) => ({ itemId, metadata }) }
 */
export const saveMetadataToServer = fromPromise<
  SearchChunkDraft[],
  { itemId: string; metadata: MediaMetadata }
>(async ({ input, signal }) => {
  const body = buildMediaMetadataFormData(input.itemId, input.metadata)
  const res = await fetch('/api/items', { method: 'POST', body, signal })
  if (!res.ok) throw new Error(`save_media_metadata failed: ${res.status}`)
  const data = (await res.json().catch(() => null)) as {
    chunks?: SearchChunkDraft[]
  } | null
  return data?.chunks ?? []
})

/**
 * Turns each chunk's text into a 768-dimension vector on the GPU.
 *
 * Runs through the shared WebGPU queue (`ai-queue.ts`) at `'default'`
 * priority, behind search queries and alongside OCR and salient crops. Every
 * chunk of the file goes in one call today, which for a large file is one big
 * GPU batch (338 chunks for a 400 KB source file); splitting it is tracked
 * separately and needs a before/after measurement first.
 *
 * @returns One vector per chunk, in chunk order.
 * @example
 * invoke: { src: 'embedChunksOnGpu', input: ({ context }) => ({ chunks: context.chunks }) }
 */
export const embedChunksOnGpu = fromPromise<
  number[][],
  { chunks: SearchChunkDraft[] }
>(async ({ input }) => {
  const { embedTexts } = await import('@/workers/embedding.ai')
  return embedTexts(input.chunks.map((chunk) => chunk.content))
})

/**
 * Stores the vectors against their chunks.
 *
 * `POST /api/items` with `intent=save_search_chunk_embeddings`. Vectors are
 * matched to chunks by position, so the caller must only pass a vector list
 * whose length equals the chunk list's.
 *
 * @throws On a non-2xx response, so the machine's retry budget applies.
 * @example
 * invoke: { src: 'saveVectorsToServer', input: ({ context }) => ({ chunks, vectors }) }
 */
export const saveVectorsToServer = fromPromise<
  void,
  { chunks: SearchChunkDraft[]; vectors: number[][] }
>(async ({ input, signal }) => {
  await postVectors(input.chunks, input.vectors, signal)
})

/**
 * Reads a scanned PDF page by page with the OCR model, saving and embedding
 * each page as soon as it is read.
 *
 * One actor rather than a state per page on purpose: `streamOcrPdf` awaits the
 * per-page callback, so saving holds back rendering and only one decoded page
 * is in memory at a time. A page whose save or embedding fails is logged and
 * skipped; the pages already saved stay saved.
 *
 * @returns How many characters of text were read.
 * @example
 * invoke: { src: 'transcribeScannedPdf', input: ({ context }) => ({ itemId, file }) }
 */
export const transcribeScannedPdf = fromPromise<
  number,
  { itemId: string; file: File }
>(async ({ input, signal }) => {
  const { streamOcrPdf } = await import('@/utils/thumbnail-ocr')
  const { embedTexts } = await import('@/workers/embedding.ai')

  return streamOcrPdf(input.file, async (page) => {
    if (signal.aborted) return

    const body = new FormData()
    body.append('intent', 'save_ocr_page')
    body.append('itemId', input.itemId)
    body.append('pageNum', String(page.pageNum))
    body.append('text', page.text)
    const res = await fetch('/api/items', { method: 'POST', body, signal })
    if (!res.ok) return

    const data = (await res.json().catch(() => null)) as {
      chunks?: SearchChunkDraft[]
    } | null
    const chunks = data?.chunks ?? []
    if (chunks.length === 0) return

    try {
      const vectors = await embedTexts(chunks.map((chunk) => chunk.content))
      if (vectors.length !== chunks.length) {
        console.error(
          '[ocr page] vector count mismatch',
          input.itemId,
          page.pageNum
        )
        return
      }
      await postVectors(chunks, vectors, signal)
    } catch (e) {
      console.error('[ocr page embed]', input.itemId, page.pageNum, e)
    }
  })
})

/**
 * Sends `{ chunkId, vector }` pairs to `save_search_chunk_embeddings`.
 *
 * @param chunks - The chunks, in the same order as `vectors`.
 * @param vectors - One vector per chunk.
 * @param signal - Aborts the request when the machine stops.
 * @throws On a non-2xx response.
 */
async function postVectors(
  chunks: SearchChunkDraft[],
  vectors: number[][],
  signal: AbortSignal
): Promise<void> {
  const payload = chunks.map((chunk, i) => ({
    chunkId: chunk.id,
    vector: vectors[i],
  }))
  const body = new FormData()
  body.append('intent', 'save_search_chunk_embeddings')
  body.append('embeddings', JSON.stringify(payload))
  const res = await fetch('/api/items', { method: 'POST', body, signal })
  if (!res.ok) throw new Error(`save embeddings failed: ${res.status}`)
}
