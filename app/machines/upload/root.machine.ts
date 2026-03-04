// app/machines/root.machine.ts (optional - only if you want high-level tracking)
import {
  setup,
  assign,
  spawnChild,
  type ActorRefFrom,
  type AnyActorRef,
  enqueueActions,
} from 'xstate'
import { uploadMachine } from './upload.machine'

export const rootMachine = setup({
  types: {
    context: {} as {
      uploadManager: AnyActorRef | null
      stats: {
        totalFiles: number
        processing: number
        completed: number
      }
    },
    events: {} as
      | {
          type: 'FILES.ADDED'
          count: number
        }
      | {
          type: 'PROCESSING.COMPLETED'
        }
      | {
          type: 'UPLOAD.COMPLETED'
        },
  },
  actions: {
    // Action to spawn a upload manager actor
    spawnUploadManager: enqueueActions(({ context, event, enqueue }) => {
      enqueue.assign(({ spawn }) => {
        let actor = spawn('uploadManager', {
          id: 'uploadManager',
        })
        return { uploadManager: actor }
      })
    }),
  },
  actors: {
    uploadManager: uploadMachine,
  },
}).createMachine({
  id: 'root',
  context: () => ({
    uploadManager: null,
    stats: { totalFiles: 0, processing: 0, completed: 0 },
  }),
  initial: 'running',
  states: {
    running: {
      // Just spawn the upload manager and let it handle everything
      entry: 'spawnUploadManager',
    },
  },
})
