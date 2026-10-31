import { beforeEach, describe, expect, it, vi } from 'vitest'

// The route's I/O is S3; the session comes from the context authMiddleware
// sets. Mocking S3 keeps the test off the network while exercising the real
// request parsing and abort handling.
vi.mock('@/services/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock('@/services/item-actions', () => ({ assertCanUploadTo: vi.fn(), assertKeyUnfiled: vi.fn() }))
vi.mock('@/services/s3', () => ({
  abortMultipartUpload: vi.fn(),
  completeMultipartUpload: vi.fn(),
  createMultipartUpload: vi.fn(),
  getObjectHead: vi.fn(),
  getPresignedUrlForPart: vi.fn(),
}))

import { RouterContextProvider } from 'react-router'
import * as s3 from '@/services/s3'
import { assertKeyUnfiled } from '@/services/item-actions'
import { StashlyError, StashlyErrorCode } from '@/utils/api.errors'
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

/**
 * Keys come from the file's path, so a second upload under the same name lands
 * on the object a filed row already serves. Completing it swapped the bytes
 * behind that row while its size and the quota kept the old number: a 1-byte
 * file could be grown to any size for free. A filed key is refused at create,
 * before any bytes move, and again at complete, which aborts.
 */
describe('a key a File row already serves', () => {
  const send = (body: Record<string, unknown>) =>
    action({
      request: new Request('http://localhost/api/s3/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'item_root/a.txt', ...body }),
      }),
      context: sessionFor({ id: 'usr_test', bucket: 'bucket-test' }),
    } as never) as Promise<{ data?: unknown; init?: { status?: number } }>

  beforeEach(() => {
    vi.mocked(s3.createMultipartUpload).mockReset()
    vi.mocked(s3.completeMultipartUpload).mockReset()
    vi.mocked(s3.abortMultipartUpload).mockResolvedValue({} as never)
    vi.mocked(assertKeyUnfiled).mockReset()
    vi.mocked(assertKeyUnfiled).mockRejectedValue(
      new StashlyError(StashlyErrorCode.CONFLICT, 'A file with this name already exists here')
    )
  })

  it('is refused at create with 409, before any upload starts', async () => {
    const res = await send({ action: 'create-multipart-upload' })
    expect(res.init?.status).toBe(409)
    expect(res.data).toEqual({ error: 'A file with this name already exists here' })
    expect(assertKeyUnfiled).toHaveBeenCalledWith('bucket-test', 'item_root/a.txt')
    expect(s3.createMultipartUpload).not.toHaveBeenCalled()
  })

  it('is refused at complete with 409, and the upload is aborted', async () => {
    const res = await send({
      action: 'complete-multipart-upload',
      uploadId: 'up_1',
      parts: [{ ETag: '"p1"', PartNumber: 1 }],
    })
    expect(res.init?.status).toBe(409)
    expect(s3.completeMultipartUpload).not.toHaveBeenCalled()
    expect(s3.abortMultipartUpload).toHaveBeenCalledWith('bucket-test', 'item_root/a.txt', 'up_1')
  })
})
