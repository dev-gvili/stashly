// queue.machine.ts
import { assign, setup, assertEvent, sendTo, type AnyActorRef } from 'xstate'
import type { Config as UploadManagerConfig, MediaFile } from '@/types/machine.types'

// Define a leaner type for what the queue machine needs to know about a file's status
interface QueueItem {
  id: string
  status: 'pending' | 'uploading' | 'completed' | 'skipped' | 'aborted'
  addedAt: Date
  updatedAt?: Date
}

export interface QueueContext {
  maxConcurrentUploads: number
  items: Map<string, QueueItem>
  active: Set<string>
  skipped: Set<string>
  completed: Set<string>
  pending: Set<string>
  canceled: Set<string>
}

type QueueEvents =
  | { type: 'upload.queued'; item: QueueItem }
  | { type: 'upload.started'; itemId: string }
  | { type: 'upload.completed'; itemId: string }
  | { type: 'upload.canceled'; itemId: string }
  | { type: 'upload.removed'; itemId: string }
  | { type: 'queue.settings.updated'; maxConcurrentUploads: number }

export const queueMachine = setup({
  types: {
    context: {} as QueueContext,
    events: {} as QueueEvents,
    input: {} as { config: UploadManagerConfig; parent: AnyActorRef },
  },
  actions: {
    addFileToPending: assign(({ context, event }) => {
      assertEvent(event, 'upload.queued')
      if (context.items.has(event.item.id)) {
        // Already exists, ignore
        return context
      }
      const { id } = event.item
      // Add to pending queue
      context.pending.add(id)
      // Add to master map
      context.items.set(id, event.item)
      return context
    }),
    addFileToActive: assign(({ context, event }) => {
      assertEvent(event, 'upload.started')
      const { itemId } = event
      // Remove from pending, add to active
      context.pending.delete(itemId)
      context.active.add(itemId)
      // Update status in master map
      const item = context.items.get(itemId)
      if (item) {
        item.status = 'uploading'
        context.items.set(item.id, item)
      }
      return context
    }),
    markFileAsDone: assign(({ context, event }) => {
      assertEvent(event, 'upload.completed')
      const { itemId } = event
      // Remove from active, add to completed
      context.active.delete(itemId)
      context.completed.add(itemId)
      // Update status in master map
      const item = context.items.get(itemId)
      if (item) {
        item.status = 'completed'
        context.items.set(item.id, item)
      }
      return context
    }),
    markFileAsAborted: assign(({ context, event }) => {
      assertEvent(event, 'upload.canceled')
      const { itemId } = event
      // Remove from active, add to skipped (or aborted)
      context.active.delete(itemId)
      context.skipped.add(itemId)
      // Update status in master map
      const item = context.items.get(itemId)
      if (item) {
        item.status = 'aborted'
        context.items.set(item.id, item)
      }
      return context
    }),
    // Remove file from any queue and the master map.
    removeFileFromQueue: assign(({ context, event }) => {
      assertEvent(event, 'upload.removed')
      const { itemId } = event
      context.pending.delete(itemId)
      context.active.delete(itemId)
      context.skipped.delete(itemId)
      context.completed.delete(itemId)
      context.items.delete(itemId)
      return context
    }),
    // Sends 'upload.spawn' to parent to initiate the file upload actor.
    spawnFileActor: sendTo(
      ({ system }) => system.get('upload'),
      ({ event }) => {
        assertEvent(event, 'upload.queued')
        return {
          type: 'upload.spawn',
          mediaFile: event.item,
        }
      }
    ),
    // Updates the configuration, e.g., max concurrent uploads.
    updateConfig: assign(({ event }) => {
      assertEvent(event, 'queue.settings.updated')
      return {
        maxConcurrentUploads: event.maxConcurrentUploads,
      }
    }),
    // Checks and starts new uploads if there are pending files and available slots.
    checkAndStartUploads: sendTo('parent', ({ context }) => {
      if (
        context.active.size < context.maxConcurrentUploads &&
        context.pending.size > 0
      ) {
        const nextFileId = context.pending.values().next().value
        if (nextFileId) {
          // The parent will receive this event and start the file machine
          return {
            type: 'upload.started',
            itemId: nextFileId,
          }
        }
      }
      return { type: 'noop' } // No operation if no files can be started
    }),
  },
  guards: {
    // Checks if there are pending files and available slots.
    canStartMoreUploads: ({ context }) =>
      context.active.size < context.maxConcurrentUploads &&
      context.pending.size > 0,
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QEcCuZ0DoCGBjALgJYBuYAxGhmJrGPkQHZSyaoAOE2+kA2gAwBdRKDYB7WISKiGwkAA9EAFgBMmPuo2aNARkUAaEAE9EAdmUBOTADZlAVj4BmEw6sAOK-dsBfLwcpY8IlIydgAbUWwITH9eQVkxCSkZJHlEWwdMZQdFEysHfPNbbVtlfSNEKz4TTHTtPm1tK0VbV1dzBx8-dACCEnIwiKjYfGwAJ24IfiEUhMlCaVkFBBNFTGzzZTdixSttZ2UDYwQi1T5FPnM9ptbHbU6QGJxe4IHIzFxRAFs2ULpY6ZE4jmCxSS3SmWyuXyDkKxVKh0QDjamHMOza2g2lUU2lc90egT6IR+g3e2AYuDAv0mcRmQKSizSGSyOTyBSKJTKR021VcJXcNkcylcfCseO61AJL2Jb1GYE+olI1IBIFm9NBaVsmT4RRM5naDj4rgszQRCD2qhcQqFKyNrWaYqoTyC5Cm8Tp82SoDBTMhrJh7Ph5QQrm0aysVhM6hhvJM6W89wYoggcFkMTdiQ9DIQAFpNXr8wWC+5TdmrGotBX1CYHT1nengZ7UghzK41LYmnwssoTA0NuZTbyyz3zCKDZdsXsfD4gA */
  id: 'queue',
  context: ({ input }) => ({
    items: new Map(),
    config: input.config,
    maxConcurrentUploads: input.config.maxConcurrentUploads || 3,
    active: new Set(),
    skipped: new Set(),
    completed: new Set(),
    pending: new Set(),
    canceled: new Set(),
  }),
  initial: 'active',
  states: {
    active: {
      always: {
        guard: 'canStartMoreUploads',
        actions: 'checkAndStartUploads',
      },
      on: {
        'queue.settings.updated': {
          actions: ['updateConfig', 'checkAndStartUploads'],
        },
        'upload.queued': {
          actions: ['addFileToPending', 'checkAndStartUploads'],
        },
        'upload.started': {
          // The file machine sends this back to the queue after it's been spawned
          actions: 'addFileToActive',
        },
        'upload.completed': {
          actions: ['markFileAsDone', 'checkAndStartUploads'],
        },
        'upload.canceled': {
          actions: ['markFileAsAborted', 'checkAndStartUploads'],
        },
        'upload.removed': {
          actions: ['removeFileFromQueue'],
        },
      },
    },
  },
})
