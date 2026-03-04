// queue.machine.ts
import { assign, setup, assertEvent, enqueueActions, log, sendTo } from 'xstate'
import { status, uploadProgress } from '../schema.zod'
import z from 'zod'

// Define a leaner type for what the queue machine needs to know about a file's status

const queueItem = z.object({
  id: z.string(),
  size: z.number(),
  status: status.default('pending'),
  error: z.string().optional(),
  progress: uploadProgress.optional(),
})

const quotaCheckResult = z.enum([
  'ALLOWED',
  'DENIED_FILE_TOO_LARGE',
  'DENIED_STORAGE_EXCEEDED',
])

const queueContext = z.object({
  items: z.map(z.string(), queueItem),
  active: z.set(z.string()),
  validating: z.set(z.string()), // Files currently being validated
  canceled: z.set(z.string()),
  skipped: z.set(z.string()),
  completed: z.set(z.string()),
  pending: z.set(z.string()),
  validationPaused: z.boolean().default(false),
  config: z.object({
    maxConcurrentUploads: z.number(),
  }),
  stats: z.object({
    active: z.number(),
    validating: z.number(),
    canceled: z.number(),
    completed: z.number(),
    skipped: z.number(),
    pending: z.number(),
  }),
})

const queueEvents = z.discriminatedUnion('type', [
  z.object({ type: z.literal('@queue.upload.queued'), queueItem }),
  z.object({ type: z.literal('@queue.validate.start'), fileId: z.string() }),
  z.object({ type: z.literal('@queue.upload.started'), fileId: z.string() }),
  z.object({
    type: z.literal('@queue.upload.completed'),
    fileId: z.string(),
  }),
  z.object({ type: z.literal('@queue.upload.canceled'), fileId: z.string() }),
  z.object({ type: z.literal('@queue.upload.aborted'), fileId: z.string() }),
  z.object({ type: z.literal('@queue.upload.remove'), fileId: z.string() }),
  z.object({
    type: z.literal('@queue.quota.checked'),
    fileId: z.string(),
    result: quotaCheckResult,
  }),
  z.object({ type: z.literal('@quota.changed') }), // Event from quota manager
  z.object({ type: z.literal('@upload.spawn'), fileId: z.string() }),
  z.object({
    type: z.literal('@upload.error'),
    fileId: z.string(),
    error: z.string(),
  }),
])

const queueInput = z.object({
  config: z.object({
    maxConcurrentUploads: z.number(),
  }),
})

export type QueueItem = z.infer<typeof queueItem>
export type QueueContext = z.infer<typeof queueContext>
export type QueueEvents = z.infer<typeof queueEvents>
export type QueueInput = z.infer<typeof queueInput>

