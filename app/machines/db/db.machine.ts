import {
  assertEvent,
  assign,
  enqueueActions,
  setup,
  type AnyActorRef,
} from 'xstate'
import type { DbContext, DbEvents, DbResponse } from '@/types/machine.types'
import { resolveHash, postItem } from './db.actors'
import { toItemPayload, toOutcome } from './db.utils'

/**
 * Writes rows on behalf of an upload, one request per run.
 *
 * It replaces the `createDbItem` promise actor that used to live inline in
 * `upload.machine.ts`, where every branch of a single `try/catch` decided the
 * fate of an upload:
 *
 * ```
 *                                                    ┌ @db.item.created    → created
 * idle → hashing → building → posting → classifying ─┼ @db.item.refused    → refused     ┐
 *   ▲                                                ├ @db.item.rejected   → rejected    ├→ idle
 *   │                                                ├ @db.session.expired → sessionExpired
 *   └────────────────────────────────────────────────┴ @db.item.failed     → failed      ┘
 * ```
 *
 * **No state throws.** The old actor ended its `catch` with `throw err`, and
 * because it was *spawned* rather than invoked, XState propagated that
 * rejection to the parent and stopped it — measured on XState 5.33, the upload
 * manager went from `active` to `error` and dropped every event sent after it.
 * One file that failed to get a row therefore cost every other file in the
 * batch its row too. Here every ending is an event raised in the same tick the
 * verdict is reached, routed by the root handler below, so a failed write is
 * data rather than a crash.
 *
 * **Nothing transient is remembered.** The hash, the payload and the response
 * each travel on the event that carries them into the next step, so context
 * holds only the subject of the run and who to answer.
 *
 * The parent contract is unchanged: `upload.createItem.success` on `created`,
 * `upload.createItem.error` on every other ending.
 *
 * @example
 * const db = spawn('dbMachine', { input: { replayTo: self } })
 * db.send({ type: '@db.item.create', mediaFile, user })
 */
export const dbMachine = setup({
  types: {
    context: {} as DbContext,
    events: {} as DbEvents,
    input: {} as { replayTo?: AnyActorRef },
  },
  actors: {
    hash: resolveHash,
    post: postItem,
  },
  actions: {
    /** The subject of the run — the only thing worth keeping across steps. */
    startRun: assign(({ event }) => {
      assertEvent(event, '@db.item.create')
      return { mediaFile: event.mediaFile, user: event.user }
    }),

    /**
     * Assembles and validates the payload, then hands it on as an event.
     *
     * Building is synchronous, so it is an action rather than an actor — but
     * `toItemPayload` validates against the API's own schema and throws on a
     * field the server would have rejected. Catching that here is what keeps
     * the promise of no unhandled throw: a bad payload becomes an outcome
     * like any other, discovered before the request instead of after it.
     */
    build: enqueueActions(({ context, enqueue }, params: { hash?: string }) => {
      const mediaFileId = context.mediaFile!.id
      try {
        enqueue.raise({
          type: '@db.item.post',
          payload: toItemPayload(context.mediaFile!, context.user!, params.hash),
        })
      } catch (err) {
        enqueue.raise({
          type: '@db.item.failed',
          mediaFileId,
          error: `Item payload is not valid: ${
            err instanceof Error ? err.message : String(err)
          }`,
        })
      }
    }),

    /**
     * Turns the response into its verdict and raises it in the same tick, so
     * no `outcome` is parked in context between learning it and acting on it.
     */
    classify: enqueueActions(
      ({ context, enqueue }, params: { response: DbResponse }) => {
        enqueue.raise(toOutcome(params.response, context.mediaFile!.id))
      }
    ),

    /**
     * Raised when a step could not produce a response at all — there is no
     * verdict to reach, so the reason is passed through as-is.
     */
    fail: enqueueActions(
      ({ context, enqueue }, params: { stage: string; cause: unknown }) => {
        enqueue.raise({
          type: '@db.item.failed',
          mediaFileId: context.mediaFile!.id,
          error: `${params.stage}: ${
            params.cause instanceof Error
              ? params.cause.message
              : String(params.cause)
          }`,
        })
      }
    ),

    /**
     * Answers whoever spawned this machine, reading the outcome event that
     * caused the transition. Silent when nobody is listening — a missing
     * `replayTo` must not become a second failure on top of the one being
     * reported.
     */
    report: enqueueActions(({ context, event, enqueue }) => {
      if (!context.replayTo) return

      enqueue.sendTo(context.replayTo, () =>
        event.type === '@db.item.created'
          ? {
              type: 'upload.createItem.success' as const,
              mediaFileId: event.mediaFileId,
            }
          : {
              type: 'upload.createItem.error' as const,
              mediaFileId: (event as { mediaFileId: string }).mediaFileId,
              error:
                (event as { error?: string }).error ?? 'Item creation failed',
            }
      )
    }),
  },
}).createMachine({
  id: 'db',
  context: ({ input }) => ({
    replayTo: input?.replayTo,
    mediaFile: undefined,
    user: undefined,
  }),
  initial: 'idle',

  /**
   * Outcome events are handled at the root so any step can raise one without
   * knowing which state it is in, and so an ending can never arrive in a state
   * that has no transition for it.
   */
  on: {
    '@db.item.created': '.created',
    '@db.item.refused': '.refused',
    '@db.item.rejected': '.rejected',
    '@db.session.expired': '.sessionExpired',
    '@db.item.failed': '.failed',
  },

  states: {
    idle: {
      on: {
        '@db.item.create': { target: 'hashing', actions: 'startRun' },
      },
    },

    /** The only asynchronous part of assembling the payload. */
    hashing: {
      invoke: {
        id: '@stashly.db.hash',
        src: 'hash',
        input: ({ event }) => {
          assertEvent(event, '@db.item.create')
          return { mediaFileId: event.mediaFile.id }
        },
        onDone: {
          target: 'building',
          actions: {
            type: 'build',
            params: ({ event }) => ({ hash: event.output.hash }),
          },
        },
        onError: {
          actions: {
            type: 'fail',
            params: ({ event }) => ({
              stage: 'Could not hash the file',
              cause: event.error,
            }),
          },
        },
      },
    },

    /** Waits for the payload `build` raised, or for the failure it raised instead. */
    building: {
      on: {
        '@db.item.post': { target: 'posting' },
      },
    },

    posting: {
      invoke: {
        id: '@stashly.db.post',
        src: 'post',
        input: ({ event }) => {
          assertEvent(event, '@db.item.post')
          return event.payload
        },
        onDone: {
          target: 'classifying',
          actions: {
            type: 'classify',
            params: ({ event }) => ({ response: event.output }),
          },
        },
        onError: {
          actions: {
            type: 'fail',
            params: ({ event }) => ({
              stage: 'Item creation could not reach the server',
              cause: event.error,
            }),
          },
        },
      },
    },

    /**
     * The branch the old `if` chain got wrong. Its `res.type ===
     * 'opaqueredirect' && res.status === 302` guard could never match — an
     * opaque redirect needs `redirect: 'manual'`, which was never set, and
     * carries status 0 rather than 302 — so a sign-in redirect fell through to
     * `res.ok` and blew up inside `res.json()`.
     */
    classifying: {},

    created: { entry: 'report', always: { target: 'idle' } },
    refused: { entry: 'report', always: { target: 'idle' } },
    rejected: { entry: 'report', always: { target: 'idle' } },
    sessionExpired: { entry: 'report', always: { target: 'idle' } },
    failed: { entry: 'report', always: { target: 'idle' } },
  },
})
