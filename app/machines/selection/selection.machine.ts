import { setup, assign, assertEvent } from 'xstate'

export const selectionMachine = setup({
  types: {
    context: {} as {
      items: string[]
      selectedIds: string[]
      lastChecked: string | null
      paramName?: string
    },
    events: {} as
      | { type: 'SET_ITEMS'; items: string[] }
      | { type: 'SET_SELECTED'; selected: string[]; paramName?: string }
      | {
          type: 'TOGGLE'
          id: string
          checked: boolean
          shiftKey?: boolean
          paramName?: string
        }
      | { type: 'SELECT_ALL'; paramName?: string }
      | { type: 'UNSELECT_ALL'; paramName?: string }
      | { type: 'SET_LAST_CHECKED'; id: string | null },
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5SzAGzAYwC4EsD2AdgHQBOYAhhAJ4DEAygKIAqA+gJJMMCydA2gAwBdRKAAOeWDlyERIAB6IA7IqIBWAEzqAbAA5+qjZoCcBgDQgqiAMxaVOmztX8r6gCzrVARkUBfH+ZR0bHxiMkpaRlZGABkGAGFOABEBYSQQcUlpAlkFBC11In5+e35PdSMyq09XVXNLBHVFAqtXXX51UvLXRSM-ALRMLNIKanpmFmiAQTpWOIAJeIBpBmShWQypEJzEdzrEby0iR1tVK0VSrVdXflc+kEDBkOHwmiYAeQBxD9iU9YlNmRpXI6FSqLSeKxGRRXTSeVQ6Ix7BA6TxEGy2fSQ5zXTy9O4EPAQOCyB7BQFif5ZbYIAC0WiRdLupKGYWof0yWyBiBBaNORh03W8HUaSNaOjR2gROi0VgMctUfj8QA */
  id: 'selection',
  initial: 'ready',
  context: {
    items: [],
    selectedIds: [],
    lastChecked: null,
    paramName: 'selectedItems',
  },
  states: {
    ready: {
      on: {
        SET_ITEMS: {
          actions: assign({ items: ({ event }) => event.items }),
        },
        SET_SELECTED: {
          actions: assign(({ event }) => ({
            selectedIds: event.selected,
            paramName: event.paramName ?? 'selectedItems',
          })),
        },
        // Anchor point for shift+click range selection
        SET_LAST_CHECKED: {
          actions: assign({ lastChecked: ({ event }) => event.id }),
        },
        SELECT_ALL: {
          actions: assign(({ context, event }) => ({
            selectedIds: [...(context.items ?? [])],
            lastChecked: null,
            paramName: event.paramName ?? context.paramName ?? 'selectedItems',
          })),
        },
        UNSELECT_ALL: {
          actions: assign(({ context, event }) => ({
            selectedIds: [],
            lastChecked: null,
            paramName: event.paramName ?? context.paramName ?? 'selectedItems',
          })),
        },
        TOGGLE: {
          actions: assign(({ context, event }) => {
            // ensure correct typing
            assertEvent(event, 'TOGGLE')
            const id = event.id
            const checked = event.checked
            const shiftKey = !!event.shiftKey
            const param = event.paramName ?? context.paramName ?? 'selectedItems'

            const items = context.items || []
            const selected = context.selectedIds || []

            // Shift-range behavior
            if (shiftKey && context.lastChecked) {
              const start = items.indexOf(context.lastChecked)
              const end = items.indexOf(id)
              if (start !== -1 && end !== -1) {
                const [from, to] = start < end ? [start, end] : [end, start]
                const range = items.slice(from, to + 1)

                if (checked) {
                  const combined = Array.from(new Set([...selected, ...range]))
                  return {
                    selectedIds: combined,
                    lastChecked: id,
                    paramName: param,
                  }
                } else {
                  const remaining = selected.filter((s) => !range.includes(s))
                  return {
                    selectedIds: remaining,
                    lastChecked: id,
                    paramName: param,
                  }
                }
              }
              // Fall through to single toggle if range validation fails
            }

            // Single toggle
            if (checked) {
              if (!selected.includes(id)) {
                return {
                  selectedIds: [...selected, id],
                  lastChecked: id,
                  paramName: param,
                }
              }
              return { lastChecked: id, paramName: param }
            } else {
              const remaining = selected.filter((s) => s !== id)
              return {
                selectedIds: remaining,
                lastChecked: id,
                paramName: param,
              }
            }
          }),
        },
      },
    },
  },
})

export default selectionMachine
