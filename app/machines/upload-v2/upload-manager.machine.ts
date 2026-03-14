import { genericQueueMachine } from './../queue/queue.machine.1';
import {
  setup,
  assign,
  enqueueActions,
  assertEvent,
  type ActorRefFrom,
} from 'xstate'
import type { User } from '@/services/auth.types'
import { config } from '@/schemas/machine.schemas'
import { uploadQueueMachineV2 } from './upload-queue.machine'
import  { quotaMachine } from '../quota/quota.machine'
import  { uploadWorkerMachine } from './upload-worker.machine'

/**
 * Simplified upload manager that delegates queue management to the generic queue machine.
 * Responsibilities:
 * - Configuration management
 * - Spawning the queue machine with validator (quota) and worker (file/multipart)
 * - Managing overall upload session state
 */

export interface UploadManagerV2Context {
  config: {
    user: User
    maxConcurrentUploads: number | undefined
    maxFileSize: number | undefined
  }
  queueActor?: ActorRefFrom<typeof genericQueueMachine>
  quotaActor?: ActorRefFrom<typeof quotaMachine>
  workerActor?: ActorRefFrom<typeof uploadWorkerMachine>
  error?: string
}

export type UploadManagerV2Events =
  | {
      type: 'upload.config'
      config: UploadManagerV2Context['config']
    }
  | {
      type: 'upload.initialized'
    }
  | {
      type: 'upload.stop'
    }

const uploadManagerMachineV2 = setup({
  types: {
    context: {} as UploadManagerV2Context,
    events: {} as UploadManagerV2Events,
  },
  actions: {
    updateConfig: enqueueActions(({ enqueue, context, event }) => {
      assertEvent(event, 'upload.config')
    //   const parsedConfig = config.parse({
    //     ...event.config,
    //     user: event.config.user,
    //   })
      enqueue.assign({
        config: {
          ...context.config,
          ...event.config,
        },
      })
    }),
    spawnQuotaActor: enqueueActions(({ enqueue }) => {
      enqueue.assign(({ spawn }) => {
        const actor = spawn('quotaMachine', {
          systemId: 'quotaValidator',
        })
        return { quotaActor: actor }
      })
    }),
    spawnWorkerActor: enqueueActions(({ enqueue }) => {
      enqueue.assign(({ spawn }) => {
        const actor = spawn('uploadWorkerMachine', {
          systemId: 'uploadWorker',
        })
        return { workerActor: actor }
      })
    }),
    spawnQueueActor: enqueueActions(({ context, enqueue }) => {
      enqueue.assign(({ spawn }) => {
        const actor = spawn('genericQueueMachine', {
          systemId: 'uploadQueue',
          input: {
            maxConcurrency: context.config.maxConcurrentUploads || 5,
            validator: context.quotaActor,
            worker: context.workerActor,
          },
        })
        return { queueActor: actor }
      })
    }),
  },
  actors: {
    quotaMachine,
    uploadWorkerMachine,
    genericQueueMachine,
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QFcAOAbA9gQwgWWwDtsYAnANQCYBiNLXAOgGNNCAzASygG0AGAXUShUmWBwAuHVkJAAPRABZeANgbKAnJXUB2bQA5KeveuWUAzABoQAT0QBGSgF9HVujnxESYCpQYcI6GC0GO5+hBIc2OgcAF6QfIJIICJiktJJ8giG6gxmvGba+WYArHZmCgp6VrZZCnYMlIZ1CtpmRsoKynbOriG4BMRkVAykYLjWDNhMkgBuQW6MsOKYqAkyKRHpoJmmxWo6Zup6ra3qCtWIZnZ7vPrF5cUGlLzGZs4uIISYEHAyCx6DbxUdaiTaEGSZAC0dguCG0qgU6l4vBat0MJW0PRA-wGXh8fgCYBBqSk4Iyim0sMa2gYejsemRL2UDOKlDsCixOM8Q18o3GxLBEMUjwYLTs+jsOke9PysLsyjMtOKylaZmUKPu9M5fQBeOGfIgEymsyJSQ2aTJ20QxRUou04rpUrpDMsNku11yCnKylK6nF7I62voup5IzGhoYSxWqEgAotQrh2gUorOJUq8OVdNhVz25RKtz9zPUOnejiAA */
  id: 'uploadManagerV2',
  initial: 'idle',
  context: {
    config: {
      user: undefined as any,
      maxConcurrentUploads: 5,
      maxFileSize: 10000000000,
    },
  },
  on: {
    'upload.config': {
      actions: 'updateConfig',
    },
  },
  states: {
    idle: {
      entry: ['spawnQuotaActor', 'spawnWorkerActor'],
      on: {
        'upload.initialized': {
          target: 'ready',
          actions: 'spawnQueueActor',
        },
      },
    },
    ready: {
      description:
        'Upload manager is ready to accept files. Queue machine is active and managing the upload flow.',
      initial: 'active',
      states: {
        active: {
          on: {
            'upload.stop': {
              target: 'stopped',
            },
          },
        },
        stopped: {},
      },
    },
  },
})

export { uploadManagerMachineV2 }
