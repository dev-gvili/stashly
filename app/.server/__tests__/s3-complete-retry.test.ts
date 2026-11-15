import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  CompleteMultipartUploadCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3'
import { s3, completeMultipartUpload } from '../s3'

/**
 * Tigris can answer a CompleteMultipartUpload with 408 RequestTimeout while it
 * assembles a large object. The parts are stored, so the complete is retried a
 * bounded number of times, on 408 only; any other error fails at once. A repeat
 * that finds the upload gone (`NoSuchUpload`) after a 408 means the first
 * attempt finished, which a HEAD of the key confirms before it counts as done.
 */

const parts = [{ ETag: '"a"', PartNumber: 1 }]
const timeout = () =>
  Object.assign(new Error('Your socket connection to the server was not read from or written to within the timeout period.'), {
    name: 'RequestTimeout',
    $metadata: { httpStatusCode: 408 },
  })
const noSuchUpload = () => Object.assign(new Error('gone'), { name: 'NoSuchUpload', $metadata: { httpStatusCode: 404 } })
const NO_WAIT = [0, 0]

function stubSend(handler: (command: unknown) => unknown) {
  return vi.spyOn(s3, 'send').mockImplementation(((command: unknown) => {
    const out = handler(command)
    return out instanceof Error ? Promise.reject(out) : Promise.resolve(out)
  }) as never)
}
const completes = (spy: ReturnType<typeof stubSend>) =>
  spy.mock.calls.filter(([c]) => c instanceof CompleteMultipartUploadCommand).length

afterEach(() => vi.restoreAllMocks())

describe('completeMultipartUpload', () => {
  it('answers a 408 with a retry and returns the second attempt', async () => {
    let n = 0
    const spy = stubSend(() => (++n === 1 ? timeout() : { ETag: '"done"', Key: 'k', Bucket: 'b', $metadata: {} }))

    const out = await completeMultipartUpload('b', 'k', 'u', parts, NO_WAIT)

    expect(out.ETag).toBe('"done"')
    expect(completes(spy)).toBe(2)
  })

  it('gives up after three attempts of 408 and throws the timeout', async () => {
    const spy = stubSend(() => timeout())

    await expect(completeMultipartUpload('b', 'k', 'u', parts, NO_WAIT)).rejects.toMatchObject({ name: 'RequestTimeout' })
    expect(completes(spy)).toBe(3)
  })

  it('does not retry any other error', async () => {
    const spy = stubSend(() => Object.assign(new Error('boom'), { name: 'InternalError', $metadata: { httpStatusCode: 500 } }))

    await expect(completeMultipartUpload('b', 'k', 'u', parts, NO_WAIT)).rejects.toMatchObject({ name: 'InternalError' })
    expect(completes(spy)).toBe(1)
  })

  it('counts NoSuchUpload after a 408 as done when the object is stored', async () => {
    let n = 0
    const spy = stubSend((command) => {
      if (command instanceof HeadObjectCommand) return { ContentLength: 5, ETag: '"stored"' }
      return ++n === 1 ? timeout() : noSuchUpload()
    })

    const out = await completeMultipartUpload('b', 'k', 'u', parts, NO_WAIT)

    expect(out).toMatchObject({ Key: 'k', Bucket: 'b', ETag: '"stored"' })
    expect(completes(spy)).toBe(2)
  })

  it('throws NoSuchUpload after a 408 when no object is stored', async () => {
    let n = 0
    stubSend((command) => {
      if (command instanceof HeadObjectCommand) return Object.assign(new Error('nf'), { name: 'NotFound', $metadata: { httpStatusCode: 404 } })
      return ++n === 1 ? timeout() : noSuchUpload()
    })

    await expect(completeMultipartUpload('b', 'k', 'u', parts, NO_WAIT)).rejects.toMatchObject({ name: 'NoSuchUpload' })
  })

  it('does not look for the object when NoSuchUpload comes first', async () => {
    const spy = stubSend(() => noSuchUpload())

    await expect(completeMultipartUpload('b', 'k', 'u', parts, NO_WAIT)).rejects.toMatchObject({ name: 'NoSuchUpload' })
    expect(spy.mock.calls.some(([c]) => c instanceof HeadObjectCommand)).toBe(false)
  })
})
