import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPartUrls, streamParts } from '../s3.multipart.stream'

/**
 * Part URLs are signed a window at a time. Every part used to ask
 * `/api/s3/upload` for its own URL right before its PUT, which was 20 of a
 * 100 MB upload's 54 requests (tech-debt item 39). The first window comes
 * with the create answer; later ones are requested ahead of need, and a URL
 * that expired is signed again once.
 */
type Call = { url: string; method: string; body: Record<string, unknown> | null }

let calls: Call[]
let respond: (call: Call) => Promise<unknown> | unknown

const ok = (json: unknown, etag: string | null = null) => ({
  ok: true,
  status: 200,
  json: () => Promise.resolve(json),
  headers: { get: (name: string) => (name === 'ETag' ? etag : null) },
})
const status = (code: number) => ({
  ok: false,
  status: code,
  json: () => Promise.resolve({}),
  headers: { get: () => null },
})

/** `get-presigned-urls` answers `u<part>`; a PUT answers with an ETag. */
const signer = (call: Call) => {
  if (call.method === 'PUT') return ok({}, '"etag"')
  const { from, count } = call.body as { from: number; count: number }
  return ok({ urls: Array.from({ length: count }, (_, i) => `https://s3.fake/u${from + i}`) })
}

const signRequests = () => calls.filter((c) => c.body?.action === 'get-presigned-urls').map((c) => [c.body!.from, c.body!.count])

beforeEach(() => {
  calls = []
  respond = signer
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init: RequestInit) => {
      const call = {
        url,
        method: init.method ?? 'GET',
        body: typeof init.body === 'string' ? JSON.parse(init.body) : null,
      }
      calls.push(call)
      return Promise.resolve(respond(call))
    })
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const initial = (n: number) => Array.from({ length: n }, (_, i) => `https://s3.fake/c${i + 1}`)
const source = (totalParts: number, first: string[] = []) =>
  createPartUrls({ key: 'k', uploadId: 'up_1', totalParts, initial: first, signal: new AbortController().signal })

describe('createPartUrls', () => {
  it('serves the create answer’s URLs without a request', async () => {
    const urls = source(3, initial(3))
    expect(await urls.get(1)).toBe('https://s3.fake/c1')
    expect(await urls.get(3)).toBe('https://s3.fake/c3')
    expect(calls).toHaveLength(0)
  })

  it('asks for the next window 20 parts before it is needed, once', async () => {
    const urls = source(205, initial(100))
    for (let n = 1; n <= 80; n++) await urls.get(n)
    expect(signRequests()).toEqual([])
    await urls.get(81)
    expect(signRequests()).toEqual([[101, 100]])
    for (let n = 82; n <= 180; n++) await urls.get(n)
    expect(signRequests()).toEqual([[101, 100]])
    expect(await urls.get(181)).toBe('https://s3.fake/u181')
    expect(signRequests()).toEqual([[101, 100], [201, 5]])
    expect(await urls.get(205)).toBe('https://s3.fake/u205')
  })

  it('shares one request among workers waiting on the same window', async () => {
    const urls = source(30)
    const got = await Promise.all(Array.from({ length: 10 }, (_, i) => urls.get(i + 1)))
    expect(got[9]).toBe('https://s3.fake/u10')
    expect(signRequests()).toEqual([[1, 30]])
  })

  it('signs one part again on refresh', async () => {
    const urls = source(2, initial(2))
    expect(await urls.refresh(2)).toBe('https://s3.fake/u2')
    expect(signRequests()).toEqual([[2, 1]])
  })

  it('fails the part whose window could not be signed', async () => {
    respond = () => status(403)
    await expect(source(5).get(1)).rejects.toMatchObject({ status: 403 })
  })
})

describe('streamParts with part URLs', () => {
  const file = (bytes: number) => new File([new Uint8Array(bytes)], 'a.bin')
  const run = (bytes: number, partUrls?: string[]) => {
    const onDone = vi.fn()
    const promise = streamParts({
      key: 'k',
      uploadId: 'up_1',
      file: file(bytes),
      partUrls,
      onDone,
      onProgress: vi.fn(),
      abortController: new AbortController(),
    })
    return { promise, onDone }
  }

  it('makes no presign request when the create answer covered every part', async () => {
    const { promise, onDone } = run(5 * 1024 * 1024 + 1, initial(2))
    await promise
    expect(onDone).toHaveBeenCalledOnce()
    expect(calls.map((c) => c.method)).toEqual(['PUT', 'PUT'])
  })

  it('signs a part again once when its URL answers 403, then uploads it', async () => {
    respond = (call) => (call.url === 'https://s3.fake/c1' ? status(403) : signer(call))
    const { promise, onDone } = run(1024, initial(1))
    await promise
    expect(onDone).toHaveBeenCalledWith([{ ETag: '"etag"', PartNumber: 1 }])
    expect(calls.map((c) => c.body?.action ?? `${c.method} ${c.url}`)).toEqual([
      'PUT https://s3.fake/c1',
      'get-presigned-urls',
      'PUT https://s3.fake/u1',
    ])
  })

  it('fails the file when the fresh URL is refused too', async () => {
    respond = (call) => (call.method === 'PUT' ? status(403) : signer(call))
    const { promise, onDone } = run(1024, initial(1))
    await expect(promise).rejects.toMatchObject({ status: 403 })
    expect(onDone).not.toHaveBeenCalled()
    expect(signRequests()).toEqual([[1, 1]])
  })

  it('does not re-sign on another 4xx', async () => {
    respond = (call) => (call.method === 'PUT' ? status(400) : signer(call))
    await expect(run(1024, initial(1)).promise).rejects.toMatchObject({ status: 400 })
    expect(signRequests()).toEqual([])
  })
})
