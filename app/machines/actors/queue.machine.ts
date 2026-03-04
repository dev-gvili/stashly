import { assign, sendTo, setup, type ActorSystem } from 'xstate'
import type { UploadQueueItem } from './types'

export interface QueueContext {
  pending: UploadQueueItem[]
  active: UploadQueueItem[]
  completed: UploadQueueItem[]
  skipped: UploadQueueItem[]
  canceled: UploadQueueItem[]
  maxConcurrentUploads: number
  activeUploadCount: number
}

type QueueEvent =
  | { type: 'ADD_TO_QUEUE'; item: UploadQueueItem }
  | { type: 'START_UPLOAD'; fileId: string }
  | { type: 'COMPLETE_UPLOAD'; fileId: string }
  | { type: 'CANCEL_UPLOAD'; fileId: string }
  | { type: 'SKIP_UPLOAD'; fileId: string }
  | { type: 'CHECK_QUEUE' }

export const queueMachine = setup({
  types: {
    context: {} as QueueContext,
    events: {} as QueueEvent,
    input: {} as { maxConcurrentUploads: number },
  },
}).createMachine({
  id: 'upload-queue',
  context: ({ input }) => ({
    pending: [],
    active: [],
    completed: [],
    skipped: [],
    canceled: [],
    maxConcurrentUploads: input.maxConcurrentUploads || 3,
    activeUploadCount: 0,
  }),
  initial: 'idle',
  states: {
    idle: {
      on: {
        ADD_TO_QUEUE: {
          actions: [
            assign({
              pending: ({ context, event }) => [...context.pending, event.item],
            }),
          ],
          target: 'processing',
        },
      },
    },
    processing: {
      on: {
        START_UPLOAD: {
          guard: ({ context }) =>
            context.activeUploadCount < context.maxConcurrentUploads &&
            context.pending.length > 0,
          actions: [
            assign({
              pending: ({ context, event }) => {
                return context.pending.filter(
                  (item) => item.fileId !== event.fileId
                )
              },
              active: ({ context, event }) => {
                const item = context.pending.find(
                  (item) => item.fileId === event.fileId
                )
                if (item) {
                  return [...context.active, { ...item, status: 'active' }]
                }
                return context.active
              },
              activeUploadCount: ({ context }) => context.activeUploadCount + 1,
            }),
            // Send to quota manager directly using system.get()
            sendTo(
              ({ system }: { system: ActorSystem<any> }) =>
                system.get('quota-manager'),
              ({ event, context }) => {
                // In real implementation, you'd have access to file size
                return {
                  type: 'CHECK_QUOTA',
                  requiredSpace: 1024 * 1024, // dummy size
                  fileId: event.fileId,
                }
              }
            ),
          ],
        },
        COMPLETE_UPLOAD: {
          actions: [
            assign({
              active: ({ context, event }) => {
                return context.active.filter(
                  (item) => item.fileId !== event.fileId
                )
              },
              completed: ({ context, event }) => {
                const item = context.active.find(
                  (item) => item.fileId === event.fileId
                )
                if (item) {
                  return [
                    ...context.completed,
                    { ...item, status: 'completed' },
                  ]
                }
                return context.completed
              },
              activeUploadCount: ({ context }) => context.activeUploadCount - 1,
            }),
            // Check queue for next upload
            sendTo(({ self }) => self, { type: 'CHECK_QUEUE' }),
          ],
        },
        CANCEL_UPLOAD: {
          actions: [
            assign({
              // ... assignment logic
            }),
            // Check queue for next upload
            sendTo(({ self }) => self, { type: 'CHECK_QUEUE' }),
          ],
        },
        CHECK_QUEUE: {
          actions: [
            ({ context, self }) => {
              if (
                context.activeUploadCount < context.maxConcurrentUploads &&
                context.pending.length > 0
              ) {
                self.send({
                  type: 'START_UPLOAD',
                  fileId: context.pending[0].fileId,
                })
              }
            },
          ],
        },
      },
    },
  },
})
