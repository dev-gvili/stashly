import { setup, assign, assertEvent } from 'xstate'

export type ConfirmOptions = {
  title: string
  description?: any
  children?: any
  confirmText?: string
  cancelText?: string
  confirmProps?: any
  cancelProps?: any
  variant?: any
  size?: any
  asChild?: boolean
  onConfirm?: () => void | Promise<void>
  onCancel?: () => void | Promise<void>
}

/**
 * A state machine that manages the lifecycle of a confirmation dialog.
 *
 * @remarks
 * This machine handles opening and closing a confirmation dialog, capturing user responses,
 * and tracking the last result of the confirmation action.
 *
 * States:
 * - `idle`: The initial state where the dialog is closed
 * - `open`: The dialog is displayed and awaiting user input
 *
 * Events:
 * - `OPEN`: Opens the dialog with provided options
 * - `CONFIRM`: User confirms the action (sets lastResult to true)
 * - `CANCEL`: User cancels the action (sets lastResult to false)
 * - `CLOSE`: Closes the dialog without recording a result
 *
 * @example
 * ```ts
 * const confirmActor = createActor(confirmMachine).start();
 * confirmActor.send({ type: 'OPEN', props: { title: 'Delete item?' } });
 * confirmActor.send({ type: 'CONFIRM' });
 * ```
 */
export const confirmMachine = setup({
  types: {
    context: {} as { props?: ConfirmOptions; lastResult?: boolean | undefined },
    events: {} as
      | { type: 'OPEN'; props: ConfirmOptions }
      | { type: 'CLOSE' }
      | { type: 'CONFIRM' }
      | { type: 'CANCEL' },
  },
  actions: {
    setProps: assign({
      props: ({ event }) => {
        assertEvent(event, 'OPEN')
        return event.props
      },
    }),
    setLastResult: assign({ lastResult: ({ event }) => true }),
    clearProps: assign({ props: ({ context, event }) => undefined }),
    clearLastResult: assign({ lastResult: ({ context, event }) => false }),
    reset: assign({
      props: ({ context, event }) => undefined,
      lastResult: (_) => undefined,
    }),
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QGMD2A7AZgSwE4FsA6bCAGzAGIB5ABQFEA5AbQAYBdRUAB1VmwBdsGTiAAeiAIwAOAGyEATPICsMmQHZ5EpWoDMaqRIA0IAJ6IDhHarUsJMnVL0AWJ-IC+b42ix4iqLmDoFADCVAwAYgCSAEoAsqwcSCA8fILCSeII0nKKKuqa2noGxmYI8iw6hE4yLGpOUvK6akqyah5eGDgEhP6BIQCCDMF0ADIJIikCQugimdkKytYFTcWmiDrKhEpKTmoAnE57LHsSrnvtIN5dfgFBwSNUAMp040mTaTMZkrILeRpaKyMawQLjUhBk9SkTi0LiUjTsHk8IHQqAgcBEV18E14U3SoEyAFoZCVEETCCwKZSqVS2kjMd0SORsalprN1jIlJY1Kp7FCTtySWVdoQJFoWNYORIKnsZBd6TdAszcZ98YhXIKJI1CGoJE1lK4pHsdJrEW4gA */
  id: 'confirm',
  initial: 'idle',
  context: { props: undefined, lastResult: undefined },
  states: {
    idle: {
      on: {
        OPEN: {
          target: 'open',
          actions: ['setProps', 'clearLastResult'],
        },
      },
    },
    open: {
      on: {
        CONFIRM: {
          target: 'idle',
          actions: ['setLastResult', 'clearProps'],
        },
        CANCEL: {
          target: 'idle',
          actions: ['clearLastResult', 'clearProps'],
        },
        CLOSE: {
          target: 'idle',
          actions: ['reset'],
        },
      },
    },
  },
})
