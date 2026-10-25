import { beforeEach, describe, expect, it, vi } from 'vitest'

// The route's I/O is S3; the session comes from the context authMiddleware
// sets. Mocking S3 keeps the test off the network while exercising the real
// request parsing and abort handling.
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
    context: sessionFor({ id: 'usr_test', bucket: 'bucket-test' }),
  } as never)

/** The context `authMiddleware` leaves for the route. */
function sessionFor(user: { id: string; bucket: string }) {
  const context = new RouterContextProvider()
  context.set(sessionContext, { user } as never)
  return context
}

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
