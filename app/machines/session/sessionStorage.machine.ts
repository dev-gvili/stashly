import { setup, assign, assertEvent, createActor } from 'xstate'

export const sessionMachine = setup({
  types: {
    context: {} as { key?: string; error?: string; value?: string },
    events: {} as
      | { type: 'read'; key: string }
      | { type: 'write'; key: string; value: string }
      | { type: 'delete'; key: string }
      | { type: 'key'; index: number }
      | { type: 'clear' },
  },
  actions: {
    getItem: assign(({ event }) => {
      assertEvent(event, 'read')
      const value = sessionStorage.getItem(event.key)
      if (!value) {
        return {
          error: `Key ${event.key} not found in sessionStorage`,
        }
      }
      return {
        key: event.key,
        value,
      }
    }),
    setItem: assign(({ event }) => {
      try {
        assertEvent(event, 'write')
        sessionStorage.setItem(event.key, event.value)
        return {
          key: event.key,
          value: event.value,
        }
      } catch (error) {
        return {
          error: 'Error setting item in sessionStorage',
        }
      }
    }),
    removeItem: assign(({ event }) => {
      try {
        assertEvent(event, 'delete')
        sessionStorage.removeItem(event.key)
        return {
          key: event.key,
        }
      } catch (error) {
        return {
          error: 'Error deleting from sessionStorage',
        }
      }
    }),
    keyItem: assign(({ event }) => {
      assertEvent(event, 'key')
      const key = sessionStorage.key(event.index)
      if (!key) {
        return {
          error: `Index ${event.index} not found in sessionStorage`,
        }
      }
      return {
        key,
      }
    }),
    clear: assign(({ event }) => {
      try {
        assertEvent(event, 'clear')
        sessionStorage.clear()
        return {}
      } catch (error) {
        return {
          error: 'Error clearing sessionStorage',
        }
      }
    }),
  },
  guards: {
    clientLoaded: (_) => typeof window !== 'undefined',
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5SzrAlgewHYGUAuGATgIYwCyxWpYhAdGhADZgDEhYxEA2gAwC6iUAAcM6PJiyCQAD0QBWACwB2WgCYAjAA5l6nQGYe6pQBoQAT0Sq5Knpo167qgJxz1ANlUBfT6ZSx02PhE1BRUMHQMzCwA7oRoeGC8AkggImISUrIIiioa2kq6BQZGphbZTk601m5u6qo8enJymppO3r6oEkEk5JTUEUysEGDMCUlSafEZKVk5alo6+oYm5oh1PGpuSk5Kbjx7eh5OCu0gfgG4BD1gof30gywA1mBm4ymT4tiZ8srz+YXqYorMpKQ60PROHhKJQKerKWFeHxnTqBK4hPrhe5RADGzGIhDewlEUy+Mx+uQWBSWJVWCE0oLUPAUTkOelBrTkblO5y6aN6YRoWNYADNiGhGABXdiE1LEz6SMnZX55RZFZalRBsty0SFOZxKVSqPR6Q1cpE81HBfl3SKsWAS7HY1Ayj7TUCzZWUgFAjUIZSVGHHOQGBRGOx6bxIrAYYbwFIWy5Wm4YmgTOVumSIAC0bl9OdoPELReLxaU3JRieut0xtrT6VJ7sQsN9dUqofpblhkNqxzNHX8vKT1cF7E4aCwUDrJIVjYQNQDBUMsIUDk0NLKeVoWlsnc0cisDWD5YHlqrKbosSmE6n8u+c7cC-US9UK5a6-ke1oW2DDjczWqEbmhW3TogKdDsAAthgABu46Tu86YNpm96Ps+r5rsCiBruCNRKDwqhuJoxpyIex4XCB1qYriHBxNeCH1jOyHzrQ0JProL6ru+dJ6Ao4INDUzhOIRRFkYOZ5gbQzxmHBN4ZlkzGsWhnGYXOOy0AoHKFnY0LOH2yInpWoF3PajqoLJSHyQ+LGLux6FcQo1i0ERrh2NohjuCuomnkZmKiuKUpgOZjGWahtnKb6jS8RUJGqHhGh-oRkaeEAA */
  context: {
    key: undefined,
    error: undefined,
    value: undefined,
  },
  id: 'sessionStorageManager',
  initial: 'verifying',
  states: {
    verifying: {
      always: {
        target: 'active',
        guard: 'clientLoaded',
      },
    },
    active: {
      on: {
        read: {
          actions: 'getItem',
          description: 'The machine is reading a value from sessionStorage.',
        },
        write: {
          actions: 'setItem',
          description: 'The machine is writing a value to sessionStorage.',
        },
        delete: {
          actions: 'removeItem',
          description: 'Remove an item from sessionStorage.',
        },
        key: {
          actions: 'keyItem',
          description: 'Getting the item key name based on the index.',
        },
        clear: {
          actions: 'clear',
          description: 'Remove all items from sessionStorage.',
        },
      },
      description:
        'The machine is in an active state, waiting for an operation to perform.',
    },
  },
})


const sessionService = createActor(sessionMachine).start()
export { sessionService }