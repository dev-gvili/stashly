import { setup, assign, fromPromise, sendTo, log } from 'xstate'

// Helper to get items from session storage
const restoreFromCache = fromPromise<{ output: any[] }, { storageKey: string }>(
  async ({ input }) => {
    const { storageKey } = input

    if (typeof window === 'undefined') {
      throw new Error('Not in a browser environment')
    }

    const savedItems = sessionStorage.getItem(storageKey)

    if (!savedItems) {
      throw new Error('No items in cache')
    }

    return { output: JSON.parse(savedItems) }
  }
)

// Helper to fetch data (simulates a network request)
const fetchData = fromPromise(async ({ input }) => {
  const { take, items } = input
  await new Promise((resolve) => setTimeout(resolve, 1000))

  const newItems = Array.from({ length: take }, (_, i) => ({
    id: `item-${items.length + i}`,
    name: `Item ${items.length + i}`,
  }))

  const isComplete = Math.random() > 0.7

  return {
    data: newItems,
    metadata: { isComplete },
  }
})

export const infiniteScrollMachine = setup({
  types: {
    context: {} as {
      items: any[]
      take: number
      error: string | null
      storageKey: string
    },
    events: {} as
      | { type: 'LOAD_MORE' }
      | { type: 'SEARCH_PARAMS_CHANGED'; storageKey: string }
      | { type: 'xstate.done.actor.restoreFromCache'; output: any[] }
      | { type: 'xstate.error.actor.restoreFromCache' }
      | {
          type: 'xstate.done.actor.fetchData'
          output: { data: any[]; metadata: { isComplete: boolean } }
        }
      | { type: 'xstate.error.actor.fetchData'; error: Error },
  },
  actors: {
    restoreFromCache,
    fetchData,
  },
  actions: {
    saveToCache: ({ context }) => {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(
          context.storageKey,
          JSON.stringify(context.items)
        )
      }
    },
  },
}).createMachine({
  id: 'infiniteScroll',
  initial: 'initializing',
  context: {
    items: [],
    take: 20,
    error: null,
    storageKey: 'infinite_scroll_default',
  },
  states: {
    initializing: {
      invoke: {
        src: 'restoreFromCache',
        input: ({ context }) => ({ storageKey: context.storageKey }),
        onDone: {
          target: 'idle',
          actions: assign({ items: ({ event }) => event.output }),
        },
        onError: {
          target: 'loading', // Nothing in cache, load initial items
        },
      },
    },
    idle: {
      on: {
        LOAD_MORE: 'loading',
      },
    },
    loading: {
      invoke: {
        src: 'fetchData',
        input: ({ context }) => ({ take: context.take, items: context.items }),
        onDone: [
          {
            target: 'success',
            guard: ({ event }) => event.output.metadata.isComplete,
            actions: assign({
              items: ({ context, event }) => [
                ...context.items,
                ...event.output.data,
              ],
            }),
          },
          {
            target: 'idle',
            actions: assign({
              items: ({ context, event }) => [
                ...context.items,
                ...event.output.data,
              ],
            }),
          },
        ],
        onError: {
          target: 'error',
          actions: assign({ error: ({ event }) => event.error }),
        },
      },
    },
    error: {
      on: {
        LOAD_MORE: 'loading', // Allow retrying
      },
    },
    success: {
      type: 'final',
    },
  },
  on: {
    SEARCH_PARAMS_CHANGED: {
      target: 'loading',
      actions: assign({
        items: [],
        storageKey: ({ event }) => event.storageKey,
      }),
    },
  },
  exit: 'saveToCache',
})
