// app/machines/multipart/__tests__/streamParts.contract.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { CompletedPart } from '@aws-sdk/client-s3'
import {
  streamParts as concurrentStreamParts,
  PauseController, // used in pause/resume tests below
} from '../s3.multipart.concurrent'
import { streamParts as streamStreamParts } from '../s3.multipart.stream'
import type { StreamPartsInput } from '../s3.multipart.concurrent'

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Creates a File of exactly `sizeBytes` filled with zeros. Node 22 has File as a global. */
function makeFile(sizeBytes: number, name = 'test.bin'): File {
  return new File([new Uint8Array(sizeBytes)], name, {
    type: 'application/octet-stream',
  })
}

const PRESIGN_URL = 'https://s3.fake/part-upload'

/**
 * Returns a Response-like object for POST /api/s3/upload: `{ url }` for the
 * concurrent implementation's per-part request, `{ urls }` for the stream
 * implementation's windowed `get-presigned-urls`.
 */
function presignResponse(init?: RequestInit, url = PRESIGN_URL) {
  const body = typeof init?.body === 'string' ? JSON.parse(init.body) : {}
  const urls = Array.from({ length: body.count ?? 1 }, () => url)
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ url, urls }),
    headers: { get: () => null },
  })
}

/** Returns a Response-like object for PUT to S3 (the actual chunk upload). */
function putResponse(etag = '"abc123"') {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({}),
    headers: { get: (name: string) => (name === 'ETag' ? etag : null) },
  })
}

/**
 * Default fetch mock: POST to /api/s3/upload returns presign URL,
 * PUT to PRESIGN_URL returns 200 with ETag.
 */
function defaultFetchMock(url: string, init?: RequestInit) {
  if (url === PRESIGN_URL) return putResponse()
  return presignResponse(init)
}

// ─── Base input factory ───────────────────────────────────────────────────────

function makeInput(
  overrides: Partial<StreamPartsInput> & { file: File }
): StreamPartsInput {
  return {
    uploadId: 'test-upload-id',
    key: 'test/key.bin',
    onProgress: vi.fn(),
    onDone: vi.fn(),
    abortController: new AbortController(),
    concurrency: 2,
    ...overrides,
  }
}

// ─── Contract suite ───────────────────────────────────────────────────────────

