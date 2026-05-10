/**
 * Shared serialization for browser-side AI inference.
 *
 * All AI work runs through `Xenova/transformers` on a single WebGPU context.
 * Concurrent inference jobs (image saliency, image captioning, text embedding)
 * crash with device-lost / context-busy errors if they overlap. Every consumer
 * funnels through `enqueue` so only one job touches WebGPU at a time.
 */

let queue: Promise<unknown> = Promise.resolve()

/**
 * Run `fn` after every previously-enqueued job has settled (success or
 * failure — failures don't poison the queue for subsequent jobs).
 */
export function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const next = queue.then(fn, fn)
  queue = next.catch(() => {})
  return next
}
