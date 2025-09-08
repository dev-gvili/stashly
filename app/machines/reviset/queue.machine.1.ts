// queue.machine.ts
import { assign, setup, assertEvent, sendTo, type AnyActorRef } from 'xstate'
import type { Config as UploadManagerConfig, MediaFile } from '../machine.types'

// Define a leaner type for what the queue machine needs to know about a file's status
interface QueueItem {
	id: string
	status: 'pending' | 'uploading' | 'completed' | 'skipped' | 'aborted'
}

export interface QueueContext {
	parent: AnyActorRef
	config: UploadManagerConfig
	items: Map<string, QueueItem>
	queues: {
		active: Set<string>
		skipped: Set<string>
		completed: Set<string>
		pending: Set<string>
	}
}

type QueueEvents =
	| { type: 'queue.add'; mediaFile: MediaFile }
	| { type: 'upload.start'; mediaFileId: string }
	| { type: 'upload.done'; mediaFileId: string }
	| { type: 'upload.aborted'; mediaFileId: string }
	| { type: 'upload.remove'; mediaFileId: string }
	| { type: 'config.update'; config: UploadManagerConfig }

export const queueMachine = setup({
	types: {
		context: {} as QueueContext,
		events: {} as QueueEvents,
		input: {} as { config: UploadManagerConfig; parent: AnyActorRef },
	},
	actions: {
		addFileToPending: assign(({ context, event }) => {
			assertEvent(event, 'queue.add')
			const { id } = event.mediaFile
			if (!context.items.has(id)) {
				// Add to master map
				context.items.set(id, { id, status: 'pending' })
				// Add to pending queue
				context.queues.pending.add(id)
			}
			return context
		}),
		addFileToActive: assign(({ context, event }) => {
			assertEvent(event, 'upload.start')
			const { mediaFileId } = event
			// Remove from pending, add to active
			context.queues.pending.delete(mediaFileId)
			context.queues.active.add(mediaFileId)
			// Update status in master map
			const item = context.items.get(mediaFileId)
			if (item) {
				item.status = 'uploading'
				context.items.set(item.id, item)
			}
			return context
		}),
		markFileAsDone: assign(({ context, event }) => {
			assertEvent(event, 'upload.done')
			const { mediaFileId } = event
			// Remove from active, add to completed
			context.queues.active.delete(mediaFileId)
			context.queues.completed.add(mediaFileId)
			// Update status in master map
			const item = context.items.get(mediaFileId)
			if (item) {
				item.status = 'completed'
				context.items.set(item.id, item)
			}
			return context
		}),
		markFileAsAborted: assign(({ context, event }) => {
			assertEvent(event, 'upload.aborted')
			const { mediaFileId } = event
			// Remove from active, add to skipped (or aborted)
			context.queues.active.delete(mediaFileId)
			context.queues.skipped.add(mediaFileId)
			// Update status in master map
			const item = context.items.get(mediaFileId)
			if (item) {
				item.status = 'aborted'
				context.items.set(item.id, item)
			}
			return context
		}),
		// Remove file from any queue and the master map.
		removeFileFromQueue: assign(({ context, event }) => {
			assertEvent(event, 'upload.remove')
			const { mediaFileId } = event
			context.queues.pending.delete(mediaFileId)
			context.queues.active.delete(mediaFileId)
			context.queues.skipped.delete(mediaFileId)
			context.queues.completed.delete(mediaFileId)
			context.items.delete(mediaFileId)
			return context
		}),
		// Sends 'upload.spawn' to parent to initiate the file upload actor.
		spawnFileActor: sendTo(
			({ system }) => system.get('upload'),
			({ event }) => {
				assertEvent(event, 'queue.add')
				return {
					type: 'upload.spawn',
					mediaFile: event.mediaFile,
				}
			}
		),
		// Updates the configuration, e.g., max concurrent uploads.
		updateConfig: assign(({ event }) => {
			assertEvent(event, 'config.update')
			return {
				config: event.config,
			}
		}),
		// Checks and starts new uploads if there are pending files and available slots.
		checkAndStartUploads: sendTo('parent', ({ context }) => {
			if (
				context.queues.active.size <
					context.config.maxConcurrentUploads &&
				context.queues.pending.size > 0
			) {
				const nextFileId = context.queues.pending.values().next().value
				if (nextFileId) {
					// The parent will receive this event and start the file machine
					return {
						type: 'upload.start',
						mediaFileId: nextFileId,
					}
				}
			}
			return { type: 'noop' } // No operation if no files can be started
		}),
	},
	guards: {
		// Checks if there are pending files and available slots.
		canStartMoreUploads: ({ context }) =>
			context.queues.active.size < context.config.maxConcurrentUploads &&
			context.queues.pending.size > 0,
	},
}).createMachine({
	id: 'queue',
	context: ({ input }) => ({
		parent: input.parent,
		config: input.config,
		items: new Map(),
		queues: {
			active: new Set(),
			skipped: new Set(),
			completed: new Set(),
			pending: new Set(),
		},
	}),
	initial: 'active',
	states: {
		active: {
			always: {
				guard: 'canStartMoreUploads',
				actions: 'checkAndStartUploads',
			},
			on: {
				'config.update': {
					actions: ['updateConfig', 'checkAndStartUploads'],
				},
				'queue.add': {
					actions: ['addFileToPending', 'checkAndStartUploads'],
				},
				'upload.start': {
					// The file machine sends this back to the queue after it's been spawned
					actions: 'addFileToActive',
				},
				'upload.done': {
					actions: ['markFileAsDone', 'checkAndStartUploads'],
				},
				'upload.aborted': {
					actions: ['markFileAsAborted', 'checkAndStartUploads'],
				},
				'upload.remove': {
					actions: ['removeFileFromQueue'],
				},
			},
		},
	},
})