const queueMachine = setup({
  types: {
    context: {} as QueueContext,
    events: {} as QueueEvents,
    input: {} as QueueInput,
  },
  actions: {
    moveToPending: assign(({ context, event }) => {
      assertEvent(event, '@queue.upload.queued')
      const item = queueItem.parse(event.queueItem)
      const items = new Map(context.items).set(item.id, item)
      const pending = new Set(context.pending).add(item.id)
      return {
        ...context,
        items,
        pending,
        stats: { ...context.stats, pending: pending.size },
      }
    }),
    moveToValidating: assign(({ context, event }) => {
      const { fileId } = event as { fileId: string } // Generic action
      const item = context.items.get(fileId)
      if (!item) return context

      item.status = 'validating'
      const items = new Map(context.items).set(item.id, item)
      const pending = new Set(context.pending)
      pending.delete(fileId)
      const validating = new Set(context.validating).add(fileId)

      return {
        ...context,
        items,
        pending,
        validating,
        stats: {
          ...context.stats,
          pending: pending.size,
          validating: validating.size,
        },
      }
    }),
    moveToActive: assign(({ context, event }) => {
      assertEvent(event, '@queue.quota.checked')
      const item = context.items.get(event.fileId)
      if (!item) return context

      item.status = 'uploading'
      const items = new Map(context.items).set(item.id, item)
      const validating = new Set(context.validating)
      validating.delete(event.fileId)
      const active = new Set(context.active).add(event.fileId)

      return {
        ...context,
        items,
        validating,
        active,
        stats: {
          ...context.stats,
          validating: validating.size,
          active: active.size,
        },
      }
    }),
    moveToSkipped: assign(({ context, event }) => {
      assertEvent(event, '@queue.quota.checked')
      const item = context.items.get(event.fileId)
      if (!item) return context

      item.status = 'skipped'
      const items = new Map(context.items).set(item.id, item)
      const validating = new Set(context.validating)
      validating.delete(event.fileId)
      const skipped = new Set(context.skipped).add(event.fileId)

      return {
        ...context,
        items,
        validating,
        skipped,
        stats: {
          ...context.stats,
          validating: validating.size,
          skipped: skipped.size,
        },
      }
    }),
    moveToCompleted: assign(({ context, event }) => {
      assertEvent(event, '@queue.upload.completed')
      const item = context.items.get(event.fileId)
      if (!item) return context

      item.status = 'done'
      const items = new Map(context.items).set(item.id, item)
      const active = new Set(context.active)
      active.delete(event.fileId)
      const completed = new Set(context.completed).add(event.fileId)

      return {
        ...context,
        items,
        active,
        completed,
        stats: {
          ...context.stats,
          active: active.size,
          completed: completed.size,
        },
      }
    }),
    moveToCanceled: assign(({ context, event }) => {
      assertEvent(event, '@queue.upload.aborted')
      const item = context.items.get(event.fileId)
      if (!item) return context
      item.status = 'aborted'
      const items = new Map(context.items).set(item.id, item)
      const active = new Set(context.active)
      active.delete(event.fileId)
      const canceled = new Set(context.canceled).add(event.fileId)

      return {
        ...context,
        items,
        active,
        canceled,
        stats: {
          ...context.stats,
          active: active.size,
          canceled: canceled.size,
        },
      }
    }),
    pauseValidation: assign({ validationPaused: true }),
    resumeValidation: assign({ validationPaused: false }),
    checkAndValidateUploads: enqueueActions(({ context, event, enqueue }) => {
      if (context.validationPaused) return

      const slotsAvailable =
        context.config.maxConcurrentUploads -
        context.active.size -
        context.validating.size
      const pendingFileIds = Array.from(context.pending)

      if (slotsAvailable > 0 && pendingFileIds.length > 0) {
        const filesToValidate = pendingFileIds.slice(0, slotsAvailable)
        for (const fileId of filesToValidate) {
          enqueue.raise({ type: '@queue.validate.start', fileId }) // Internal event
        }
      }
    }),
    validateQuota: sendTo(
      ({ system }) => system.get('quota-manager'),
      ({ event, context }) => {
        assertEvent(event, '@queue.validate.start')
        const item = context.items.get(event.fileId)
        return {
          type: '@quota.check',
          dataSize: item!.size,
        }
      }
    ),
    spawnUpload: sendTo(
      ({ system }) => system.get('upload-service'),
      ({ event }) => {
        assertEvent(event, '@queue.quota.checked')
        return {
          type: 'upload.spawn',
          fileId: event.fileId,
        }
      }
    ),
    logQueueState: log(({ context }) => ({
      ...context.stats,
      items: context.items.size,
    })),
  },
  guards: {
    allowed: ({ event }) => {
      assertEvent(event, '@queue.quota.checked')
      return event.result === 'ALLOWED'
    },
    deniedFileTooLarge: ({ event }) => {
      assertEvent(event, '@queue.quota.checked')
      return event.result === 'DENIED_FILE_TOO_LARGE'
    },
    deniedStorageExceeded: ({ event }) => {
      assertEvent(event, '@queue.quota.checked')
      return event.result === 'DENIED_STORAGE_EXCEEDED'
    },
  },
}).createMachine({
  id: 'queue',
  context: ({ input }) => ({
    config: input.config,
    items: new Map(),
    active: new Set(),
    validating: new Set(),
    canceled: new Set(),
    completed: new Set(),
    skipped: new Set(),
    pending: new Set(),
    validationPaused: false,
    stats: {
      active: 0,
      validating: 0,
      completed: 0,
      pending: 0,
      skipped: 0,
      canceled: 0,
    },
  }),
  initial: 'active',
  states: {
    active: {
      on: {
        '@queue.upload.queued': {
          actions: [
            'moveToPending',
            'checkAndValidateUploads',
            'logQueueState',
          ],
        },
        '@queue.validate.start': {
          actions: ['moveToValidating', 'validateQuota', 'logQueueState'],
        },
        '@queue.quota.checked': [
          {
            guard: 'allowed',
            actions: ['moveToActive', 'spawnUpload', 'logQueueState'],
          },
          {
            guard: 'deniedFileTooLarge',
            actions: [
              'moveToSkipped',
              'checkAndValidateUploads',
              'logQueueState',
            ],
          },
          {
            guard: 'deniedStorageExceeded',
            actions: ['moveToSkipped', 'pauseValidation', 'logQueueState'],
          },
        ],
        '@quota.changed': {
          actions: ['resumeValidation', 'checkAndValidateUploads'],
        },
        '@queue.upload.completed': {
          actions: [
            'moveToCompleted',
            'checkAndValidateUploads',
            'logQueueState',
          ],
        },
        '@queue.upload.aborted': {
          actions: [
            'moveToCanceled',
            'checkAndValidateUploads',
            'logQueueState',
          ],
        },
      },
    },
  },
})

export { queueMachine }
