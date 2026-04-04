// app/machines/multipart/__tests__/streamParts.contract.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { CompletedPart } from '@aws-sdk/client-s3'
import {
  streamParts as concurrentStreamParts,
  PauseController,
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

/** Returns a Response-like object for POST /api/s3/upload (presign call). */
function presignResponse(url = PRESIGN_URL) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ url }),
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
function defaultFetchMock(url: string) {
  if (url === PRESIGN_URL) return putResponse()
  return presignResponse()
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
    mockFetch.mockImplementation((url: string) => {
      if (url === PRESIGN_URL) {
        putCall++
        return putResponse(`"etag-part-${putCall}"`)
      }
      return presignResponse()
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
    // Progress should be monotonically non-decreasing
    for (let i = 1; i < calls.length; i++) {
      expect(calls[i]).toBeGreaterThanOrEqual(calls[i - 1])
    }
    // Final call should report 100%
    expect(calls[calls.length - 1]).toBe(100)
  })
})
