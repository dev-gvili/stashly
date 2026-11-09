import { describe, expect, it, vi } from 'vitest'
import { createActor, fromPromise } from 'xstate'
import { uploadMachine } from '../upload.machine'
import { fileMachine } from '../../reviset/file.machine'
import type {
  CreateMultipartUploadInput,
  CreateMultipartUploadOutput,
} from '@/machines/multipart/s3.mulipart.utils'

/**
 * One upload limit, before and after configuration.
 *
 * The initial context said 10 while the schema default said 100. `useUpload`
 * sends `upload.config` without a limit, so `updateConfig` parsed in the
 * default and 100 was what ran (measured: 100 `/api/s3/upload` requests in
 * flight at the peak of a 639-file burst). The two now agree.
 */
const user = {
  id: 'usr_test',
  createdAt: new Date(),
  updatedAt: new Date(),
  email: 'upload-limit@test.local',
  emailVerified: true,
  name: 'Upload limit',
  bucket: 'stashly-test',
  subscriptionId: 'sub_test',
  storagePlanId: 'plan_test',
  driveId: 'drv_test',
  rootId: 'item_root',
}

function startManager() {
  return createActor(uploadMachine).start()
}

describe('the upload concurrency limit', () => {
  it('is 100 before any configuration arrives', () => {
    const actor = startManager()
    expect(actor.getSnapshot().context.config.maxConcurrentUploads).toBe(100)
  })

  it('stays 100 when the config names no limit, as useUpload sends it', () => {
    const actor = startManager()
    actor.send({ type: 'upload.config', config: { user } } as any)
    expect(actor.getSnapshot().context.config.maxConcurrentUploads).toBe(100)
  })

  it('takes a limit the config names', () => {
    const actor = startManager()
    actor.send({ type: 'upload.config', config: { user, maxConcurrentUploads: 3 } } as any)
    expect(actor.getSnapshot().context.config.maxConcurrentUploads).toBe(3)
  })
})

/**
 * A freed slot goes to a file that is waiting, never to one that already holds
 * a slot. A file stays `pending` until its multipart create returns, so the
 * refill picked those first (they were added earlier), `upload.start` refused
 * them as already active, and the slot went unused: on a large folder drop the
 * active count fell well under the limit with every completion.
 *
 * Kept in a file whose other tests add no files: the manager's initial context
 * is one module-level object its actions mutate, so another test's files linger.
 */
describe('a freed slot', () => {
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

  it('starts a waiting file, not one still creating its upload', async () => {
    // S3 replaced: `refused` fails its create, every other file stays creating.
    const created: string[] = []
    const machine = uploadMachine.provide({
      actors: {
        fileMachine: fileMachine.provide({
          actors: {
            createMultipartUpload: fromPromise<CreateMultipartUploadOutput, CreateMultipartUploadInput>(async ({ input }) => {
              if (input.key.includes('refused')) throw new Error('refused')
              created.push(input.key)
              return new Promise<never>(() => {})
            }),
          },
        }),
      },
    })
    const actor = createActor(machine).start()
    actor.send({ type: 'upload.config', config: { user, maxConcurrentUploads: 2 } } as any)
    for (const id of ['refused', 'creating', 'waiting']) {
      actor.send({ type: 'upload.add', mediaFile: mediaFile(id), skipQuotaCheck: true } as any)
    }

    // Polled: creating its upload is the last thing that happens, and xstate's
    // `waitFor` only re-checks on a new snapshot.
    await vi.waitFor(() => expect(created).toContain('item_root/waiting/waiting.pdf'), { timeout: 2000 })
    expect([...actor.getSnapshot().context.queues.active].sort()).toEqual(['creating', 'waiting'])
    actor.stop()
  })
})
