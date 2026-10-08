/**
 * Dedicated worker that runs the text-embedding model
 * (`Xenova/all-mpnet-base-v2`, WebGPU, q4) off the main thread.
 *
 * It used to run on the page: loading the model and setting up its ONNX
 * session was a 1,451 ms main-thread long task, followed by a 766 ms one,
 * in every tab that embedded anything (measured 2026-09-25, TASKS.md). Here
 * that work blocks only this worker.
 *
 * The worker does not schedule anything. `embedding.ai.ts` still runs each
 * batch as a job on the main-thread `ai-queue`, which waits for this worker's
 * reply, so only one AI job touches a GPU at a time across the page and its
 * workers.
 *
 * Protocol: one `EmbeddingRequest` in, any number of `progress` messages, then
 * exactly one `result` or `error` with the same `id`.
 */
import {
  pipeline,
  type FeatureExtractionPipeline,
} from '@huggingface/transformers'

const MODEL_ID = 'Xenova/all-mpnet-base-v2'

/** Embed at most `EMBED_BATCH_SIZE` texts; the caller does the batching. */
export interface EmbeddingRequest {
  id: number
  texts: string[]
}

export type EmbeddingResponse =
  /** Model download progress, forwarded to the caller's `onProgress`. */
  | { type: 'progress'; id: number; progress: unknown }
  /** One 768-dim, L2-normalised vector per text, in input order. */
  | { type: 'result'; id: number; vectors: number[][] }
  | { type: 'error'; id: number; message: string }

let pipelinePromise: Promise<FeatureExtractionPipeline> | null = null

/**
 * Loads the model on first use. Download progress is reported against the
 * request that triggered the load.
 */
function getPipeline(requestId: number): Promise<FeatureExtractionPipeline> {
  if (!pipelinePromise) {
    pipelinePromise = pipeline('feature-extraction', MODEL_ID, {
      device: 'webgpu',
      dtype: 'q4',
      progress_callback: (progress: unknown) => {
        post({ type: 'progress', id: requestId, progress })
      },
    })
  }
  return pipelinePromise
}

function post(message: EmbeddingResponse) {
  ;(self as unknown as Worker).postMessage(message)
}

/**
 * Runs the model once and reshapes its flat output into one vector per text.
 * Mean pooling + L2 normalisation, so vectors compare by dot product.
 */
async function embed(id: number, texts: string[]): Promise<number[][]> {
  const extractor = await getPipeline(id)
  const output = await extractor(texts, { pooling: 'mean', normalize: true })

  // Output shape: [batchSize, 768] flattened. Reshape via dims.
  const dims = output.dims
  const data = output.data as Float32Array
  if (dims.length === 1) {
    // Single-input case (rare — depends on Transformers.js version)
    return [Array.from(data)]
  }
  const [batchSize, vecSize] = dims
  const vectors: number[][] = []
  for (let i = 0; i < batchSize; i++) {
    const start = i * vecSize
    vectors.push(Array.from(data.subarray(start, start + vecSize)))
  }
  return vectors
}

self.onmessage = async (event: MessageEvent<EmbeddingRequest>) => {
  const { id, texts } = event.data
  try {
    post({ type: 'result', id, vectors: await embed(id, texts) })
  } catch (err) {
    post({
      type: 'error',
      id,
      message: err instanceof Error ? err.message : String(err),
    })
  }
}
