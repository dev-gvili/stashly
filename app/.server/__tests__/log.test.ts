import { afterEach, describe, expect, it, vi } from 'vitest'

const tags: Record<string, string> = {}
vi.mock('@/services/vinktar', () => ({
  addBreadcrumb: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  scope: () => ({
    tags,
    setTag: (key: string, value: string) => (tags[key] = value),
  }),
}))

import {
  addBreadcrumb,
  captureException,
  captureMessage,
} from '@/services/vinktar'
import {
  formatLine,
  log,
  publicFields,
  requestIdMiddleware,
} from '@/services/log'

afterEach(() => {
  vi.clearAllMocks()
  vi.restoreAllMocks()
  for (const key of Object.keys(tags)) delete tags[key]
})

describe('formatLine', () => {
  it('writes one JSON object with level, time, message, request id and fields', () => {
    const line = formatLine(
      'info',
      'connected',
      { attempt: 2 },
      'req1',
      new Date('2026-10-31T00:00:00Z')
    )
    expect(JSON.parse(line)).toEqual({
      level: 'info',
      time: '2026-10-31T00:00:00.000Z',
      msg: 'connected',
      request_id: 'req1',
      attempt: 2,
    })
    expect(line).not.toContain('\n')
  })

  it('flattens an Error, which JSON.stringify would write as {}', () => {
    const parsed = JSON.parse(formatLine('error', 'failed', { error: new TypeError('boom') }))
    expect(parsed.error).toMatchObject({ name: 'TypeError', message: 'boom' })
    expect(parsed.error.stack).toContain('boom')
  })
})

describe('publicFields', () => {
  it('drops user content (keys, buckets, names) before anything reaches Vinktar', () => {
    expect(
      publicFields({ key: 'usr/a/tax-return.pdf', bucket: 'stashly-alice', name: 'x', count: 3 })
    ).toEqual({ count: 3 })
  })
})

describe('log', () => {
  it('sends info as a breadcrumb only', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {})
    log.info('LISTEN client connected', { key: 'secret/path' })
    expect(addBreadcrumb).toHaveBeenCalledWith({
      category: 'log',
      message: 'LISTEN client connected',
      level: 'info',
      data: {},
    })
    expect(captureMessage).not.toHaveBeenCalled()
    expect(captureException).not.toHaveBeenCalled()
  })

  it('captures a warning as a message, at Vinktar level "warning"', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    log.warn('size rollup behind', { pending: 40 })
    expect(captureMessage).toHaveBeenCalledWith('size rollup behind', {
      level: 'warning',
      context: { pending: 40 },
    })
  })

  it('captures an error field as that exception, with its own stack', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const error = new Error('connection refused')
    log.error('database check failed', { error })
    expect(captureException).toHaveBeenCalledWith(error, {
      level: 'error',
      context: { error: expect.objectContaining({ message: 'connection refused' }) },
    })
    expect(captureMessage).not.toHaveBeenCalled()
  })

  it('writes JSON to stdout in production, with the request id', () => {
    vi.stubEnv('NODE_ENV', 'production')
    const out = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    tags.request_id = 'abc123'
    log.info('done', { count: 1 })
    vi.unstubAllEnvs()
    expect(JSON.parse(String(out.mock.calls[0][0]))).toMatchObject({
      level: 'info',
      msg: 'done',
      request_id: 'abc123',
      count: 1,
    })
  })
})

describe('requestIdMiddleware', () => {
  it("uses Fly's request id when the proxy sent one", async () => {
    await requestIdMiddleware(
      { request: new Request('http://x/', { headers: { 'fly-request-id': 'fly-01' } }) } as never,
      (async () => new Response()) as never
    )
    expect(tags.request_id).toBe('fly-01')
  })

  it('makes one up otherwise', async () => {
    await requestIdMiddleware(
      { request: new Request('http://x/') } as never,
      (async () => new Response()) as never
    )
    expect(tags.request_id).toMatch(/^[0-9a-f]{8}$/)
  })
})
