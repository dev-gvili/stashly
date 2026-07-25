import {
  assign,
  setup,
  assertEvent,
  enqueueActions,
  and,
  not,
  sendTo,
  fromPromise,
  type AnyActorRef,
} from 'xstate'
import { fileMachine } from '../reviset/file.machine'
import { toCategory } from '@/utils/converters'
// import { fileMachine } from './file.v2.machine'
// import { fileMachine } from './file.machine'
import { quotaMachine } from '@/machines/quota/quota.machine'
import type {
  MediaFile,
  UploadManagerData,
  UploadManagerEvents,
} from '@/types/machine.types'
import { config, mediafile, uploadProgress } from '@/schemas/machine.schemas'
import type { User } from '@/services/auth.types'

let initialData: UploadManagerData = {
  config: {
    user: undefined as unknown as User & {
      bucket: string
      subscriptionId: string
      storagePlanId: string
      driveId: string
      rootId: string
    },
    maxConcurrentUploads: 100,
    maxFileSize: 10000000000,
  },
  quotaActor: undefined,
  mediaFiles: new Map(),
  fileActors: new Map(),
  queues: {
    active: new Set(),
    skipped: new Set(),
    completed: new Set(),
    pending: new Map(),
  },
  error: undefined,
  isVisible: false,
  dismissed: new Set(),
}

