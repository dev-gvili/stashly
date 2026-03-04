import { setup, assign, fromPromise } from 'xstate'
import { z } from 'zod'
import type {
  PaginationCursorData,
  PaginationOffsetData,
} from '@/utils/pagination'

// --- Types and Schemas ---

export type PaginatedResponse<T> =
  | PaginationCursorData<T>
  | PaginationOffsetData<T>

const ItemSchema = z.object({
  id: z.string(),
})
const ItemsSchema = z.array(ItemSchema)

const LoaderDataSchema = z.custom<PaginatedResponse<{ id: string }>>()

// --- Machine Definition ---

export const infiniteScrollMachine = setup({
  types: {
    context: {} as {
      items: PaginatedResponse<{ id: string }>['data']
      loaderData: PaginatedResponse<{ id: string }>
      metadata: PaginatedResponse<{ id: string }>['metadata']
      storageKey: string
    },
    events: {} as
      | {
          type: 'FETCH_SUCCESS'
          data: PaginatedResponse<{ id: string }>
        }
      | { type: 'LOAD_MORE' }
      | { type: 'RESET' },

    input: {} as {
      loaderData: PaginatedResponse<{ id: string }>
      storageKey: string
    },
  },
  actors: {
    restoreFromSession: fromPromise<
      PaginatedResponse<{ id: string }>,
      { storageKey: string }
    >(async ({ input }) => {
      if (typeof window === 'undefined') return []
      const saved = sessionStorage.getItem(input.storageKey)
      if (!saved) return []
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          return LoaderDataSchema.parse(parsed)
        } catch (e) {
          console.error('Failed to parse session data', e)
          return []
        }
      }
    }),
  },
  actions: {
    assignLoaderData: assign({
      loaderData: ({ event }) => {
        if (event.type !== 'FETCH_SUCCESS') throw new Error('Invalid event')
        return event.data
      },
    }),
    assignInitialItems: assign({
      items: ({ context }) => context.loaderData.data,
    }),
    appendItems: assign({
      items: ({ context, event }) => {
        if (event.type !== 'FETCH_SUCCESS') return context.items
        const newItems = event.data.data
        const seen = new Set(context.items.map((item) => item.id))
        const uniqueNewItems = newItems.filter((item) => !seen.has(item.id))
        return [...context.items, ...uniqueNewItems]
      },
    }),
    assignRestoredItems: (
      _,
      params: { items: PaginatedResponse<{ id: string }>['data'] }
    ) => ({
      items: params.items,
    }),
    clearItems: assign({ items: [] }),
  },
  guards: {
    hasMore: ({ context }) => !context.loaderData.metadata.isComplete,
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QEsB2AzNyAuYDKAxgE4D2ANmQHRFzYlFpQDEEJqYlaAbiQNYdpMqHPmLkqNWHQaooCbiQIBDbMjYBtAAwBdLdsSgADiVg41qAyAAeiAEwBOAGyUAzG4CsARkefbngOwAHAEANCAAnnYutpSe9oHu9raB-smBACwugQC+2WGCWLiEpBTUtPSMTGBEpESUhmQq6PQAtpwYhaIlEuUycgrKqho6epbGpkMWSNZ2Tq4e3r4Bwf5hkQieCbEpXrZ7munpKbn5HcJFYqXIEGRgTAAyAPIAggAiAPoAso8ASgCio2m4zMbEsNgQjlSrnsmk0e38jncLns6TWiHSsMo7k0kLi-iR9n8Lk8JxABXOXXEnBud3+eD+ABVAUYTCCpqBwZCYsjYfDEcjURE7MlKBjPHD-JKAukkjk8mSziJilSyCQlBBGJ96HcAGKMgDCAAl3ngAKr6-V-PB4ZkgYGTMGILnQ3m2BEEwXrN2BUW+RyHNz+5LpUnkpWXHqwMDYVSyJi2+3mR0IBH2Siaez2TzpfxJPOaTxojbBVyBTM5zxxYkuRyhxUXbqUaq1B4vD7ff4J1kO6acqE8uFu-kooueYmuIJuTTudzpRwudKzutCcON5v0Jh0xldiZJ3tO-swwfugVFks13HIsv2Gc53Ly1AkCBwSxhhviMbdvccxAAWkcRb-sunTKqUkjSIwn67qC+4IOktijv46SUPivJxLOhKaP4wEUqBVDXLcUFssm7git4mSeEikIYnso5ZrEmZjoS9hZGkOGriqaoarIWo0ERPY-ggKQuChOLpJRsJJAWRbEsh-ibLmSJuIS+Lse+YFwNGsZQPx34zEJRKif6EkZrY0lChs7jOESGZWY4yS2IckpqZSpTrkQukwYJpE+uRxJUUhg5nj6Bykf6c5HL4gS1veQA */
  id: 'infiniteScroll',
  context: ({ input }) => ({
    items: input.loaderData.data,
    storageKey: input.storageKey,
    loaderData: input.loaderData,
    metadata: input.loaderData.metadata,
  }),
  initial: 'restoring',
  states: {
    restoring: {
      invoke: {
        src: 'restoreFromSession',
        input: ({ context }) => ({ storageKey: context.storageKey }),
        onDone: {
          target: 'idle',
          actions: {
            type: 'assignRestoredItems',
            params: ({ event }) => ({ items: event.output }),
          },
        },
        onError: 'idle',
      },
    },
    idle: {
      on: {
        LOAD_MORE: 'loadingMore',
        RESET: 'resetting',
      },
    },
    loadingMore: {
      on: {
        FETCH_SUCCESS: {
          target: 'idle',
          actions: ['assignLoaderData', 'appendItems'],
        },
      },
    },
    resetting: {
      entry: 'clearItems',
      always: 'idle', // Or could be a specific 'loading' state for resets
    },
    error: {
      on: {
        LOAD_MORE: 'loadingMore',
        RESET: 'resetting',
      },
    },
  },
})
