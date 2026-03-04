import { data } from 'react-router'
import {
  setup,
  assign,
  sendTo,
  enqueueActions,
  log,
  type ActorRef,
  assertEvent,
  type AnyActorRef,
  type ActorRefFrom,
} from 'xstate'
import { z } from 'zod'
import type { quotaMachine } from '../quota/quota.machine'
import type { fileMachine } from '../upload/file.machine'

// 1. GENERIC SCHEMAS
// An item must have an ID. The rest of its shape is up to the consumer.
const itemSchema = z.looseObject({ id: z.string(), size: z.coerce.bigint() })

// The result of a validation step.
const validationResult = z.enum(['allowed', 'denied'])

// The context of the generic queue machine.
const contextSchema = z.object({
  items: z.map(z.string(), itemSchema),
  pending: z.set(z.string()),
  validating: z.set(z.string()),
  active: z.set(z.string()),
  completed: z.set(z.string()),
  failed: z.set(z.string()),
  config: z.object({
    maxConcurrency: z.number(),
    validator: z.custom<ActorRefFrom<typeof quotaMachine>>().optional(),
    worker: z.custom<ActorRefFrom<typeof fileMachine>>(),
  }),
  stats: z.object({
    pending: z.number().default(0),
    validating: z.number().default(0),
    active: z.number().default(0),
    completed: z.number().default(0),
    failed: z.number().default(0),
  }),
})

// The events the generic queue machine can handle.
const eventsSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('@queue.add'),
    item: itemSchema,
  }),
  z.object({
    type: z.literal('validator.result'),
    itemId: z.string(),
    result: validationResult,
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
  // event that will be sent to quota-service to check if the user have
  z.object({
    type: z.literal('@queue.validate'),
    itemId: z.string(),
    itemSize: z.coerce.bigint(),
  }), // event
])

// The input required to spawn the machine.
const inputSchema = z.object({
  maxConcurrency: z.number().min(1),
  validator: z.custom<AnyActorRef>().optional(),
  worker: z.custom<ActorRef<any, any>>().optional(),
})

export const genericQueueMachine = setup({
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
        assertEvent(event, '@queue.validate')
        const newPending = new Set(context.pending)
        newPending.delete(event.itemId)
        return newPending
      },
      validating: ({ context, event }) => {
        assertEvent(event, '@queue.validate')
        return new Set(context.validating).add(event.itemId)
      },
    }),
    moveFromValidatingToActive: assign({
      validating: ({ context, event }) => {
        assertEvent(event, 'validator.result')
        const newValidating = new Set(context.validating)
        newValidating.delete(event.itemId)
        return newValidating
      },
      active: ({ context, event }) => {
        assertEvent(event, 'validator.result')
        return new Set(context.active).add(event.itemId)
      },
    }),
    moveFromValidatingToFailed: assign({
      validating: ({ context, event }) => {
        assertEvent(event, 'validator.result')
        const newValidating = new Set(context.validating)
        newValidating.delete(event.itemId)
        return newValidating
      },
      failed: ({ context, event }) => {
        assertEvent(event, 'validator.result')
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
    checkQueue: enqueueActions(({ context, enqueue }) => {
      const hasValidator = !!context.config.validator
      const slotsAvailable =
        context.config.maxConcurrency -
        context.active.size -
        (hasValidator ? context.validating.size : 0)
      const pendingItemIds = Array.from(context.pending)

      if (slotsAvailable > 0 && pendingItemIds.length > 0) {
        const itemsToprocess = pendingItemIds.slice(0, slotsAvailable)
        for (const itemId of itemsToprocess) {
          let item = context.items.get(itemId)
          if (!item) continue
          if (hasValidator) {
            enqueue.raise({
              type: '@queue.validate',
              itemId,
              itemSize: item.size,
            })
          } else {
            // No validator, so we can consider it pre-validated.
            enqueue.raise({
              type: 'validator.result',
              itemId,
              result: 'allowed',
            })
          }
        }
      }
    }),
    sendToValidator: sendTo(
      ({ context }) => context.config.validator!,
      ({ event, context }) => {
        assertEvent(event, '@queue.validate')
        return {
          type: '@quota.check',
          userId: event.itemId,
          dataSize: event.itemSize,
        }
      }
    ),
    sendToWorker: sendTo(
      ({ context, system, event }) => system.get('worker'),
      ({ event, context }) => {
        assertEvent(event, 'validator.result')
        return {
          type: 'process',
          item: context.items.get(event.itemId),
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
    hasValidator: ({ context }) => !!context.config.validator,
    hasWorker: ({ context }) => !!context.config.worker,
    allowed: ({ event }) => {
      assertEvent(event, 'validator.result')
      return event.result === 'allowed'
    },
    denied: ({ event }) => {
      assertEvent(event, 'validator.result')
      return event.result === 'denied'
    },
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QwHZgE4EsDGBFArmIQHTr4oqYpQDEAggCIMDaADALqKgAOA9rJgAumXii4gAHogCM0gMzEALACYArADZFcgJyt1ylQA5FAGhABPRIYPFDGgOyG5i7XPuyAvh7OoMOAkRgpOSU1DQAAgCOhCRUghgoAIYANsQAbimYEInxbJxIIHwCwqLiUgiOxO7Sxoqs9lrK2k5mlgjq9urE0qqGncaOcvrqXj5gaFh4MUFkFFS0AGp0ADIAkgx0ACqrAPIAcsQASgCiAMoAqsubeeJFQiJiBeW9xPWKdYrqrNb2cqqmFkQqmU9iUX3sqmc6jkrGk71GIF8kwCJFmoUWK3WW12BxOFyuzGk+R4-HupSeiBUrUQbkMVX0v1qnXU6mkCKR-mmwTmYQA6jtDgBpY6HYgXADC4rOpxuBTuJUeoHKhlYxBZxh0v2k6n+rGU1IQyhhr009iNjTk0nsEPZ4z8U0C3PRNH5QpFxAAYnRVstzidZSTig8yohtKpXnC6oZNHpFNJlIYDYZpMQhh1vnH1Nos4ovN4QCheBA4OIOQ7CLdSQqQwgALTqA218PaFuttttuS2iacx1o+aVoPkpUyRThuQ6ZzWVhaQzaewGud01T-ezNVSsXSqVx5jxAA */
  id: 'genericQueue',
  context: ({ input }) => ({
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
  }),
  initial: 'running',
  states: {
    running: {
      on: {
        add: {
          actions: ['addItemToPending', 'updateStats', 'checkQueue'],
        },
        '@queue.validate': {
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
      },
    },
  },
})