const uploadMachine = setup({
  types: {
    context: {} as UploadManagerData,
    events: {} as UploadManagerEvents,
  },
  actors: {
    fileMachine,
    quotaMachine,
    createDbItem: fromPromise(
      async ({
        input,
      }: {
        input: {
          mediaFile: MediaFile
          user: UploadManagerData['config']['user']
          parent: AnyActorRef
        }
      }) => {
        const { mediaFile, user, parent } = input
        try {
          const category = toCategory(mediaFile.file)
          let formData = new FormData()
          formData.append('intent', 'create_upload_item')
          formData.append('id', mediaFile.id)
          formData.append('name', mediaFile.file.name)
          formData.append('key', mediaFile.key)
          formData.append('size', String(mediaFile.file.size))
          formData.append('mimeType', mediaFile.file.type ?? '')
          formData.append('etag', mediaFile.etag ?? '')
          formData.append('bucket', user.bucket)
          formData.append('driveId', user.driveId)
          formData.append('parentId', mediaFile.key.split('/')[0])
          formData.append('ownerId', mediaFile.ownerId ?? user.id)
          formData.append('category', category)
          formData.append('uploadId', mediaFile.uploadId ?? '')

          const res = await fetch('/api/items', {
            method: 'POST',
            body: formData,
          })
          if (res.type === 'opaqueredirect' && res.status === 302) {
            // This is a redirect response, which we treat as a success case for item creation. The actual redirection will be handled by the client.
            return
          }
          if (!res.ok && res.type !== 'opaqueredirect') {
            throw new Error(`Item creation failed with status ${res.status}`)
          }
          if (res.ok) {
            const data = await res.json()
            if (!data.success) {
              throw new Error(data.error ?? 'Item creation failed')
            }
            parent.send({
              type: 'upload.createItem.success',
              mediaFileId: mediaFile.id,
            })
          }
        } catch (err) {
          parent.send({
            type: 'upload.createItem.error',
            mediaFileId: mediaFile.id,
            error: err instanceof Error ? err.message : 'Unknown error',
          })
          throw err
        }
      }
    ),
  },
  actions: {
    updateConfig: enqueueActions(({ enqueue, context, event }) => {
      assertEvent(event, 'upload.config')
      let parsedConfig = config.parse({
        ...event.config,
        user: event.config.user,
      })
      enqueue.assign({
        config: {
          ...context.config,
          ...parsedConfig,
        },
      })
    }),
    addToPendingQueue: enqueueActions(({ enqueue, context, event }) => {
      assertEvent(event, 'upload.queues.pending.add')
      let mediaFile = mediafile.parse(event.mediaFile)
      enqueue.assign({
        queues: {
          ...context.queues,
          pending: context.queues.pending.set(mediaFile.id, mediaFile),
        },
      })
    }),
    addToSkippedQueue: enqueueActions(({ enqueue, context, event }) => {
      assertEvent(event, 'upload.add')
      let mediaFile = mediafile.parse(event.mediaFile)
      enqueue.assign({
        queues: {
          ...context.queues,
          skipped: context.queues.skipped.add(mediaFile?.id),
        },
      })
    }),
    spawnAndAssign: enqueueActions(({ context, event, enqueue, self }) => {
      assertEvent(event, 'upload.spawn')
      let mediaFile = mediafile.safeParse(event.mediaFile)
      if (mediaFile.success) {
        enqueue.assign(({ spawn }) => {
          let actor = spawn('fileMachine', {
            id: mediaFile.data.id,
            systemId: mediaFile.data.id,
            input: {
              user: context.config.user,
              manager: self,
              mediaFile: mediaFile.data,
              skipQuotaCheck: event.skipQuotaCheck,
            },
          })
          //@ts-ignore - TypeScript is having trouble inferring the type of the actor here, so we use a type assertion to bypass it. We know that the actor will be of the correct type based on how we spawn it.
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
    spawnQuotaActor: enqueueActions(({ context, event, enqueue, self }) => {
      enqueue.assign(({ spawn }) => {
        let actor = spawn('quotaMachine', {
          systemId: 'quota',
        })
        return { quotaActor: actor }
      })
    }),
    addFile: enqueueActions(({ context, event, enqueue }) => {
      assertEvent(event, 'upload.add')
      let mediaFile = mediafile.parse({
        ...event.mediaFile,
        ownerId: context.config?.user?.id,
      })
      let mediaFiles = context.mediaFiles.set(mediaFile.id, mediaFile)
      enqueue.assign({ mediaFiles })
      enqueue.raise({
        type: 'upload.spawn',
        mediaFile: event.mediaFile,
        skipQuotaCheck: event.skipQuotaCheck,
      })
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
    addToActiveQueue: enqueueActions(({ context, event, enqueue }) => {
      assertEvent(event, 'upload.start')
      let mediaFile = mediafile.parse(event.mediaFile)
      enqueue.assign({
        queues: {
          ...context.queues,
          active: context.queues.active.add(mediaFile.id),
        },
      })
    }),
    uploadPendingFiles: enqueueActions(({ context, enqueue, check }) => {
      let pendingFiles = Array.from(context.mediaFiles.values()).filter(
        (file) => file.status === 'pending'
      )
      if (pendingFiles.length > 0) {
        // The guard ensures config is valid, so we can parse without safeParse here.
        const parsedConfig = config.parse(context.config)
        let slotLeft =
          parsedConfig.maxConcurrentUploads! - context.queues.active.size
        const filesToStart = pendingFiles.slice(0, slotLeft)
        for (const mediaFile of filesToStart) {
          enqueue.raise({
            type: 'upload.start',
            mediaFile,
          })
        }
      }
    }),
    removeFromActiveQueue: assign(({ context, event }) => {
      assertEvent(event, ['upload.aborted', 'upload.done'])
      const mediaFile = mediafile.parse(event.mediaFile)
      const newActiveQueue = new Set(context.queues.active)
      newActiveQueue.delete(mediaFile.id)
      return {
        queues: {
          ...context.queues,
          active: newActiveQueue,
        },
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
    sendStartUpload: sendTo(
      ({ event }) => {
        assertEvent(event, 'upload.start')
        let mediaFile = mediafile.parse(event.mediaFile)
        return mediaFile.id
      },
      { type: 'start' }
    ),
    sendAbortUpload: enqueueActions(({ event, enqueue }) => {
      assertEvent(event, 'upload.abort')
      enqueue.sendTo(event.mediaFileId, {
        type: 'abort',
      })
    }),
    sendPauseUpload: enqueueActions(({ event, enqueue }) => {
      assertEvent(event, 'upload.pause')
      enqueue.sendTo(event.mediaFileId, { type: 'pause' })
    }),
    sendResumeUpload: enqueueActions(({ event, enqueue }) => {
      assertEvent(event, 'upload.resume')
      enqueue.sendTo(event.mediaFileId, { type: 'resume' })
    }),
    markAsDone: assign(({ context, event }) => {
      assertEvent(event, 'upload.done')
      let mediaFile = mediafile.parse(event.mediaFile)
      let mediaFiles = context.mediaFiles.set(mediaFile.id, mediaFile)
      return {
        mediaFiles,
      }
    }),
    markAsPaused: assign(({ context, event }) => {
      assertEvent(event, 'upload.paused')
      let mediaFile = mediafile.parse(event.mediaFile)
      let mediaFiles = context.mediaFiles.set(mediaFile.id, mediaFile)
      return {
        mediaFiles,
      }
    }),
    markAsResumed: assign(({ context, event }) => {
      assertEvent(event, 'upload.resumed')
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
    sendEventToQueue: sendTo(
      'queue',
      ({ event }) => event // Cast to any because the event type might be broad
    ),
    toggleVisibility: assign(({ context }) => {
      return {
        ...context,
        isVisible: !context.isVisible,
      }
    }),
    triggerItemCreation: enqueueActions(({ context, event, enqueue, self }) => {
      assertEvent(event, 'upload.done')
      enqueue.spawnChild('createDbItem', {
        id: `create-item-${event.mediaFile.id}`,
        input: {
          mediaFile: event.mediaFile,
          user: context.config.user,
          parent: self,
        },
      })
    }),
    markItemCreationError: assign(({ context, event }) => {
      assertEvent(event, 'upload.createItem.error')
      const mediaFile = context.mediaFiles.get(event.mediaFileId)
      if (!mediaFile) return {}
      return {
        mediaFiles: new Map(context.mediaFiles).set(event.mediaFileId, {
          ...mediaFile,
          error: event.error,
        }),
      }
    }),
    markAsItemCreated: assign(({ context, event }) => {
      assertEvent(event, 'upload.createItem.success')
      const mediaFile = context.mediaFiles.get(event.mediaFileId)
      if (!mediaFile) return {}
      return {
        mediaFiles: new Map(context.mediaFiles).set(event.mediaFileId, {
          ...mediaFile,
          status: 'itemCreated' as const,
        }),
      }
    }),
    dismissFile: assign(({ context, event }) => {
      assertEvent(event, 'upload.dismiss')
      const dismissed = new Set(context.dismissed)
      dismissed.add(event.mediaFileId)
      return { dismissed }
    }),
    setThumbnail: assign(({ context, event }) => {
      assertEvent(event, 'upload.thumbnail')
      const mediaFile = context.mediaFiles.get(event.mediaFileId)
      if (!mediaFile) return {}
      return {
        mediaFiles: new Map(context.mediaFiles).set(event.mediaFileId, {
          ...mediaFile,
          thumbnail: event.thumbnail,
        }),
      }
    }),
  },
  guards: {
    concurrentLessThenMax: ({ context }) => {
      const parsedConfig = config.safeParse(context.config)
      if (!parsedConfig.success) {
        return false
      }
      return (
        context.queues.active.size < parsedConfig.data.maxConcurrentUploads!
      )
    },
    hasPendingUploads: ({ context }) =>
      Array.from(context.mediaFiles.values()).some(
        (mf) => mf.status === 'pending'
      ),
    inActiveQueue: ({ context, event }) => {
      assertEvent(event, ['upload.start', 'upload.add'])
      let mediaFile = mediafile.parse(event.mediaFile)
      return context.queues.active.has(mediaFile.id)
    },
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QFcAOAbA9gQwgYjS1wDoBjTAOwDMBLKAbQAYBdRUVTWGgFxsrZAAPRAGYAjADZiExgA4A7CMaKJAFlkAmeQBoQAT0RiNAX2O7COCGUrcATpnTowt4jQhO8qe1FtxYZAAtsChgmViQQDi5efgjhBCMpJVk1AFZJEQ0xSTFdAwQszWIFCQ1GDTUU+VNzDEtrCjsHJxc3DwsSbAAjTFtuMIEonj4KAXijeWL5WUZU1VVGGSyxVLzEMoViERTCxnnZbNUakA6rckb7R2dXdzACOpJUbGRYMAGIoZjRuMMK6VV5KoVrIAJxzVLpVb6QwgkFiYog0p7VQiQEiCQSY6nBpNK6tW73IhWXywZAAWzeLEGnGGsVA4yyxCymSUkgkslSs1kawSoKkCwkYhBciUiw0IixDzONkuLRu7SlxBJ5Mg73YNK+Y1+smKqlSiL17M0yh5YhmjGIcMF2whYhE9tSkqJONl1zad2xTxeqqpHw1Iy1CXtxSU8kBElSYfFHNN8lmxFUFSMqhBKLBCid9XOuLl7sJ9V8ZMwADdKeF1dEAz8EkLiGJVEsRHCAeJVKaZCDLejlBUIxoNLDMyRs678QrnQBHZBgaf+VBgCgQGghYi4CBqyL+ulCRApYiMOGpAeLVOycQ6aEJdKqBMN2bCyMc1KYswnRUj5pugnYtcbz5V+lEDDfdGFAsDwNA3JL3rM1LQhYU9kyYUsiHaULk-McPUVX8xHLTdK23eJhX3DQ5gWCphWmBtTRZBMI00WQDlkFMX1qZ0PzxeUsOdWAngAdwoP8t2+QCEg0HUUgkOMJCtI9mIvfIjC0S15EjeQIybdT5DEVCXQwrj8xIWBuGwPohIIkSdxrC0jwbIwzwqSMAVNMR40YyQU1hZiPN0jjc2-bCej6H08P-QjDDcp8hSY8phTbS8QSUYhI0RER9QkEQGyOV9sT8r9x3qYzTO4ELqQswM7Rvft1D1RMpPRBTdzS-dQScxhJD5Vi33YmV9LzbEIEoMsytpSzxki20QRi494vyDKRDrM9Uk0TS4xSXzes4-rFSXWAyRoWBYHM0aKsyODUrBfUtFmCQeVSVFpES58FGFe0gQ29CtoC9jfGwEqAEkSrJYhSVIUg-GOzVq1BJkQVIqatM0LJbsveYNCZRg0qTeRUxRDEPpzfLuKzX6AaB4hnHsWxIYAqzXPhCF7wyoFkhBRqEEyqRtMyxQEO09QCdHAzsW4AJyS6ChsBodAafCsSb3tO1sjtFIDjtHlSPhftOdit7ylkQW+u+rMsFeWWxtECFiiyZC+VZdn+xWBMxDRNQWwHEwcvfTb-IKkhKd6c3AzS1JraFfXUvah3MgtcNOXalMSl04saDAPjiACNwIAXQyrBTtPiG4TAoCgJwg+rAdJhxtQ40yGQD1m9YIXRgd0lRFmwXxr3nXz9OU64Lo-bz1P06Lkuy99CsTortniGrgFMYqUDUw1zkW6W8VlojPZTFfChMGz+AIlOEaodEgBaIUeXUhMEKPLQFHEuFDbxU-afiAcQIg7-63bBaOSkooMoAIjx2hfr7MAb85az3UmaLSQJAStQ1uJBa6JSiSFIjIPU4Drig3BodKBFsEDpHhK5JszEZCghSHMDWQoW5b1UqRe6ChHTdyzD7a4AdbCEMDCQusmMpp3ioRGRuBRK7JQUGrBsUlN7JxHjwmeGsgQ3itDMXsewZjVDYSQXuGcs4LgUaJMMq87RMnUI7FicwtFsXqLo-uNBB6QL9OVasKYq6MwhOiTIWgV6Xk1qHRBFjERWN3sYIAA */
  id: 'upload',
  type: 'parallel',
  context: {
    ...initialData,
  },
  on: {
    'upload.config': {
      actions: 'updateConfig',
    },
  },
  states: {
    controller: {
      initial: 'idle',
      states: {
        idle: {
          entry: 'spawnQuotaActor',
          on: {
            'progress.change': {
              actions: 'updateProgress',
            },
            'upload.abort': {
              actions: 'sendAbortUpload',
            },
            'upload.pause': {
              actions: 'sendPauseUpload',
            },
            'upload.resume': {
              actions: 'sendResumeUpload',
            },
            'upload.resumed': {
              actions: 'markAsResumed',
            },
            'upload.paused': {
              actions: 'markAsPaused',
            },
            'upload.remove': {
              actions: 'removeFromUploads',
            },
            'upload.queues.pending.add': {
              actions: 'addToPendingQueue',
            },
            'upload.add': [
              {
                guard: 'inActiveQueue',
                actions: 'addToSkippedQueue',
              },
              { actions: 'addFile' },
            ],
            'upload.spawn': {
              actions: 'spawnAndAssign',
            },
            'upload.start': {
              guard: and(['concurrentLessThenMax', not('inActiveQueue')]),
              actions: ['addToActiveQueue', 'sendStartUpload'],
            },
            'upload.aborted': {
              actions: [
                'removeFromActiveQueue',
                'markAsAborted',
                'removeFromUploads',
                'uploadPendingFiles',
              ],
            },
            'upload.started': {
              actions: 'markAsStarted',
            },
            'upload.done': {
              actions: [
                'markAsDone',
                'removeFromActiveQueue',
                'removeFromUploads',
                'uploadPendingFiles',
                'triggerItemCreation',
              ],
            },
            'upload.dismiss': {
              actions: 'dismissFile',
            },
            'upload.createItem.success': {
              actions: 'markAsItemCreated',
            },
            'upload.createItem.error': {
              actions: 'markItemCreationError',
            },
            'upload.thumbnail': {
              actions: 'setThumbnail',
            },
            'upload.close': {
              target: 'success',
            },
            'upload.error': {
              target: 'error',
            },
          },
        },
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
    },
    view: {
      initial: 'hidden',
      states: {
        hidden: {
          exit: 'toggleVisibility',
          on: {
            'upload.view.toggle': 'visible',
          },
        },
        visible: {
          exit: 'toggleVisibility',
          on: { 'upload.view.toggle': 'hidden' },
        },
      },
    },
  },
})

export { uploadMachine }
