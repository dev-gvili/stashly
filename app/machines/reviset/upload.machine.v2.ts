// upload.machine.ts
import {
  assign,
  setup,
  assertEvent,
  enqueueActions,
  type AnyActorRef,
} from 'xstate'
import { fileMachine } from './file.machine'
import { queueMachine } from './queue.machine.1'
import type {
  UploadManagerData,
  UploadManagerEvents,
  User,
} from '../machine.types'

// The parent machine's context, acting as the single source of truth.
type UploadManagerContext = Omit<UploadManagerData, 'queues'> & {
  queueRef: AnyActorRef
}

let initialData: UploadManagerContext = {
  config: {
    user: undefined as unknown as User,
    maxConcurrentUploads: 5,
    maxFileSize: 10000000000,
  },
  mediaFiles: new Map(),
  fileActors: new Map(),
  queueRef: {} as AnyActorRef, // Will be spawned in the 'initializing' state
}

const uploadMachine = setup({
  types: {
    context: {} as UploadManagerContext,
    events: {} as UploadManagerEvents,
  },
  actors: {
    fileMachine,
    queueMachine,
  },
  actions: {
    // Adds a file to the central Map and sends the ID to the queue machine.
    addFileToContextAndQueue: enqueueActions(({ context, enqueue, event }) => {
      assertEvent(event, 'upload.add')
      // Add the full MediaFile object to the central map
      const newMediaFiles = new Map(context.mediaFiles).set(
        event.mediaFile.id,
        event.mediaFile
      )
      enqueue.assign({ mediaFiles: newMediaFiles })
      // Send the file ID to the queue machine
      enqueue.sendTo(context.queueRef, {
        type: 'queue.add',
        mediaFileId: event.mediaFile.id,
      })
    }),

    // Spawns a new file actor and assigns it to the context.
    spawnAndAssignFileActor: assign(({ spawn, context, event, self }) => {
      assertEvent(event, 'upload.spawn')

      // Get the full MediaFile object from the central map using the ID.
      const mediaFile = context.mediaFiles.get(event.mediaFile.id)
      if (!mediaFile) {
        console.error(`Media file with ID ${event.mediaFile.id} not found.`)
        return {}
      }

      // Spawn a new file actor with the necessary input.
      const fileActor = spawn('fileMachine', {
        id: `file-${mediaFile.id}`,
        input: { mediaFile, user: context.config.user, parentRef: self },
      }) as AnyActorRef

      // Add the new actor reference to the fileActors map.
      const newFileActors = new Map(context.fileActors).set(
        mediaFile.id,
        fileActor
      )

      return {
        fileActors: newFileActors,
      }
    }),

    // Marks a file as started in the context and informs the queue.
    markFileAsStartedInContext: enqueueActions(
      ({ context, enqueue, event }) => {
        assertEvent(event, 'upload.started')
        // Update the status in the central mediaFiles map
        const mediaFile = context.mediaFiles.get(event.mediaFileId)
        if (mediaFile) {
          const newMediaFiles = new Map(context.mediaFiles).set(mediaFile.id, {
            ...mediaFile,
            status: 'uploading',
          })
          enqueue.assign({ mediaFiles: newMediaFiles })
        }
        // Forward the event to the queue machine
        enqueue.sendTo(context.queueRef, event)
      }
    ),

    // Marks a file as done in the context and removes the actor.
    markFileAsDoneInContext: enqueueActions(({ context, enqueue, event }) => {
      assertEvent(event, 'upload.done')
      // Update the status in the central mediaFiles map
      const mediaFile = context.mediaFiles.get(event.mediaFile.id)
      if (mediaFile) {
        const newMediaFiles = new Map(context.mediaFiles).set(mediaFile.id, {
          ...mediaFile,
          status: 'done',
          etag: event.mediaFile.etag,
        })
        enqueue.assign({ mediaFiles: newMediaFiles })
      }
      // Forward the event to the queue machine
      enqueue.sendTo(context.queueRef, event)
    }),

    // ... (other actions for aborting, etc., would follow the same pattern) ...
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QFcAOAbA9gQwgWWwDtsYAnAOgEtDKAXS7dSgL2qgGIBtABgF1FQqTLDqVMhASAAeiAEzdu5AJyyALPIAcAZgCsK9aoDsAGhABPRKoBss8loCMO2To06bW1S60Bfb6bRYuATEZFQQ6GDsATgQ5LgQPPxIIEIi9OKSMgiySopKhlpKGva5ViVW3FamFghaVobk2lba9lqGNgVWvv4YMcEkYBSU4ZHRuOSwqNgA7oSJkqmiGclZOVbkOYY6qjsa3CqyhqrVcoa2HvUaGkYaVlrO3SBj+EQDQyNRveOwtNiktJB5slFukJCs5LlyDoHDpuFtdkorPUTgh7O1Gm4jjoXPslPZVI9nv1QsMIp9ArEIOIwEDBMIlmDQKtEcoyrI7lYnOybCjinYkYZuOztLpuLpfH4QIRMBA4JIia8yAt6aDMogALRVcwa9YKPX6g2GQlfF4hQZUGj0RgsNjKtJiRnSSyyFGqNrkTk2N2tbg6ArGinE82ksB2hlq2qqJTKQ5qNr2ezcH1aV3NOzCo6HQr4zkS7xAA */
  id: 'uploadManager',
  initial: 'initializing',
  context: initialData,
  states: {
    initializing: {
      entry: assign(({ spawn, context, self }) => {
        const queueActor = spawn('queueMachine', {
          id: 'queueService',
          input: {
            config: context.config,
            parent: self,
          },
        })
        return {
          queueRef: queueActor,
        }
      }),
      always: 'idle',
    },
    idle: {
      on: {
        'upload.add': {
          actions: 'addFileToContextAndQueue',
        },
        'upload.spawn': {
          actions: 'spawnAndAssignFileActor',
        },
        'upload.started': {
          actions: 'markFileAsStartedInContext',
        },
        'upload.done': {
          actions: 'markFileAsDoneInContext',
        },
        // ... (other events would be added here) ...
      },
    },
  },
})
