/**
 * A stand-in for `embedding.worker.ts` in Vitest, which runs in Node with no
 * `Worker` and no WebGPU. It speaks the worker's real message protocol, so
 * `embedding.ai.ts` is exercised exactly as in the browser up to the
 * `postMessage` boundary.
 *
 * Install with {@link installFakeEmbeddingWorker} before importing
 * `embedding.ai`, and read what happened from the returned record.
 */
import { vi } from 'vitest'
import type { EmbeddingRequest, EmbeddingResponse } from '../embedding.worker'

export interface FakeWorkerRecord {
  /** Every batch the "model" was given, in call order. */
  calls: string[][]
  /** Workers started — each one loads the model once. */
  started: number
  /** Workers terminated — a release, or a crash. */
  terminated: number
  /** The live fake, for tests that make it fail. */
  current: FakeEmbeddingWorker | null
}

export class FakeEmbeddingWorker {
  onmessage: ((event: MessageEvent<EmbeddingResponse>) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  /** When set, the next request answers with a worker-side error. */
  failNext: string | null = null
  /** When set, the next request makes the worker crash (an `error` event). */
  crashOnNext: string | null = null

  constructor(
    private readonly record: FakeWorkerRecord,
    private readonly vectorFor: (text: string) => number[]
  ) {
    record.started++
    record.current = this
  }

  postMessage({ id, texts }: EmbeddingRequest) {
    // Answer asynchronously, as a real worker does.
    queueMicrotask(() => {
      if (this.crashOnNext) {
        const message = this.crashOnNext
        this.crashOnNext = null
        this.crash(message)
        return
      }
      if (this.failNext) {
        const message = this.failNext
        this.failNext = null
        this.reply({ type: 'error', id, message })
        return
      }
      this.record.calls.push(texts)
      this.reply({ type: 'result', id, vectors: texts.map(this.vectorFor) })
    })
  }

  /** Simulates the worker throwing outside a request (an `error` event). */
  crash(message: string) {
    this.onerror?.({ message } as ErrorEvent)
  }

  terminate() {
    this.record.terminated++
    if (this.record.current === this) this.record.current = null
  }

  private reply(data: EmbeddingResponse) {
    this.onmessage?.({ data } as MessageEvent<EmbeddingResponse>)
  }
}

/**
 * Stubs `window` and `Worker` so `embedding.ai.ts` starts fakes.
 *
 * @param vectorFor - The "embedding" of one text.
 */
export function installFakeEmbeddingWorker(
  vectorFor: (text: string) => number[] = () => [0]
): FakeWorkerRecord {
  const record: FakeWorkerRecord = { calls: [], started: 0, terminated: 0, current: null }
  vi.stubGlobal('window', {})
  vi.stubGlobal(
    'Worker',
    class extends FakeEmbeddingWorker {
      constructor() {
        super(record, vectorFor)
      }
    }
  )
  return record
}
