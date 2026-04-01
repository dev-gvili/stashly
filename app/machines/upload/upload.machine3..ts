import {
  assertEvent,
  assign,
  enqueueActions,
  log,
  raise,
  sendTo,
  setup,
} from 'xstate'
import { fileMachine } from './file.machine'
import { config, mediafile, uploadProgress } from '../schema.zod'
import {
  type UploadManagerData,
  type UploadManagerEvents,
} from '../machine.types'

import { genericQueueMachine } from '../queue/queue.machine.1'
import type { User } from 'better-auth'

let initialData: UploadManagerData = {
  config: {
    user: undefined as unknown as User & {
      bucket: string
      subscriptionId: string
      storagePlanId: string
      driveId: string
    },
    maxConcurrentUploads: 5,
    maxFileSize: 10000000000,
  },
  mediaFiles: new Map(),
  fileActors: new Map(),
  queues: {
    active: new Set(),
    skipped: new Set(),
    completed: new Set(),
    pending: new Map(),
  },
}

const fileValidator = setup({
  types: {
    events: {} as {
      type: 'validate'
      item: { id: string; size: number }
    },
  },
}).createMachine({
  id: 'fileValidator',
  on: {
    validate: {
      actions: sendTo(
        ({ system }) => system.get('upload-manager-queue'),
        ({ event }) => {
          let { item } = event
          return {
            type: 'validation.result',
            itemId: item.id,
            result: item.size < 2 * 1024 * 1024 * 1024 ? 'allowed' : 'denied',
          }
        }
      ),
    },
  },
})

const uploadMachine = setup({
  types: {
    context: {} as UploadManagerData,
    events: {} as UploadManagerEvents,
  },
  actors: {
    fileMachine,
    fileValidator,
    queue: genericQueueMachine,
  },
  actions: {
    updateConfig: assign({
      config: ({ context, event }) => {
        assertEvent(event, 'upload.config')
        let parsedConfig = config.parse({
          ...event.config,
          user: event?.config.user ?? context.config.user,
        })
        return { ...context.config, ...parsedConfig }
      },
    }),
    spawnQueueActor: enqueueActions(({ enqueue }) => {
      enqueue.assign(({ spawn }) => {
        let actor = spawn('queue', {
          id: 'upload-manager-queue',
          input: {
            maxConcurrency: 5,
            worker: fileMachine,
            validator: fileValidator,
          },
        })
        return { uploadRef: actor }
      })
    }),
    addFile: assign({
      mediaFiles: ({ context, event }) => {
        assertEvent(event, 'upload.add')
        const { mediaFile } = event
        context.mediaFiles.set(mediaFile.id, mediaFile)
        return context.mediaFiles
      },
    }),
    sendToQueue: sendTo(
      ({ system }) => system.get('upload-manager-queue'),
      ({ event }) => {
        assertEvent(event, 'upload.add')
        return {
          type: 'add',
          item: event.mediaFile,
        }
      }
    ),
    spawnAndAssign: enqueueActions(({ context, event, enqueue, self }) => {
      assertEvent(event, 'upload.spawn')
      let mediaFile = mediafile.safeParse(event.mediaFile)
      if (mediaFile.success) {
        enqueue.assign(({ spawn }) => {
          let actor = spawn('fileMachine', {
            id: mediaFile.data.id,
            input: {
              user: context.config.user,
              parentRef: self,
              mediaFile: mediaFile.data,
            },
          })
          let actors = context.fileActors.set(mediaFile.data.id, actor)
          return { fileActors: actors }
        })
        enqueue.raise({
          type: 'upload.start',
          mediaFile: mediaFile.data,
        })
      } else {
        enqueue.assign({
          error: mediaFile.error.message,
        })
      }
    }),

    updateProgress: assign(({ context, event }) => {
      assertEvent(event, 'progress.change')
      let mediafileId = event.mediaFileId
      let mediaFile = uploadProgress.parse(event.progress)
      let mediafileToUpdate = context.mediaFiles.get(mediafileId)
      mediafileToUpdate!['progress'] = event.progress
      context.mediaFiles.set(mediafileId, mediafileToUpdate!)
      return context
    }),
    markAsAborted: assign(({ context, event }) => {
      assertEvent(event, 'upload.aborted')
      let mediaFile = mediafile.parse(event.mediaFile)
      let mediaFiles = context.mediaFiles.set(mediaFile.id, mediaFile)
      return {
        mediaFiles,
      }
    }),
    removeFromUploads: enqueueActions(({ context, event, enqueue }) => {
      assertEvent(event, ['upload.aborted', 'upload.done'])
      const mediaFile = mediafile.parse(event.mediaFile)
      enqueue.stopChild(mediaFile.id)

      enqueue.assign({
        fileActors: new Map(
          [...context.fileActors.entries()].filter(
            ([id]) => id !== mediaFile.id
          )
        ),
      })
    }),

    sendAbortUpload: enqueueActions(({ event, enqueue }) => {
      assertEvent(event, 'upload.abort')
      enqueue.sendTo(event.mediaFileId, {
        type: 'abort',
      })
    }),
    markAsDone: assign(({ context, event }) => {
      assertEvent(event, 'upload.done')
      let mediaFile = mediafile.parse(event.mediaFile)
      let mediaFiles = context.mediaFiles.set(mediaFile.id, mediaFile)
      return {
        mediaFiles,
      }
    }),
    markAsStarted: assign(({ context, event }) => {
      assertEvent(event, 'upload.started')
      let mediafileToUpdate = mediafile.parse(
        context.mediaFiles.get(event.mediaFileId)
      )
      let mediaFiles = context.mediaFiles.set(event.mediaFileId, {
        ...mediafileToUpdate,
        status: 'uploading',
      })
      return {
        mediaFiles,
      }
    }),
    sendToUploader: sendTo(
      ({ event }) => {
        assertEvent(event, 'upload.start')
        return event.mediaFile.id
      },
      { type: 'start' }
    ),
    spawnUploader: assign({
      fileActors: ({ context, event, spawn, self }) => {
        assertEvent(event, 'upload.spawn')
        let mediaFile = mediafile.parse(event.mediaFile)
        let actor = spawn('fileMachine', {
          id: mediaFile.id,
          input: {
            user: context.config.user,
            parentRef: self,
            mediaFile: mediaFile,
          },
        })
        return context.fileActors.set(mediaFile.id, actor)
      },
    }),
  },
}).createMachine({
  id: 'upload-manager',
  initial: 'running',
  context: () => ({
    ...initialData,
  }),
  entry: "spawnQueueActor",
  on: {
    'upload.config': {
      actions: 'updateConfig',
    },
    'upload.add': {
      actions: ['addFile', 'sendToQueue'],
    },
    'progress.change': {
      actions: 'updateProgress',
    },
    'upload.abort': {
      actions: 'sendAbortUpload',
    },
    'upload.remove': {
      actions: 'removeFromUploads',
    },
    'upload.aborted': {
      actions: ['markAsAborted', 'removeFromUploads'],
    },
    'upload.started': {
      actions: 'markAsStarted',
    },
    'upload.done': {
      actions: ['markAsDone', 'removeFromUploads'],
    },
    'upload.close': {
      target: 'success',
    },
    'upload.error': {
      target: 'error',
    },
    // from queue
    process: {
      actions: [log('process'), 'spawnUploader', 'sendToUploader'],
    },
  },
  states: {
    running: {},
    success: {
      entry: ({ context, event }) => {
        // Success entry
      },
    },
    error: {
      entry: ({ context, event }) => {
        // Error entry
      },
    },
  },
})

export { uploadMachine }
