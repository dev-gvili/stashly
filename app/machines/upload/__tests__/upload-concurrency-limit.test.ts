import { describe, expect, it } from 'vitest'
import { createActor, createMachine } from 'xstate'
import { uploadMachine } from '../upload.machine'

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
  const machine = uploadMachine.provide({
    actors: { quotaMachine: createMachine({}) as any },
  })
  return createActor(machine).start()
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
