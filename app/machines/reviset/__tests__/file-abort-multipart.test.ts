import { describe, expect, it } from 'vitest'
import { createActor, createMachine, fromCallback, fromPromise, waitFor } from 'xstate'
import { fileMachine } from '../file.machine'
import type {
  AbortMultipartUploadInput,
  AbortMultipartUploadOutput,
  CreateMultipartUploadInput,
  CreateMultipartUploadOutput,
} from '@/machines/multipart/s3.mulipart.utils'

/**
 * A cancelled upload, and one whose part retries ran out, must tell S3 to drop
 * the parts already uploaded. Before this neither did: the parts stayed billed
 * until someone ran the orphan sweep by hand (tech-debt item 33).
 */
type Worker = 'fails' | 'waits-for-abort'

function run(worker: Worker, opts: { abortFails?: boolean } = {}) {
  const abortCalls: AbortMultipartUploadInput[] = []
  const aborted: unknown[] = []
  const manager = createActor(
    createMachine({
      on: { 'upload.aborted': { actions: ({ event }) => aborted.push(event) } },
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
          receive((event) => {
            if (event.type === '@multipart.upload.abort') sendBack({ type: '@multipart.upload.aborted' })
          })
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
          file: new File([new Uint8Array(2048)], 'a.txt', { type: 'text/plain' }),
        },
      } as never,
    }
  ).start()
  actor.send({ type: 'start' } as never)
  return { actor, abortCalls, aborted }
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

  it('still frees the slot when the abort call itself fails', async () => {
    const { actor, abortCalls, aborted } = run('fails', { abortFails: true })
    await waitFor(actor, (s) => s.value === 'aborted', { timeout: 1000 })
    expect(abortCalls).toHaveLength(1)
    expect(aborted).toHaveLength(1)
  })
})
