/**
 * Browser-side text embedding via `Xenova/all-mpnet-base-v2` on WebGPU.
 *
 * 768-dim vectors matching `Search.vector` / `SearchChunk.vector` schema.
 * Mean pooling + L2 normalization, the recommended config for MPNet — output
 * vectors can be compared with cosine similarity directly (or dot product,
 * which is equivalent on normalized vectors).
 *
 * This module is the main-thread client. The model itself runs in a dedicated
 * worker (`embedding.worker.ts`), so loading it and setting up its ONNX
 * session no longer block the page: that was a 1,451 ms long task, then a
 * 766 ms one (measured 2026-09-25, tech-debt item 21). Each batch is still one
 * job on the shared `ai-queue`, which awaits the worker's reply, so the page's
 * other models and this one never use a GPU at the same time.
 */
import type { ProgressCallback } from '@huggingface/transformers'
import { createDebouncer } from '@/utils/debounce'
import { enqueue, isDeviceLostError, type AiPriority } from './ai-queue'
import type { EmbeddingRequest, EmbeddingResponse } from './embedding.worker'

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

/** When a batch last ran, so a release that was queued late can see it was used since. */
let lastUsedAt = 0

/** Fires `releaseEmbeddingModel` once the model has gone unused for the idle period. */
const idleRelease = createDebouncer()

// ── Worker client ─────────────────────────────────────────────────────────

interface PendingRequest {
  resolve: (vectors: number[][]) => void
  reject: (err: Error) => void
  onProgress?: ProgressCallback
}

/** The live worker, or null before first use and after a release. */
let worker: Worker | null = null
let nextRequestId = 1
const pending = new Map<number, PendingRequest>()

/** Rejects every request still waiting on a worker that is going away. */
function failPending(err: Error) {
  for (const request of pending.values()) request.reject(err)
  pending.clear()
}

/**
 * The embedding worker, started on first use. A worker that errors is
 * discarded, so the next call starts a fresh one.
 */
function getWorker(): Worker {
  if (worker) return worker
  if (typeof window === 'undefined') {
    throw new Error('Text embedding runs only in the browser')
  }
  const started = new Worker(new URL('./embedding.worker.ts', import.meta.url), {
    type: 'module',
  })
  started.onmessage = (event: MessageEvent<EmbeddingResponse>) => {
    const message = event.data
    const request = pending.get(message.id)
    if (!request) return
    if (message.type === 'progress') {
      request.onProgress?.(message.progress as Parameters<ProgressCallback>[0])
      return
    }
    pending.delete(message.id)
    if (message.type === 'result') {
      request.resolve(message.vectors)
      return
    }
    const err = new Error(message.message)
    request.reject(err)
    // The worker's pipeline is bound to the dead device and would fail every
    // later batch the same way. Ending it frees that device; the next batch
    // starts a fresh worker.
    if (isDeviceLostError(err)) {
      console.warn('[embedding] WebGPU device lost — restarting the worker')
      failPending(err)
      if (worker === started) worker = null
      started.terminate()
    }
  }
  started.onerror = (event) => {
    // A worker that failed to load, or threw outside a request, cannot be
    // trusted with the next one.
    failPending(new Error(`Embedding worker failed: ${event.message}`))
    if (worker === started) worker = null
    started.terminate()
  }
  worker = started
  return started
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
    if (!worker) return
    const usedSince = Date.now() - lastUsedAt < EMBEDDING_IDLE_RELEASE_MS
    if (options.onlyIfIdle && usedSince) return
    // Ending the worker frees its whole GPU device, model and buffers alike.
    // Nothing is in flight: this runs as a queue job, and every batch is one.
    const ending = worker
    worker = null
    lastUsedAt = 0
    failPending(new Error('Embedding model released'))
    ending.terminate()
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
 * Runs the model once over at most `EMBED_BATCH_SIZE` texts, in the worker.
 * Must run inside an AI-queue job: the worker touches the GPU.
 *
 * @param texts - At most `EMBED_BATCH_SIZE` passages.
 * @param onProgress - Model download progress, on first use.
 * @returns One vector per text, in the same order.
 */
async function embedOneBatch(
  texts: string[],
  onProgress?: ProgressCallback,
): Promise<number[][]> {
  const target = getWorker()
  const id = nextRequestId++
  const vectors = await new Promise<number[][]>((resolve, reject) => {
    pending.set(id, { resolve, reject, onProgress })
    target.postMessage({ id, texts } satisfies EmbeddingRequest)
  })
  lastUsedAt = Date.now()
  return vectors
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
