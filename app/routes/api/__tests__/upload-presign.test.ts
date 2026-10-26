import { beforeEach, describe, expect, it, vi } from 'vitest'

// The route's I/O is S3; signing is mocked to name the part it signed.
vi.mock('@/services/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock('@/services/item-actions', () => ({ assertCanUploadTo: vi.fn() }))
vi.mock('@/services/s3', () => ({
  abortMultipartUpload: vi.fn(),
  completeMultipartUpload: vi.fn(),
  createMultipartUpload: vi.fn(),
  getObjectHead: vi.fn(),
  getPresignedUrlForPart: vi.fn(),
}))

import { RouterContextProvider } from 'react-router'
import * as s3 from '@/services/s3'
import { sessionContext } from '@/services/middleware/context'
import { action } from '../upload'

/**
 * The create answer carries the first 100 part URLs, and `get-presigned-urls`
 * signs a range, so a part no longer costs a request of its own (tech-debt
 * item 39).
 */
function post(body: Record<string, unknown>) {
  const context = new RouterContextProvider()
  context.set(sessionContext, { user: { id: 'usr_test', bucket: 'bucket-test' } } as never)
  return action({
    request: new Request('http://localhost/api/s3/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    context,
  } as never) as Promise<Record<string, unknown>>
}

const create = (partCount?: number) =>
  post({ action: 'create-multipart-upload', key: 'item_root/a.bin', ...(partCount === undefined ? {} : { partCount }) })
const range = (from: number, count: number) =>
  post({ action: 'get-presigned-urls', key: 'item_root/a.bin', uploadId: 'up_1', from, count })

beforeEach(() => {
  vi.mocked(s3.createMultipartUpload).mockResolvedValue({ UploadId: 'up_1' } as never)
  vi.mocked(s3.getPresignedUrlForPart).mockReset()
  vi.mocked(s3.getPresignedUrlForPart).mockImplementation(async (_b, _k, _u, part) => `https://s3.fake/${part}`)
})

describe('create-multipart-upload', () => {
  it('returns a URL for each part of a small file', async () => {
    expect(await create(3)).toEqual({
      uploadId: 'up_1',
      partUrls: ['https://s3.fake/1', 'https://s3.fake/2', 'https://s3.fake/3'],
    })
    expect(s3.getPresignedUrlForPart).toHaveBeenCalledWith('bucket-test', 'item_root/a.bin', 'up_1', 1)
  })

  it('returns the first 100 for a larger one', async () => {
    const { partUrls } = (await create(250)) as { partUrls: string[] }
    expect(partUrls).toHaveLength(100)
    expect(partUrls[99]).toBe('https://s3.fake/100')
  })

  it('returns none when the client sends no part count', async () => {
    expect(await create()).toEqual({ uploadId: 'up_1', partUrls: [] })
  })
})

describe('get-presigned-urls', () => {
  it('signs the range asked for', async () => {
    expect(await range(101, 3)).toEqual({
      urls: ['https://s3.fake/101', 'https://s3.fake/102', 'https://s3.fake/103'],
    })
  })

  it('stops at S3’s last part', async () => {
    const { urls } = (await range(9_999, 50)) as { urls: string[] }
    expect(urls).toEqual(['https://s3.fake/9999', 'https://s3.fake/10000'])
  })

  it('refuses more than 100 at once', async () => {
    await expect(range(1, 101)).rejects.toThrow()
    expect(s3.getPresignedUrlForPart).not.toHaveBeenCalled()
  })
})
