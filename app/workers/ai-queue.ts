/**
 * Shared serialization for browser-side AI inference.
 *
 * All AI work runs through `@huggingface/transformers` on a single WebGPU
 * context. Concurrent inference jobs (image saliency, captioning, text
 * embedding, OCR) crash with device-lost / context-busy errors if they
 * overlap, so every consumer funnels through `enqueue` and only one job
 * touches WebGPU at a time.
 *
 * **Why this has priorities.** Serialization alone was strict FIFO, which is
 * fine when every job is short. It stops being fine once a job can be *long*:
 * OCR on a scanned PDF is a model load plus a generation pass per page —
 * minutes. A search query embedded while that runs would sit behind the whole
 * document, and the search UI would hang on "Ranking by meaning…" with no way
 * to tell it apart from a crash.
 *
 * So: FIFO within a priority, and a waiting `interactive` job goes ahead of
 * waiting `background` work. A *running* job is never preempted — WebGPU
 * gives us no way to do that — which is why long jobs are also expected to
 * enqueue in small pieces (see `ocrPages`, which enqueues per page) so there
 * are frequent yield points.
 */

export type AiPriority =
  /** Someone is watching a spinner. Jumps the queue. */
  | 'interactive'
  /** Upload-time pipeline work. The default. */
  | 'default'
  /** Backfills, OCR — nobody is blocked on it. */
  | 'background'

const ORDER: Record<AiPriority, number> = {
  interactive: 0,
  default: 1,
  background: 2,
}

interface Task {
  run: () => void
  priority: AiPriority
  /** Tiebreaker so equal priorities stay FIFO. */
  seq: number
}

const waiting: Task[] = []
let running = false
let nextSeq = 0

function schedule() {
  if (running || waiting.length === 0) return

  // Lowest ORDER first; `seq` keeps insertion order within a priority.
  let bestIndex = 0
  for (let i = 1; i < waiting.length; i++) {
    const a = waiting[i]
    const b = waiting[bestIndex]
    if (
      ORDER[a.priority] < ORDER[b.priority] ||
      (ORDER[a.priority] === ORDER[b.priority] && a.seq < b.seq)
    ) {
      bestIndex = i
    }
  }

  const [task] = waiting.splice(bestIndex, 1)
  running = true
  task.run()
}

/**
 * Run `fn` once the WebGPU context is free.
 *
 * @param fn The inference job.
 * @param priority Defaults to `'default'`. Pass `'interactive'` for work a
 *   user is waiting on, `'background'` for work nobody is blocked on.
 *
 * @example
 * // A search query — someone is watching a spinner.
 * const vector = await enqueue(() => embed(query), 'interactive')
 *
 * @example
 * // One page of OCR. Enqueued per page rather than per document so an
 * // interactive job never waits for more than a single page.
 * const text = await enqueue(() => transcribe(page), 'background')
 */
export function enqueue<T>(
  fn: () => Promise<T>,
  priority: AiPriority = 'default'
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    waiting.push({
      priority,
      seq: nextSeq++,
      run: () => {
        // A failure must settle the caller *and* free the queue — an
        // unreleased `running` flag would deadlock every later job.
        Promise.resolve()
          .then(fn)
          .then(resolve, reject)
          .finally(() => {
            running = false
            schedule()
          })
      },
    })
    schedule()
  })
}

/** Queue depth, for status UI and diagnostics. */
export function aiQueueDepth(): { waiting: number; running: boolean } {
  return { waiting: waiting.length, running }
}
