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
import { enqueue } from './ai-queue'

const MODEL_ID = 'Xenova/all-mpnet-base-v2'
export const EMBEDDING_DIM = 768

let pipelinePromise: Promise<FeatureExtractionPipeline> | null = null

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
 * Embed a batch of text passages. Returns one 768-dim vector per input,
 * pre-normalized for cosine/dot-product similarity.
 *
 * Batched for efficiency — embedding 10 chunks in one call is meaningfully
 * faster than 10 sequential calls due to model warm-up overhead.
 */
export function embedTexts(
  texts: string[],
  onProgress?: ProgressCallback,
): Promise<number[][]> {
  return enqueue(async () => {
    if (texts.length === 0) return []
    const extractor = await getPipeline(onProgress)
    const output = await extractor(texts, { pooling: 'mean', normalize: true })

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
  })
}

/** Embed a single string. Convenience wrapper around `embedTexts([text])`. */
export async function embedText(
  text: string,
  onProgress?: ProgressCallback,
): Promise<number[]> {
  const [vec] = await embedTexts([text], onProgress)
  return vec
}
