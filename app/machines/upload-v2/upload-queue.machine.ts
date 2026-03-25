import { z } from 'zod'
import {
  setup,
  assign,
  sendTo,
  enqueueActions,
  assertEvent,
  type AnyActorRef,
  log,
} from 'xstate'
import { toMediaFile } from '../../utils/converters'
import { mediafile, user } from '@/schemas/machine.schemas'

/**
 * Generic Queue Machine (v2) - Refined for upload flow
 *
 * Architecture:
 * - Pending: Files waiting to be processed
 * - Validating: Files being checked by quota validator
 * - Active: Files currently being uploaded
 * - Completed/Failed: Terminal states
 *
 * Integration:
 * - Validator: quotaMachine (checks user quota)
 * - Worker: uploadWorkerMachine (handles file upload)
 */

const itemSchema = mediafile

const contextSchema = z.object({
  items: z.map(z.string(), itemSchema),
  pending: z.set(z.string()),
  validating: z.set(z.string()),
  active: z.set(z.string()),
  completed: z.set(z.string()),
  failed: z.set(z.string()),
  config: z.object({
    maxConcurrency: z.number(),
    validator: z.any().optional(),
    worker: z.any(),
  }),
  stats: z.object({
    pending: z.number().default(0),
    validating: z.number().default(0),
    active: z.number().default(0),
    completed: z.number().default(0),
    failed: z.number().default(0),
  }),
  queueRef: z.any().optional(),
})

const eventsSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('@queue.add'),
    item: itemSchema,
  }),
  z.object({
    type: z.literal('validation.result'),
    itemId: z.string(),
    result: z.enum(['allowed', 'denied']),
  }),
  z.object({
    type: z.literal('validation.request'),
    itemId: z.string(),
    itemSize: z.coerce.bigint(),
  }),
  z.object({
    type: z.literal('worker.success'),
    itemId: z.string(),
  }),
  z.object({
    type: z.literal('worker.failure'),
    itemId: z.string(),
  }),
  z.object({
    type: z.literal('@queue.cancel'),
    itemId: z.string(),
  }),
])

const inputSchema = z.object({
  maxConcurrency: z.number().min(1),
  validator: z.any().optional(),
  worker: z.any(),
})

