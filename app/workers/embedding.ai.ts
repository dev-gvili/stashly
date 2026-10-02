/**
 * Browser-side text embedding via `Xenova/all-mpnet-base-v2` on WebGPU.
 *
 * 768-dim vectors matching `Search.vector` / `SearchChunk.vector` schema.
 * Mean pooling + L2 normalization, the recommended config for MPNet — output
 * vectors can be compared with cosine similarity directly (or dot product,
 * which is equivalent on normalized vectors).
 *
 * Despite the file living under `app/workers/`, this is a regular module
 * (matches `thumbnail.ai.ts`'s pattern). It runs on the main thread but
 * offloads compute to WebGPU, so it doesn't block the UI for inference.
 * Job ordering is shared with image AI through `ai-queue.ts`.
 */
import {
  pipeline,
  type FeatureExtractionPipeline,
  type ProgressCallback,
} from '@huggingface/transformers'
import { createDebouncer } from '@/utils/debounce'
import { enqueue, type AiPriority } from './ai-queue'

const MODEL_ID = 'Xenova/all-mpnet-base-v2'
export const EMBEDDING_DIM = 768

/**
 * The most texts one model call is given.
 *
 * GPU memory grows with batch size × sequence length²: the attention scores
 * alone take batch × 12 heads × 512 × 512 × 4 bytes, about 12.6 MB per text.
 * Embedding a whole file in one call asked WebGPU for one 4,253,024,256-byte
 * buffer for a 338-chunk file — over the 2 GiB per-buffer limit, so it failed,
 * and every embedding after it in the tab failed the same way. A 170-chunk
 * file fit under the limit and took the GPU process from about 5 GB to
 * 10.9 GB (both measured 2 Oct 2026). At 16 that tensor is about 201 MB.
 */
export const EMBED_BATCH_SIZE = 16

/**
 * How long the model stays loaded after it was last used.
 *
 * On integrated graphics every byte the GPU holds is system RAM, and a loaded
 * model plus its buffers kept Chrome's GPU process at about 2.9 GB after
 * indexing had finished, until the tab closed (measured 2 Oct 2026). A minute
 * covers the gaps between files in an upload and between search queries;
 * after that the memory goes back, and the next call pays one reload.
 */
export const EMBEDDING_IDLE_RELEASE_MS = 60_000

let pipelinePromise: Promise<FeatureExtractionPipeline> | null = null

/** When a batch last ran, so a release that was queued late can see it was used since. */
let lastUsedAt = 0

/** Fires `releaseEmbeddingModel` once the model has gone unused for the idle period. */
const idleRelease = createDebouncer()

async function getPipeline(
  onProgress?: ProgressCallback,
): Promise<FeatureExtractionPipeline> {
  if (!pipelinePromise) {
    pipelinePromise = pipeline('feature-extraction', MODEL_ID, {
      device: 'webgpu',
      dtype: 'q4',
      progress_callback: onProgress,
    })
  }
  return pipelinePromise
}

/**
 * Unloads the embedding model and frees its GPU memory. The next embedding
 * loads it again.
 *
 * Runs as an AI-queue job at `'background'` priority, so it can never dispose
 * the model under a running inference, and waiting embeddings go first.
 *
 * @param options.onlyIfIdle - Set by the idle timer: skip the release if the
 *   model was used again while this job waited in the queue. That use has
 *   scheduled its own release.
 *
 * @example
 * await releaseEmbeddingModel() // free the GPU memory now
 */
export async function releaseEmbeddingModel(
  options: { onlyIfIdle?: boolean } = {},
): Promise<void> {
  if (!options.onlyIfIdle) idleRelease.cancel()
  await enqueue(async () => {
    if (!pipelinePromise) return
    const usedSince = Date.now() - lastUsedAt < EMBEDDING_IDLE_RELEASE_MS
    if (options.onlyIfIdle && usedSince) return
    const loading = pipelinePromise
    pipelinePromise = null
    lastUsedAt = 0
    const extractor = await loading.catch(() => null)
    await extractor?.dispose()
  }, 'background')
}

/**
 * Embeds text passages, any number of them. Returns one 768-dim vector per
 * input, in input order, pre-normalized for cosine/dot-product similarity.
 *
 * The texts go to the GPU `EMBED_BATCH_SIZE` at a time, each batch its own job
 * on the shared AI queue. Small batches keep GPU memory bounded; separate jobs
 * let a waiting search query run between them instead of behind the whole
 * file, since a running job is never preempted.
 *
 * @param texts - The passages to embed.
 * @param onProgress - Model download progress, on first use.
 * @param priority - Queue priority. Index-time work leaves this at
 *   `'default'`; a search query passes `'interactive'` so it isn't stuck behind
 *   a long background job like OCR on a scanned document.
 * @returns One vector per text, in the same order.
 *
 * @example
 * const vectors = await embedTexts(chunks.map((c) => c.content))
 */
export async function embedTexts(
  texts: string[],
  onProgress?: ProgressCallback,
  priority: AiPriority = 'default',
): Promise<number[][]> {
  const vectors: number[][] = []
  try {
    for (let start = 0; start < texts.length; start += EMBED_BATCH_SIZE) {
      const batch = texts.slice(start, start + EMBED_BATCH_SIZE)
      const batchVectors = await enqueue(
        () => embedOneBatch(batch, onProgress),
        priority,
      )
      vectors.push(...batchVectors)
    }
    return vectors
  } finally {
    // Restarted by every call, so the model stays loaded through a steady
    // stream of work and is released once it stops.
    if (texts.length > 0) {
      idleRelease.call(
        () => void releaseEmbeddingModel({ onlyIfIdle: true }),
        EMBEDDING_IDLE_RELEASE_MS,
      )
    }
  }
}

/**
 * Runs the model once over at most `EMBED_BATCH_SIZE` texts. Must run inside
 * an AI-queue job: it touches the GPU.
 *
 * @param texts - At most `EMBED_BATCH_SIZE` passages.
 * @param onProgress - Model download progress, on first use.
 * @returns One vector per text, in the same order.
 */
async function embedOneBatch(
  texts: string[],
  onProgress?: ProgressCallback,
): Promise<number[][]> {
  const extractor = await getPipeline(onProgress)
  const output = await extractor(texts, { pooling: 'mean', normalize: true })
  lastUsedAt = Date.now()

  // Output shape: [batchSize, 768] flattened. Reshape via dims.
  const dims = output.dims
  const data = output.data as Float32Array
  if (dims.length === 1) {
    // Single-input case (rare — depends on Transformers.js version)
    return [Array.from(data)]
  }
  const [batchSize, vecSize] = dims
  const result: number[][] = []
  for (let i = 0; i < batchSize; i++) {
    const start = i * vecSize
    result.push(Array.from(data.subarray(start, start + vecSize)))
  }
  return result
}

/**
 * Embed a single string. Convenience wrapper around `embedTexts([text])`.
 *
 * Defaults to `'interactive'`: the only single-string caller is the search
 * query path, where someone is watching a spinner. Batch callers (indexing,
 * backfill) go through `embedTexts` and stay at `'default'`.
 */
export async function embedText(
  text: string,
  onProgress?: ProgressCallback,
  priority: AiPriority = 'interactive',
): Promise<number[]> {
  const [vec] = await embedTexts([text], onProgress, priority)
  return vec
}
