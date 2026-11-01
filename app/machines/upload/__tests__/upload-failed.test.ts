import { describe, expect, it } from 'vitest'
import { createActor, fromPromise, waitFor } from 'xstate'
import { uploadMachine } from '../upload.machine'
import { fileMachine } from '../../reviset/file.machine'
import type {
  CreateMultipartUploadInput,
  CreateMultipartUploadOutput,
} from '@/machines/multipart/s3.mulipart.utils'

/**
 * A file that fails before its bytes finish uploading must free its slot.
 *
 * The manager freed a slot only on `upload.done` and `upload.aborted`. A file
 * whose quota check, multipart create or complete failed went to its `error`
 * final state and told the manager nothing, so it stayed in `queues.active`
 * for good: after `maxConcurrentUploads` such failures no other file could
 * start. A folder-access refusal (revoked mid-upload) is exactly that case.
 */
const user = {
  id: 'usr_test',
  createdAt: new Date(),
  updatedAt: new Date(),
  email: 'upload-failed@test.local',
  emailVerified: true,
  name: 'Upload failed',
  bucket: 'stashly-test',
  subscriptionId: 'sub_test',
  storagePlanId: 'plan_test',
  driveId: 'drv_test',
  rootId: 'item_root',
}

function mediaFile(id: string) {
  return {
    id,
    key: `item_root/${id}/${id}.pdf`,
    uploadPath: `item_root/${id}.pdf`,
    file: new File(['x'], `${id}.pdf`, { type: 'application/pdf' }),
    status: 'pending' as const,
    progress: {
      percentage: 0,
      timeLeft: { hours: 0, minutes: 0, seconds: 0 },
      speed: { value: 0, unit: 'KB/s' as const },
    },
  }
}

/**
 * The real manager and file machine, with S3 replaced: creating `refused`'s
 * upload fails the way a 403 from `/api/s3/upload` does, and every other file
 * records that it got as far as creating its upload, then waits.
 */
/**
 * The manager hands new rows to listening pages instead of keeping them
 * (tech-debt item 45): a file's row on `upload.createItem.success`, a folder
 * upload's folders on `upload.items.created`.
 */
describe('created rows', () => {
  it('emits each new row to listeners', () => {
    const actor = createActor(uploadMachine).start()
    actor.send({ type: 'upload.config', config: { user } } as any)
    const seen: unknown[][] = []
    actor.on('items.created', (e) => seen.push(e.items))

    actor.send({ type: 'upload.items.created', items: [{ id: 'item_dir' }] })
    actor.send({ type: 'upload.createItem.success', mediaFileId: 'mf_1', item: { id: 'item_file' } })
    actor.send({ type: 'upload.createItem.success', mediaFileId: 'mf_2' })

    expect(seen).toEqual([[{ id: 'item_dir' }], [{ id: 'item_file' }], []])
    actor.stop()
  })
})

function startManager() {
  const created: string[] = []
  const machine = uploadMachine.provide({
    actors: {
      fileMachine: fileMachine.provide({
        actors: {
          createMultipartUpload: fromPromise<CreateMultipartUploadOutput, CreateMultipartUploadInput>(async ({ input }) => {
            if (input.key.includes('refused')) {
              throw new Error('Access denied: write access is required on every item')
            }
            created.push(input.key)
            return new Promise<never>(() => {})
          }),
        },
      }),
    },
  })
  const actor = createActor(machine).start()
  actor.send({ type: 'upload.config', config: { user, maxConcurrentUploads: 1 } } as any)
  return { actor, created }
}

describe('a file that fails before uploading', () => {
  it('is marked failed with the reason, and frees its slot for the next file', async () => {
    const { actor, created } = startManager()

    actor.send({ type: 'upload.add', mediaFile: mediaFile('refused'), skipQuotaCheck: true } as any)
    actor.send({ type: 'upload.add', mediaFile: mediaFile('next'), skipQuotaCheck: true } as any)

    await waitFor(actor, (s) => s.context.mediaFiles.get('refused')?.status === 'failed', { timeout: 2000 })
    const refused = actor.getSnapshot().context.mediaFiles.get('refused')
    expect(refused?.error).toBe('Access denied: write access is required on every item')
    expect(actor.getSnapshot().context.queues.active.has('refused')).toBe(false)

    await waitFor(actor, () => created.includes('item_root/next/next.pdf'), { timeout: 2000 })
    actor.stop()
  })
})