describe.each([
  ['concurrent', concurrentStreamParts],
  ['stream', streamStreamParts],
] as const)('%s implementation', (_name, streamParts) => {
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockFetch = vi.fn().mockImplementation(defaultFetchMock)
    vi.stubGlobal('fetch', mockFetch)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.useRealTimers() // safe no-op when real timers are already active
  })

  // ── Happy path: single chunk ────────────────────────────────────────────────

  it('calls onDone with one CompletedPart for a single-chunk file', async () => {
    const onDone = vi.fn()
    const file = makeFile(1024) // 1 KB — well under the 5 MB chunk size

    await streamParts(makeInput({ file, onDone }))

    expect(onDone).toHaveBeenCalledOnce()
    const [parts] = onDone.mock.calls[0] as [CompletedPart[]]
    expect(parts).toHaveLength(1)
    expect(parts[0].PartNumber).toBe(1)
    expect(parts[0].ETag).toBe('"abc123"') // parseEtag strips+rewraps quotes
  })

  // ── Happy path: multi-chunk ─────────────────────────────────────────────────

  it('calls onDone with parts in correct order for a multi-chunk file', async () => {
    const CHUNK = 5 * 1024 * 1024 // 5 MB
    // 2 chunks: first full (5 MB), second partial (100 bytes)
    const file = makeFile(CHUNK + 100)

    // Return distinct ETags per part so we can verify ordering
    let putCall = 0
    mockFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url === PRESIGN_URL) {
        putCall++
        return putResponse(`"etag-part-${putCall}"`)
      }
      return presignResponse(init)
    })

    const onDone = vi.fn()
    await streamParts(makeInput({ file, onDone, concurrency: 1 }))

    expect(onDone).toHaveBeenCalledOnce()
    const [parts] = onDone.mock.calls[0] as [CompletedPart[]]
    expect(parts).toHaveLength(2)
    expect(parts[0].PartNumber).toBe(1)
    expect(parts[1].PartNumber).toBe(2)
    // ETags are non-null (exact values depend on call order under concurrency)
    expect(parts[0].ETag).toMatch(/^"etag-part-\d+"$/)
    expect(parts[1].ETag).toMatch(/^"etag-part-\d+"$/)
  })

  // ── Progress reporting ──────────────────────────────────────────────────────

  it('reports progress for each chunk and reaches 100% by the end', async () => {
    const CHUNK = 5 * 1024 * 1024
    const file = makeFile(CHUNK + 100) // 2 chunks

    const onProgress = vi.fn()
    await streamParts(makeInput({ file, onProgress, concurrency: 1 }))

    expect(onProgress).toHaveBeenCalled()
    const calls = onProgress.mock.calls.map((c) => c[0].percentage as number)
    expect(calls.length).toBeGreaterThanOrEqual(2)
    // Progress should be monotonically non-decreasing
    for (let i = 1; i < calls.length; i++) {
      expect(calls[i]).toBeGreaterThanOrEqual(calls[i - 1])
    }
    // Final call should report 100%
    expect(calls[calls.length - 1]).toBe(100)
  })

  // ── Empty file ──────────────────────────────────────────────────────────────

  it('throws immediately for an empty file', async () => {
    const file = makeFile(0)
    await expect(
      streamParts(makeInput({ file }))
    ).rejects.toThrow('Cannot upload an empty file')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  // ── Missing ETag ────────────────────────────────────────────────────────────

  it('throws when S3 returns no ETag header', async () => {
    mockFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url === PRESIGN_URL) {
        // PUT response with no ETag header
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({}),
          headers: { get: () => null }, // ETag missing
        })
      }
      return presignResponse(init)
    })

    const file = makeFile(1024)
    await expect(
      streamParts(makeInput({ file }))
    ).rejects.toThrow('Missing ETag for part 1')
    expect(mockFetch).toHaveBeenCalledTimes(2) // presign POST + S3 PUT both ran
  })

  // ── Abort before upload starts ──────────────────────────────────────────────

  it('propagates AbortError and never calls onDone when aborted before start', async () => {
    const abortController = new AbortController()
    abortController.abort() // abort before streamParts is called

    const onDone = vi.fn()
    const file = makeFile(1024)

    await expect(
      streamParts(makeInput({ file, abortController, onDone }))
    ).rejects.toMatchObject({ name: 'AbortError' })

    expect(onDone).not.toHaveBeenCalled()
    // fetch should not have been called since abort is detected first
    expect(mockFetch).not.toHaveBeenCalled()
  })

  // ── Pause + resume ──────────────────────────────────────────────────────────

  it('halts new chunks while paused and completes after resume', async () => {
    const CHUNK = 5 * 1024 * 1024
    const file = makeFile(CHUNK + 100) // 2 chunks, concurrency=1 ensures serial order
    const pauseController = new PauseController()
    const onDone = vi.fn()

    // Resolve this promise when chunk 1 is provably done and the pause is set —
    // eliminates the timing-dependent setTimeout(resolve, 50) approach.
    let signalChunk1Done!: () => void
    const chunk1Done = new Promise<void>((res) => { signalChunk1Done = res })

    // Track fetch calls. With concurrency=1, call 1 is the presign POST
    // (concurrent: for part 1; stream: for parts 1–2) and call 2 is part 1's
    // PUT ← pause here. Part 2 then takes one more presign (concurrent only)
    // and its PUT.
    let fetchCallCount = 0
    let putCount = 0
    mockFetch.mockImplementation((url: string, init?: RequestInit) => {
      fetchCallCount++
      if (url === PRESIGN_URL) {
        putCount++
        if (fetchCallCount === 2) {
          // Pause synchronously so the next worker iteration blocks,
          // then signal that chunk 1 is done and paused.
          pauseController.pause()
          signalChunk1Done()
        }
        return putResponse(`"etag-${fetchCallCount}"`)
      }
      return presignResponse(init)
    })

    const uploadPromise = streamParts(
      makeInput({ file, onDone, pauseController, concurrency: 1 })
    )

    // Wait until chunk 1 is provably complete and the pause is set
    await chunk1Done

    // Upload should not have finished yet — worker is blocked on waitIfPaused()
    expect(onDone).not.toHaveBeenCalled()

    // Resume — the second chunk should now complete
    pauseController.resume()
    await uploadPromise

    expect(onDone).toHaveBeenCalledOnce()
    const [parts] = onDone.mock.calls[0] as [CompletedPart[]]
    expect(parts).toHaveLength(2)
    expect(putCount).toBe(2) // one PUT per chunk
  })

  // ── Retry on 429 ───────────────────────────────────────────────────────────

  it('retries after a 429 response and still calls onDone', async () => {
    vi.useFakeTimers()

    let putAttempts = 0
    mockFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url === PRESIGN_URL) {
        putAttempts++
        if (putAttempts === 1) {
          return Promise.resolve({
            ok: false,
            status: 429,
            json: () => Promise.resolve({}),
            headers: { get: () => null },
          })
        }
        return putResponse()
      }
      return presignResponse(init)
    })

    const onDone = vi.fn()
    const file = makeFile(1024)
    const uploadPromise = streamParts(makeInput({ file, onDone }))

    // Advance all pending timers (the retry delay setTimeout in retryFetch)
    await vi.runAllTimersAsync()
    await uploadPromise

    expect(onDone).toHaveBeenCalledOnce()
    expect(putAttempts).toBe(2) // first attempt 429, second attempt 200
  })
})
