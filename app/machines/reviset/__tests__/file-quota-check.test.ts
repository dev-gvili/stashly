import { describe, expect, it } from 'vitest'
import { createActor, createMachine, fromPromise, waitFor } from 'xstate'
import { fileMachine } from '../file.machine'
import type {
  CreateMultipartUploadInput,
  CreateMultipartUploadOutput,
} from '@/machines/multipart/s3.mulipart.utils'

/**
 * The per-file quota check gates the upload: a denied file must fail before
 * any bytes move. It used to go on to `creatingUpload` whatever the answer —
 * the guard was commented out, and the result was stored by a plain action
 * whose return value XState discards.
 */
function run(result: 'allowed' | 'denied') {
  let multipartCreated = false
  const failed: unknown[] = []
  const manager = createActor(
    createMachine({
      on: { 'upload.failed': { actions: ({ event }) => failed.push(event) } },
    })
  ).start()
  const actor = createActor(
    fileMachine.provide({
      actors: {
        checkQuota: fromPromise(async () => ({ itemId: 'item_1', result })),
        createMultipartUpload: fromPromise<CreateMultipartUploadOutput, CreateMultipartUploadInput>(
          async () => {
            multipartCreated = true
            return new Promise<CreateMultipartUploadOutput>(() => {})
          }
        ),
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
  return { actor, failed, multipartCreated: () => multipartCreated }
}

describe('file machine quota check', () => {
  it('fails a denied file without creating the multipart upload', async () => {
    const { actor, failed, multipartCreated } = run('denied')
    await waitFor(actor, (s) => s.value === 'error', { timeout: 1000 })
    expect(multipartCreated()).toBe(false)
    expect(actor.getSnapshot().context.error).toBe('Not enough storage: this file needs 2 KB.')
    expect(failed).toHaveLength(1)
  })

  it('creates the multipart upload for an allowed file', async () => {
    const { actor, multipartCreated } = run('allowed')
    await waitFor(actor, (s) => s.value === 'creatingUpload', { timeout: 1000 })
    expect(multipartCreated()).toBe(true)
    expect(actor.getSnapshot().context.quotaCheckResult).toEqual({ itemId: 'item_1', result: 'allowed' })
  })
})
