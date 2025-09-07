// queue.machine.ts
import {
	assign,
	setup,
	assertEvent,
	enqueueActions,
	sendTo,
	log,
	type AnyActorRef,
} from 'xstate'
import type {
	Config as UploadManagerConfig,
	MediaFileStatus as ItemStatus,
	UploadProgress,
	MediaFile, // We still need the type for the event
} from '../machine.types'

// Define a leaner type for what the queue machine needs to know about a file's status
interface QueueItem {
	id: string
	status: ItemStatus
	progress?: UploadProgress
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
	| { type: 'queue.add'; mediaFileId: string } // Only pass the ID
	| { type: 'upload.start'; mediaFileId: string }
	| {
			type: 'upload.done'
			mediaFileId: string
			etag: string
			versionId: string
	  }
	| { type: 'upload.progress'; mediaFileId: string; progress: UploadProgress }
	| { type: 'upload.aborted'; mediaFileId: string }
	| { type: 'config.update'; config: UploadManagerConfig }

export const queueMachine = setup({
	types: {
		input: {} as { parent: AnyActorRef; config: UploadManagerConfig },
		context: {} as QueueContext,
		events: {} as QueueEvents,
	},
	actions: {
		// Adds a file ID to the pending queue and updates the items map.
		addFileToPending: assign(({ context, event }) => {
			assertEvent(event, 'queue.add')
			const newItems = new Map(context.items).set(event.mediaFileId, {
				id: event.mediaFileId,
				status: 'pending',
			})
			const newPending = new Set(context.queues.pending).add(
				event.mediaFileId
			)
			return {
				items: newItems,
				queues: {
					...context.queues,
					pending: newPending,
				},
			}
		}),

		// Moves a file ID from the pending queue to the active queue.
		addFileToActive: assign(({ context, event }) => {
			assertEvent(event, 'upload.start')
			const newPending = new Set(context.queues.pending)
			newPending.delete(event.mediaFileId)
			const newActive = new Set(context.queues.active).add(
				event.mediaFileId
			)
			return {
				queues: {
					...context.queues,
					pending: newPending,
					active: newActive,
				},
			}
		}),

		// Marks a file ID as done and moves it to the completed queue.
		markFileAsDone: assign(({ context, event }) => {
			assertEvent(event, 'upload.done')
			const newItems = new Map(context.items).set(event.mediaFileId, {
				id: event.mediaFileId,
				status: 'done',
			})
			const newActive = new Set(context.queues.active)
			newActive.delete(event.mediaFileId)
			const newCompleted = new Set(context.queues.completed).add(
				event.mediaFileId
			)
			return {
				items: newItems,
				queues: {
					...context.queues,
					active: newActive,
					completed: newCompleted,
				},
			}
		}),

		// Marks a file ID as aborted and removes it from the active queue.
		markFileAsAborted: assign(({ context, event }) => {
			assertEvent(event, 'upload.aborted')
			const newItems = new Map(context.items).set(event.mediaFileId, {
				id: event.mediaFileId,
				status: 'aborted',
			})
			const newActive = new Set(context.queues.active)
			newActive.delete(event.mediaFileId)
			const newSkipped = new Set(context.queues.skipped).add(
				event.mediaFileId
			)
			return {
				items: newItems,
				queues: {
					...context.queues,
					active: newActive,
					skipped: newSkipped,
				},
			}
		}),

		// Updates the machine's configuration.
		updateConfig: assign(({ context, event }) => {
			assertEvent(event, 'config.update')
			return {
				config: event.config,
			}
		}),

		// Checks if a new upload can be started and, if so, sends a spawn event to the parent.
		checkAndStartUploads: enqueueActions(({ context, enqueue }) => {
			// Check if there are pending files and an available slot.
			if (
				context.queues.pending.size > 0 &&
				context.queues.active.size < context.config.maxConcurrentUploads
			) {
				const nextFileId = context.queues.pending.values().next().value
				if (nextFileId) {
					// Send the 'upload.spawn' event to the parent actor with only the ID.
					enqueue.sendTo(context.parent, {
						type: 'upload.spawn',
						mediaFileId: nextFileId,
					})
				}
			}
		}),

		// Logs the current state of the queues.
		logQueueState: log(({ context }) => {
			const pendingCount = context.queues.pending.size
			const activeCount = context.queues.active.size
			const completedCount = context.queues.completed.size
			return `Queue State: Active: ${activeCount}, Pending: ${pendingCount}, Completed: ${completedCount}`
		}),
	},
	guards: {
		canStartMoreUploads: ({ context }) => {
			return (
				context.queues.active.size <
					context.config.maxConcurrentUploads &&
				context.queues.pending.size > 0
			)
		},
		isFilePending: ({ context, event }) => {
			assertEvent(event, 'upload.start')
			return context.queues.pending.has(event.mediaFileId)
		},
	},
}).createMachine({
	id: 'queue',
	initial: 'active',
	context: ({ input }) => ({
		config: input.config,
		parent: input.parent,
		items: new Map(),
		queues: {
			active: new Set(),
			skipped: new Set(),
			completed: new Set(),
			pending: new Set(),
		},
	}),
	states: {
		active: {
			entry: 'logQueueState',
			on: {
				'config.update': {
					actions: ['updateConfig', 'checkAndStartUploads'],
				},
				'queue.add': {
					actions: ['addFileToPending', 'checkAndStartUploads'],
				},
				'upload.start': {
					guard: 'isFilePending',
					actions: 'addFileToActive',
				},
				'upload.done': {
					actions: ['markFileAsDone', 'checkAndStartUploads'],
				},
				'upload.aborted': {
					actions: ['markFileAsAborted', 'checkAndStartUploads'],
				},
				'upload.progress': {
					// actions: 'updateProgress' // This could be an action if needed.
				},
			},
		},
	},
})
