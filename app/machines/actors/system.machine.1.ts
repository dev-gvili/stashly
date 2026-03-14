// actors/system.machine.ts - Using proper XState system registration
import { enqueueActions, sendTo, setup } from 'xstate'
import { quotaMachine } from '../quota/quota.machine'
// import { quotaMachine } from './quota.machine';
import { queueMachine } from '../reviset/queue.machine'
// import { queueMachine } from './queue.machine';
import { multipart } from '../multipart/s3.multipart'
import type { Status, UploadFile, UploadProgress } from '@/types/machine.types'
// import type { UploadFile } from '@/types/machine.types'

interface SystemContext {
  userId: string
  bucket: string
  queueRef: typeof queueMachine
  files: Map<
    string,
    UploadFile & {
      status: Status
      progress: UploadProgress
    }
  >
}

type SystemEvent =
  | {
      type: '@upload.update.config'
      config: { userId: string; bucket: string }
    }
  | {
      type: '@upload.files.add'
      file: UploadFile & {
        status: Status
        progress: UploadProgress
      }
    }
  | { type: '@upload.files.remove'; fileId: string }
  | { type: 'PLAN_CHANGED'; newPlan: 'free' | 'pro' | 'enterprise' }

export const systemMachine = setup({
  types: {
    context: {} as SystemContext,
    events: {} as SystemEvent,
  },
  actors: {
    quotaMachine,
    queueMachine,
    multipart,
  },
  actions: {
    assignQueueService: enqueueActions(({ context, event, enqueue, self }) => {
      // Check if the file exists in our global map
      enqueue.assign(({ spawn }) => {
        const queueActor = spawn('queueMachine', {
          systemId: 'queue-service', // Register with system ID
          input: {
            config: { maxConcurrentUploads: 3 },
          },
        })
        return {
          queueRef: queueActor,
        }
      })
    }),
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QFcAOAbA9gQwgWlgE9YAXMAWwGIBVABQBkB5AQQBEB9AMQEl6BRANoAGALqJQqTLACWJaZgB24kAA9EAFgCcAOk0B2ABzqAzMYCs6gGxC9lgIyaANCEKI7N7VqFDL5ywfNzACYAXxDnNCxcAmIyKgBhZgA5eL56djomNmExJBBJGTlFZTUEY3VtY2tyr3UhUwNNdWdXBDtQsOcFTAg4ZUicfCJSCmUC2XklPNK7PRbEIPLtMyN3TUt1IMs9TTMzMLCgA */
  id: 'upload-service',
  context: ({ input }) => ({
    userId: '',
    bucket: '',
    queueRef: null,
    files: new Map(),
  }),
  invoke: [
    // {
    // 	src: 'quotaMachine',
    // 	systemId: 'quota-service', // Register with system ID
    // 	input: ({ context }) => ({ userId: context.userId }),
    // },
    // {
    // 	src: 'queueMachine',
    // 	systemId: 'queue-service', // Register with system ID
    // 	input: { config: { maxConcurrentUploads: 3 } },
    // },
  ],
  on: {
    '@upload.update.config': {
      actions: [
        ({ context, event }) => {
          context.userId = event.config.userId
          context.bucket = event.config.bucket
          return context
        },
        'assignQueueService',
        // Send to quota actor directly using system registration
        sendTo(
          ({ system }) => system.get('quota-service'),
          ({ event }) => ({
            type: '@quota.check',
            userId: event.config.userId,
            dataSize: event.config.bucket.length,
          })
        ),
      ],
    },
    '@upload.files.add': {
      actions: [
        ({ context, event }) => {
          context.files.set(event.file.id, ...event.file)
          return context
        },
        // Send to queue actor directly using system registration
        sendTo(
          ({ system }) => system.get('queue-service'),
          ({ event }) => ({
            type: '@queue.upload.queued',
            item: {
              ...event.file,
              status: 'pending',
              progress: {
                percentage: 0,
                timeLeft: {
                  hours: 0,
                  minutes: 0,
                  seconds: 0,
                },
                speed: {
                  value: 0,
                  unit: 'KB/s',
                },
              },
            },
          })
        ),
      ],
    },
    '@upload.files.remove': {
      actions: [
        // Send to queue actor directly
        sendTo(
          ({ system }) => system.get('upload-queue'),
          ({ event }) => ({
            type: '@queue.upload.remove',
            fileId: event.fileId,
          })
        ),
      ],
    },
  },
})
