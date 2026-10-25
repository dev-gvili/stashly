import { beforeEach, describe, expect, it, vi } from 'vitest'

// The route's I/O: the session lookup and S3. Mocking them keeps the test off
// the network while exercising the real request parsing and abort handling.
vi.mock('@/services/auth', () => ({
  auth: {
    api: { getSession: vi.fn(async () => ({ user: { id: 'usr_test', bucket: 'bucket-test' } })) },
  },
}))
vi.mock('@/services/item-actions', () => ({ assertCanUploadTo: vi.fn() }))
vi.mock('@/services/s3', () => ({
  abortMultipartUpload: vi.fn(),
  completeMultipartUpload: vi.fn(),
  createMultipartUpload: vi.fn(),
  getObjectHead: vi.fn(),
  getPresignedUrlForPart: vi.fn(),
}))

import * as s3 from '@/services/s3'
import { action } from '../upload'

/**
 * The file machine aborts after a failed complete. When the server refused
 * the complete it has already aborted that upload, so the client's abort finds
 * nothing: that must answer as done, not as a 500 (tech-debt item 33).
 */
const abort = () =>
  action({
    request: new Request('http://localhost/api/s3/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'abort-multipart-upload', key: 'item_root/a.txt', uploadId: 'up_1' }),
    }),
  } as never)

const s3Error = (name: string) => Object.assign(new Error(name), { name })

beforeEach(() => vi.mocked(s3.abortMultipartUpload).mockReset())

describe('abort-multipart-upload', () => {
  it('aborts in the session user’s bucket', async () => {
    expect(await abort()).toEqual({ success: true })
    expect(s3.abortMultipartUpload).toHaveBeenCalledWith('bucket-test', 'item_root/a.txt', 'up_1')
  })

  it('answers an upload that is already gone as done', async () => {
    vi.mocked(s3.abortMultipartUpload).mockRejectedValueOnce(s3Error('NoSuchUpload'))
    expect(await abort()).toEqual({ success: true })
  })

  it('still fails on any other S3 error', async () => {
    vi.mocked(s3.abortMultipartUpload).mockRejectedValueOnce(s3Error('AccessDenied'))
    await expect(abort()).rejects.toMatchObject({ name: 'AccessDenied' })
  })
})
