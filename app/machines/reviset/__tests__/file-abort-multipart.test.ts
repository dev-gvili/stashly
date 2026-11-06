import { describe, expect, it } from 'vitest'
import { createActor, createMachine, fromCallback, fromPromise, waitFor } from 'xstate'
import { fileMachine } from '../file.machine'
import type {
  AbortMultipartUploadInput,
  AbortMultipartUploadOutput,
  CompleteMultipartUploadInput,
  CompleteMultipartUploadOutput,
  CreateMultipartUploadInput,
  CreateMultipartUploadOutput,
} from '@/machines/multipart/s3.mulipart.utils'

/**
 * A cancelled upload, one whose part retries ran out, and one whose complete
 * failed must tell S3 to drop the parts already uploaded. Before this neither did: the parts stayed billed
 * until someone ran the orphan sweep by hand (tech-debt item 33).
 */
type Worker = 'fails' | 'waits-for-abort' | 'finishes'

function run(worker: Worker, opts: { abortFails?: boolean } = {}) {
  const abortCalls: AbortMultipartUploadInput[] = []
  const aborted: unknown[] = []
  const failed: unknown[] = []
  const manager = createActor(
    createMachine({
      on: {
        'upload.aborted': { actions: ({ event }) => aborted.push(event) },
        'upload.failed': { actions: ({ event }) => failed.push(event) },
      },
    })
  ).start()
  const actor = createActor(
    fileMachine.provide({
      actors: {
        checkQuota: fromPromise(async () => ({ itemId: 'item_1', result: 'allowed' as 'allowed' | 'denied' })),
        createMultipartUpload: fromPromise<CreateMultipartUploadOutput, CreateMultipartUploadInput>(
          async () => ({ uploadId: 'up_1' })
        ),
        multipart: fromCallback(({ sendBack, receive }) => {
          if (worker === 'fails') {
            queueMicrotask(() => sendBack({ type: '@multipart.upload.error', error: new Error('HTTP error! status: 403') }))
          }
          if (worker === 'finishes') {
            queueMicrotask(() => sendBack({ type: '@multipart.upload.done', parts: [{ ETag: 'e1', PartNumber: 1 }] }))
          }
          receive((event) => {
            if (event.type === '@multipart.upload.abort') sendBack({ type: '@multipart.upload.aborted' })
          })
        }),
        completeMultipartUpload: fromPromise<CompleteMultipartUploadOutput, CompleteMultipartUploadInput>(async () => {
          throw new Error('Folder access was revoked')
        }),
        abortMultipartUpload: fromPromise<AbortMultipartUploadOutput, AbortMultipartUploadInput>(async ({ input }) => {
          abortCalls.push(input)
          if (opts.abortFails) throw new Error('network down')
          return {} as AbortMultipartUploadOutput
        }),
      },
    }),
    {
      input: {
        manager,
        user: { id: 'usr_1', bucket: 'bucket', rootId: 'item_root', email: 'a@b.c' },
        mediaFile: {
          id: 'item_1',
          key: 'item_root/a.txt',
          uploadPath: 'item_root/a.txt',
          file: new File([new Uint8Array(2048)], 'a.txt', { type: 'text/plain' }),
        },
      } as never,
    }
  ).start()
  actor.send({ type: 'start' } as never)
  return { actor, abortCalls, aborted, failed }
}

describe('file machine aborts the multipart upload', () => {
  it('aborts it when the part retries run out', async () => {
    const { actor, abortCalls, aborted } = run('fails')
    await waitFor(actor, (s) => s.value === 'aborted', { timeout: 1000 })
    expect(abortCalls).toEqual([{ key: 'item_root/a.txt', uploadId: 'up_1' }])
    expect(aborted).toHaveLength(1)
  })

  it('aborts it when the user cancels', async () => {
    const { actor, abortCalls, aborted } = run('waits-for-abort')
    await waitFor(actor, (s) => s.matches({ uploading: 'active' }), { timeout: 1000 })
    expect(abortCalls).toHaveLength(0)
    actor.send({ type: 'abort' } as never)
    await waitFor(actor, (s) => s.value === 'aborted', { timeout: 1000 })
    expect(abortCalls).toEqual([{ key: 'item_root/a.txt', uploadId: 'up_1' }])
    expect(aborted).toHaveLength(1)
  })

  it('aborts it when completing fails, and still fails the file with the reason', async () => {
    const { actor, abortCalls, aborted, failed } = run('finishes')
    await waitFor(actor, (s) => s.value === 'error', { timeout: 1000 })
    expect(abortCalls).toEqual([{ key: 'item_root/a.txt', uploadId: 'up_1' }])
    expect(actor.getSnapshot().context.error).toContain('Folder access was revoked')
    expect(failed).toHaveLength(1)
    expect(aborted).toHaveLength(0)
  })

  it('fails the file when completing and the abort both fail', async () => {
    const { actor, abortCalls, failed } = run('finishes', { abortFails: true })
    await waitFor(actor, (s) => s.value === 'error', { timeout: 1000 })
    expect(abortCalls).toHaveLength(1)
    expect(failed).toHaveLength(1)
  })

  it('still frees the slot when the abort call itself fails', async () => {
    const { actor, abortCalls, aborted } = run('fails', { abortFails: true })
    await waitFor(actor, (s) => s.value === 'aborted', { timeout: 1000 })
    expect(abortCalls).toHaveLength(1)
    expect(aborted).toHaveLength(1)
  })
})
