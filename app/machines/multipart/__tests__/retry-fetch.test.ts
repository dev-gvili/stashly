import { afterEach, describe, expect, it, vi } from 'vitest'
import { retryFetch } from '../s3.multipart.stream'

/**
 * The part loop's `fetch` retries only what a retry can fix. It used to retry
 * every non-OK answer five times, so a 403 (access revoked mid-upload) kept a
 * doomed upload alive for minutes before it failed (tech-debt item 34).
 */
function stubFetch(...statuses: number[]) {
  const fetch = vi.fn(async () => {
    const status = statuses.length > 1 ? statuses.shift()! : statuses[0]
    return new Response(null, { status })
  })
  vi.stubGlobal('fetch', fetch)
  return fetch
}

const call = () => retryFetch('/api/s3/upload', {}, 5, 1, 1, new AbortController().signal)

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('retryFetch', () => {
  it.each([400, 403, 404, 413])('fails a %i on the first answer', async (status) => {
    const fetch = stubFetch(status)
    await expect(call()).rejects.toMatchObject({ status, retryable: false })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('retries a 5xx and returns the answer once it succeeds', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const fetch = stubFetch(503, 500, 200)
    expect((await call()).status).toBe(200)
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('retries a 429', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const fetch = stubFetch(429, 200)
    expect((await call()).status).toBe(200)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('gives up on a 5xx after the last retry', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const fetch = stubFetch(500)
    await expect(call()).rejects.toThrow('after 5 retries')
    expect(fetch).toHaveBeenCalledTimes(5)
  })

  it('retries a network error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
    vi.stubGlobal('fetch', fetch)
    expect((await call()).status).toBe(200)
    expect(fetch).toHaveBeenCalledTimes(2)
  })
})
