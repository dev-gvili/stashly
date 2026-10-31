/**
 * `paddle-ocr.ai.ts` must replace its worker after any failure: after a GPU
 * reset, ONNX Runtime inside the old worker never works again, so reusing it
 * failed every later page and document until a reload (31 Oct 2026).
 *
 * Vitest runs in Node with no `Worker`; this fake speaks the worker's real
 * protocol, so the client is exercised up to the `postMessage` boundary.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PaddleRequest, PaddleResponse } from '../paddle-ocr.worker'

const record = {
  started: 0,
  terminated: 0,
  requests: [] as PaddleRequest['type'][],
  current: null as FakePaddleWorker | null,
}

class FakePaddleWorker {
  onmessage: ((event: MessageEvent<PaddleResponse>) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  failNext: string | null = null
  crashOnNext: string | null = null
  private loaded = false

  constructor() {
    record.started++
    record.current = this
  }

  postMessage(request: PaddleRequest) {
    queueMicrotask(() => {
      if (this.crashOnNext) {
        const message = this.crashOnNext
        this.crashOnNext = null
        this.onerror?.({ message } as ErrorEvent)
        return
      }
      if (this.failNext) {
        const message = this.failNext
        this.failNext = null
        this.reply({ id: request.id, type: 'error', message })
        return
      }
      record.requests.push(request.type)
      const loadMs = this.loaded ? undefined : 5
      this.loaded = true
      if (request.type === 'load') {
        this.reply({ id: request.id, type: 'loaded', loadMs })
        return
      }
      this.reply({
        id: request.id,
        type: 'page',
        page: { text: 'Quarterly storage audit', confidence: 0.99, lines: 1 },
        timing: { detMs: 1, recMs: 2, decodeMs: 3, outMB: 4, pixels: 1000 },
        loadMs,
      })
    })
  }

  terminate() {
    record.terminated++
    if (record.current === this) record.current = null
  }

  private reply(data: PaddleResponse) {
    this.onmessage?.({ data } as MessageEvent<PaddleResponse>)
  }
}

vi.stubGlobal('Worker', FakePaddleWorker)

const { paddleOcrPage, preloadPaddleOcr } = await import('../paddle-ocr.ai')

const page = (pageNum: number) => ({ blob: new Blob(['png']), pageNum })

beforeEach(() => {
  record.requests.length = 0
})

describe('paddleOcrPage', () => {
  it("returns the worker's page and keeps one worker across pages", async () => {
    const before = record.started
    await preloadPaddleOcr()
    const first = await paddleOcrPage(page(1))
    await paddleOcrPage(page(2))

    expect(first).toEqual({ text: 'Quarterly storage audit', confidence: 0.99, lines: 1 })
    expect(record.requests).toEqual(['load', 'read', 'read'])
    expect(record.started - before).toBeLessThanOrEqual(1)
  })

  it('ends a worker that reports an error, so the next page gets a fresh one', async () => {
    await paddleOcrPage(page(1))
    const started = record.started
    const terminated = record.terminated
    record.current!.failNext = "Failed to execute 'mapAsync' on 'GPUBuffer': [Device] is lost."

    await expect(paddleOcrPage(page(2))).rejects.toThrow('[Device] is lost')
    expect(record.terminated).toBe(terminated + 1)

    expect((await paddleOcrPage(page(3))).text).toBe('Quarterly storage audit')
    expect(record.started).toBe(started + 1)
  })

  it('replaces the worker after any error, not only a lost device', async () => {
    await paddleOcrPage(page(1))
    const started = record.started
    // What ONNX Runtime threw on the page after a GPU reset: a bare number.
    record.current!.failNext = '30297848'

    await expect(preloadPaddleOcr()).rejects.toThrow('30297848')
    await preloadPaddleOcr()
    expect(record.started).toBe(started + 1)
  })

  it('fails the waiting page when the worker crashes, then recovers', async () => {
    await paddleOcrPage(page(1))
    const started = record.started
    record.current!.crashOnNext = 'out of memory'

    await expect(paddleOcrPage(page(2))).rejects.toThrow('PaddleOCR worker failed: out of memory')
    expect((await paddleOcrPage(page(3))).lines).toBe(1)
    expect(record.started).toBe(started + 1)
  })
})
