import { assertEvent, sendTo, setup, assign } from 'xstate'
import type { QuotaContext, QuotaEvents, QuotaOutput } from '../machine.types'
import { verifyQuota, findQuota, updateQuota, checkQuota } from './quota.actors'

export const quotaMachine = setup({
  types: {
    context: {} as QuotaContext,
    events: {} as QuotaEvents,
    output: {} as QuotaOutput,
  },
  actions: {
    assignQuota: (_, params: { quota: QuotaOutput['quota'] }) => ({
      quota: params.quota,
    }),
    assignError: (_, params: { error: string }) => ({
      error: params.error,
    }),
    sendResults: sendTo(
      ({ context}) => {
        return context?.replayTo
      },
      ({ event }) => {
        return {
          ...event,
          type: 'validation.result',
        }
      }
    ),
  },
  actors: {
    verify: verifyQuota,
    check: checkQuota,
    find: findQuota,
    update: updateQuota,
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QEcCuB7ALgQwHQEsIAbMAYgAE0s8BjACzBoGsBtABgF1FQAHdWfJnzoAdtxAAPRAEYAnADZcAJiUBWefOkBmACyy2bWUoDsAGhABPRCq25VWw6uNKdzpQ60BfT+ao4CxGSUGP4AZvgiEOxcSCB8AkKi4lIIcooq6pq6+oYm5lYIWvK2bFrSqtrS8qoAHBXy3r4heIQkFH54qDwQ2Jhg0eLxgsJisSlpymoa2noGRmaWiKo6Nbhs0myqBlo1VfpKjSAduPSMTKQQomAEIgBu6EzX5LA4sHREFrjHp8wDsUOJUagFLyWSyXC7NQbJSyGqlYyqfLWOF2VRghQqWTGNg6Lw+I7NE4MZikMAAJzJ6DJuB4RF6oSpAFtcM9Xu9Pt9iaxOIN+MMkmNEKDwZCKmwYXCtAikakaqs2Nitkp5EppMYanpDsdwpELlcbvdHiyXtg3h8voSdVEef8+YDkkKwRDpFDxbD4YjFggdEo2Gt5JtVKqVlotEoalrLREIKSKVSaXTMAyyczWab2RbqLgrX9eHaRg6EMLna6JR6ZWHjHZjBtasscTNVJGs10en09SJrhFDU8TWaOYTW71+ja8wkC4Ki07RdD3VLPQUA6o1lpZPZZEUdGqqs3-EP2+TKdTafSmca2ebjvuRzEx-ygZJHSKXWKy-OZRUlKiDDonOo1Cou54LAqA0DQcCwKQuZxPmArAogdTLsqmwqCoLryMY8gyqCVZBvoYZYr6+iyEBuCHlSUGjjB45wY+CCIcoS6oaqyqYTKuy4EUGg1M4LoOBUTaHCI6AQHA4gdLyNEPikAC0WFenJawGMpKkqcYpGtGAkn3oWPoykYuAvsh8i-ph8gaqRPxMNp9qTlKVaYWGcrSOUNSyC6Mq+n6UpoTURSYWi5mkVaNkTvBhRrrgAawjUKomTooLSBWq4Qs4xjGD6sXhjUBz4le3TDqFtEpFK0hrDxOwrDhNalB+LgQhUmHlOK6EkXlhIgWBEFFdJiBYiKGE5dIOhsKCqo1DKOi4rg7nIQ2WJ6MspHkWSPWFv1EKDcGo1GNIE1eqqihGGoWxuWG6zqd4nhAA */
  id: 'quota',
  context: {
    quota: {
      driveId: '',
      id: '',
      deleted: BigInt(0),
      total: BigInt(0),
      used: BigInt(0),
      remaining: BigInt(0),
      status: 'normal',
    },
    error: undefined,
  },
  initial: 'idle',
  states: {
    idle: {
      on: {
        '@quota.check': {
          target: 'check',
        },
        '@quota.verify': {
          target: 'verify',
        },
        '@quota.find': {
          target: 'find',
        },
        '@quota.update': {
          target: 'update',
        },
      },
    },
    check: {
      invoke: {
        id: '@stashly.quota.check',
        src: 'check',
        input: ({ event }) => {
          assertEvent(event, '@quota.check')
          return { ...event }
        },
        onDone: {
          target: 'success',
        },
        onError: {
          target: 'error',
          actions: {
            type: 'assignError',
            params: ({ event }) => ({
              error: event.error as string,
            }),
          },
        },
      },
    },
    verify: {
      invoke: {
        id: '@stashly.quota.verify',
        src: 'verify',
        input: ({ event }) => {
          assertEvent(event, '@quota.verify')
          return { ...event }
        },
        onDone: {
          target: 'success',
        },
        onError: {
          target: 'error',
          actions: {
            type: 'assignError',
            params: ({ event }) => ({
              error: event.error as string,
            }),
          },
        },
      },
    },
    find: {
      invoke: {
        id: '@stashly.quota.find',
        src: 'find',
        input: ({ event }) => {
          assertEvent(event, '@quota.find')
          return { ...event }
        },
        onDone: {
          target: 'success',
          actions: {
            type: 'assignQuota',
            params: ({ event }) => ({ quota: event.output }),
          },
        },
        onError: {
          target: 'error',
          actions: {
            type: 'assignError',
            params: ({ event }) => ({
              error: event.error as string,
            }),
          },
        },
      },
    },
    update: {
      invoke: {
        id: '@stashly.quota.update',
        src: 'update',
        input: ({ event }) => {
          assertEvent(event, '@quota.update')
          return { ...event }
        },
        onDone: {
          target: 'success',
          actions: {
            type: 'assignQuota',
            params: ({ event }) => ({ quota: event.output }),
          },
        },
        onError: {
          target: 'error',
          actions: {
            type: 'assignError',
            params: ({ event }) => ({
              error: event.error as string,
            }),
          },
        },
      },
    },
    success: {
      entry: 'sendResults',
      always: {
        target: 'idle',
      },
    },
    error: {
      always: {
        target: 'idle',
      },
    },
  },
})