export const uploadQueueMachineV2 = setup({
  types: {
    context: {} as z.infer<typeof contextSchema>,
    events: {} as z.infer<typeof eventsSchema>,
    input: {} as z.infer<typeof inputSchema>,
  },
  actions: {
    addItemToPending: assign({
      items: ({ context, event }) => {
        assertEvent(event, '@queue.add')
        return new Map(context.items).set(event.item.id, event.item)
      },
      pending: ({ context, event }) => {
        assertEvent(event, '@queue.add')
        return new Set(context.pending).add(event.item.id)
      },
    }),
    moveFromPendingToValidating: assign({
      pending: ({ context, event }) => {
        assertEvent(event, 'validation.request')
        const newPending = new Set(context.pending)
        newPending.delete(event.itemId)
        return newPending
      },
      validating: ({ context, event }) => {
        assertEvent(event, 'validation.request')
        return new Set(context.validating).add(event.itemId)
      },
    }),
    moveFromValidatingToActive: assign({
      validating: ({ context, event }) => {
        console.log('Moving from validating')
        console.log('Context:', context)
        console.log('Event:', event)
        assertEvent(event, 'validation.result')
        const newValidating = new Set(context.validating)
        newValidating.delete(event.itemId)
        return newValidating
      },
      active: ({ context, event }) => {
        console.log('Moving to active')
        console.log('Context:', context)
        console.log('Event:', event)
        assertEvent(event, 'validation.result')
        return new Set(context.active).add(event.itemId)
      },
    }),
    moveFromValidatingToFailed: assign({
      validating: ({ context, event }) => {
        assertEvent(event, 'validation.result')
        const newValidating = new Set(context.validating)
        newValidating.delete(event.itemId)
        return newValidating
      },
      failed: ({ context, event }) => {
        assertEvent(event, 'validation.result')
        return new Set(context.failed).add(event.itemId)
      },
    }),
    moveFromActiveToCompleted: assign({
      active: ({ context, event }) => {
        assertEvent(event, 'worker.success')
        const newActive = new Set(context.active)
        newActive.delete(event.itemId)
        return newActive
      },
      completed: ({ context, event }) => {
        assertEvent(event, 'worker.success')
        return new Set(context.completed).add(event.itemId)
      },
    }),
    moveFromActiveToFailed: assign({
      active: ({ context, event }) => {
        assertEvent(event, 'worker.failure')
        const newActive = new Set(context.active)
        newActive.delete(event.itemId)
        return newActive
      },
      failed: ({ context, event }) => {
        assertEvent(event, 'worker.failure')
        return new Set(context.failed).add(event.itemId)
      },
    }),
    checkQueue: enqueueActions(({ context, enqueue, event }) => {
      const hasValidator = !!context.config.validator
      const slotsAvailable =
        context.config.maxConcurrency -
        context.active.size -
        (hasValidator ? context.validating.size : 0)
      const pendingItemIds = Array.from(context.pending)

      if (slotsAvailable > 0 && pendingItemIds.length > 0) {
        const itemsToProcess = pendingItemIds.slice(0, slotsAvailable)
        for (const itemId of itemsToProcess) {
          const item = context.items.get(itemId)
          if (!item) continue

          if (hasValidator) {
            enqueue.raise({
              type: 'validation.request',
              itemId,
              itemSize: BigInt(item.file.size),
            })
          } else {
            // No validator, skip directly to active
            enqueue.raise({
              type: 'validation.result',
              itemId,
              result: 'allowed',
            })
          }
        }
      }
    }),
    sendToValidator: sendTo(
      ({ context, system }) => system.get(context.config.validator!),
      ({ context, event }) => {
        assertEvent(event, 'validation.request')
        return {
          type: '@quota.check',
          itemId: event.itemId,
          dataSize: event.itemSize,
          replayTo: context.queueRef,
        }
      }
    ),
    // sendToValidator: sendTo(
    //   ({ context }) => context.config.validator!,
    //   ({ context, event, self }) => {
    //     assertEvent(event, 'validation.request')
    //     return {
    //       type: '@quota.check',
    //       itemId: event.itemId,
    //       dataSize: event.itemSize,
    //       replayTo: context.queueRef,
    //     }
    //   }
    // ),
    sendToWorker: sendTo(
      ({ context }) => context.config.worker,
      ({ context, event }) => {
        assertEvent(event, 'validation.result')
        const item = context.items.get(event.itemId)
        return {
          type: 'process',
          item,
        }
      }
    ),
    updateStats: assign({
      stats: ({ context }) => ({
        pending: context.pending.size,
        validating: context.validating.size,
        active: context.active.size,
        completed: context.completed.size,
        failed: context.failed.size,
      }),
    }),
  },
  guards: {
    allowed: ({ event }) => {
      assertEvent(event, 'validation.result')
      return event.result === 'allowed'
    },
    denied: ({ event }) => {
      assertEvent(event, 'validation.result')
      return event.result === 'denied'
    },
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QFcAOAbA9gQwgRWTEIDUAmAOgCdkA7GgSxqgGIABAR0MPNwgG0ADAF1EoVJlj0ALvUw1RIAB6JSAgIzkALAFYAnAGY9pUjv2k1ANgA0IAJ6Jdq8vs0WAHNreldj0gHYLAF9AmzQsXAIiMDIqWgYmZgA3bHR6CGwZOSowTjgpQREkEHFJTPki5QRLC3I-HU9LTS9dC1JtG3sEPz8NCya3fT8XAZNSYNCMHHwuaIpqOkYWZNT0suzYZHR84QUS6Vly0Eq1bRqXAU1Bsw8+xw7EVopdbQE3S31dOtUgkJAwqciJDmcUWSRSaQyB3Wm3yakKYgk+zkCmOmgoATcb10mkuAgsdXuCE0dXIbX8zxxFm0ah64z+kwiMxi83iLAA7phKABrMCUcgbADGArgsAKu0RZRRiEsblqAnMfgEL1Ibk0ah0hLM2nI2m0xLqmmeFjUhjp-0ZUWZIISHO5vPIADNsPR0MhKGAxUU9pKKtKBuQLm99PpmnptN1CTSajc-NpDDjFT4zQzppbgQsEhwZuQBdgaML0J6EaUDlKEKo-ORdJZuqR9ErNK89IS3s4LPilXXqa5zMFfjRMBA4ApzamgeKS8jfQgALRqQkzmoCZcr1ervzJ8Jj2axDNQCdIw5KRDEyMCEkXJpqLzqz7qvuBIA */
  id: 'uploadQueueV2',
  context: ({ input, self }) => ({
    items: new Map(),
    pending: new Set(),
    validating: new Set(),
    active: new Set(),
    completed: new Set(),
    failed: new Set(),
    config: input,
    stats: {
      pending: 0,
      validating: 0,
      active: 0,
      completed: 0,
      failed: 0,
    },
    queueRef: self,
  }),
  initial: 'running',
  states: {
    running: {
      description:
        'Queue is actively managing uploads with validation and worker coordination.',
      on: {
        '@queue.add': {
          actions: ['addItemToPending', 'updateStats', 'checkQueue'],
        },
        'validation.request': {
          actions: [
            'moveFromPendingToValidating',
            'updateStats',
            'sendToValidator',
          ],
        },
        'validation.result': [
          {
            guard: 'allowed',
            actions: [
              'moveFromValidatingToActive',
              'updateStats',
              'sendToWorker',
            ],
          },
          {
            guard: 'denied',
            actions: [
              'moveFromValidatingToFailed',
              'updateStats',
              'checkQueue',
            ],
          },
        ],
        'worker.success': {
          actions: ['moveFromActiveToCompleted', 'updateStats', 'checkQueue'],
        },
        'worker.failure': {
          actions: ['moveFromActiveToFailed', 'updateStats', 'checkQueue'],
        },
        '@queue.cancel': {
          actions: 'updateStats',
        },
      },
    },
  },
})

export type UploadQueueContext = z.infer<typeof contextSchema>
export type UploadQueueEvents = z.infer<typeof eventsSchema>
export type UploadQueueInput = z.infer<typeof inputSchema>
