// queue.machine.ts
import {
	assign,
	setup,
	assertEvent,
	enqueueActions,
	log,
	type AnyActorRef,
} from 'xstate'
import type {
	Config,
	MediaFile,
	MediaFileStatus as ItemStatus,
	Config as UploadManagerConfig,
	UploadProgress,
} from './machine.types'
import { mediafile, uploadProgress } from './schema.zod'
// Define a leaner type for what the queue machine needs to know about a file's status
interface QueueItem {
	id: string
	status: ItemStatus
	progress?: UploadProgress // Keep progress if queue needs to report it or use for decisions
}

export interface QueueContext {
	parent: AnyActorRef
	config: UploadManagerConfig
	items: Map<string, QueueItem> // Changed from mediaFiles
	queues: {
		active: Set<string>
		skipped: Set<string>
		completed: Set<string>
		pending: Set<string> // Now stores just IDs
	}
	stats: {
		active: number
		skipped: number
		completed: number
		pending: number
	}
}

// type ParentEvents = ExtractEvent<UploadManagerEvents, 'upload.config'>

type QueueEvents =
	| { type: 'queue.add'; mediaFile: MediaFile } // Still receives full MediaFile on initial add
	| { type: 'upload.start'; mediaFileId: string } // Changed: only needs ID
	| { type: 'upload.done'; mediaFileId: string } // Changed: only needs ID
	| { type: 'upload.aborted'; mediaFileId: string } // Changed: only needs ID
	| { type: 'progress.change'; mediaFileId: string; progress: number } // Already streamlined
	| { type: 'config.update'; config: UploadManagerConfig }
	| { type: 'upload.remove'; id: string }
	| { type: 'upload.abort'; mediaFileId: string }
	// Events sent to parent 'upload' machine (e.g., from checkAndStartUploads)
	| { type: 'upload.spawn'; mediaFileId: string } // Changed: only sends ID to parent
	| { type: 'upload.error'; mediaFileId: string; error: string }

const queueMachine = setup({
	types: {
		context: {} as QueueContext,
		events: {} as QueueEvents,
		input: {} as { config: Config; parent: AnyActorRef },
	},
	actions: {
		addFileToPending: assign(({ context, event }) => {
			assertEvent(event, 'queue.add')
			const mediaFile = mediafile.parse(event.mediaFile)
			const items = new Map(context.items).set(
				mediaFile.id,
				{
					id: mediaFile.id,
					status: 'pending',
					progress: mediaFile.progress,
				} // Initialize status and progress
			)
			const newPending = new Set(context.queues.pending).add(mediaFile.id) // Add ID to pending set
			return {
				items: items,
				queues: {
					...context.queues,
					pending: newPending,
				},
				stats: {
					...context.stats,
					pending: newPending.size,
				},
			}
		}),
		addFileToActive: assign(({ context, event }) => {
			assertEvent(event, 'upload.start')
			const mediaFileId = event.mediaFileId // Get ID directly
			const newActive = new Set(context.queues.active).add(mediaFileId)
			const newPending = new Set(context.queues.pending)
			newPending.delete(mediaFileId)

			// Update the status of the file in the `items` map to 'uploading'
			// Update status in items map
			const items = new Map(context.items)
			const currentItem = items.get(mediaFileId)
			if (currentItem) {
				items.set(mediaFileId, {
					...currentItem,
					status: 'uploading',
				})
			}

			return {
				items,
				queues: {
					...context.queues,
					active: newActive,
					pending: newPending,
				},
				stats: {
					...context.stats,
					pending: newPending.size,
					active: newActive.size,
				},
			}
		}),
		markFileAsUploading: assign(({ context, event }) => {
			assertEvent(event, 'upload.start')
			const mediaFileId = event.mediaFileId
			let currentItem = context.items.get(mediaFileId)
			const items = new Map(context.items)
			if (currentItem) {
				items.set(mediaFileId, {
					...currentItem,
					status: 'uploading',
				})
			}
			return { items }
		}),
		markFileAsDone: assign(({ context, event }) => {
			assertEvent(event, 'upload.done')
			const mediaFileId = event.mediaFileId

			const items = new Map(context.items)
			const currentItem = items.get(mediaFileId)
			if (currentItem) {
				items.set(mediaFileId, {
					...currentItem,
					status: 'done',
				})
			}

			const newActive = new Set(context.queues.active)
			newActive.delete(mediaFileId)
			const newCompleted = new Set(context.queues.completed).add(
				mediaFileId
			)

			return {
				items: items,
				queues: {
					...context.queues,
					active: newActive,
					completed: newCompleted,
				},
				stats: {
					...context.stats,
					active: newActive.size,
					completed: newCompleted.size,
				},
			}
		}),
		markFileAsAborted: assign(({ context, event }) => {
			assertEvent(event, 'upload.aborted')
			const mediaFileId = event.mediaFileId
			const items = new Map(context.items)
			const currentItem = items.get(mediaFileId)
			if (currentItem) {
				items.set(mediaFileId, {
					...currentItem,
					status: 'aborted',
				})
			}
			const newActive = new Set(context.queues.active)
			newActive.delete(mediaFileId)
			const newSkipped = new Set(context.queues.skipped).add(mediaFileId) // Moving to skipped if aborted
			return {
				items,
				queues: {
					...context.queues,
					active: newActive,
					skipped: newSkipped,
				},
				stats: {
					...context.stats,
					active: newActive.size,
					skipped: newSkipped.size,
				},
			}
		}),
		updateFileProgress: assign(({ context, event }) => {
			assertEvent(event, 'progress.change')
			const mediafileId = event.mediaFileId
			const progress = uploadProgress.parse(event.progress)

			const items = new Map(context.items)
			const fileStatusToUpdate = items.get(mediafileId)
			if (fileStatusToUpdate) {
				items.set(mediafileId, {
					...fileStatusToUpdate,
					progress,
				})
			}
			return { items: items }
		}),
		removeFile: assign(({ context, event }) => {
			assertEvent(event, 'upload.remove')
			const items = new Map(context.items)
			items.delete(event.id)

			const newPending = new Set(context.queues.pending)
			newPending.delete(event.id)
			const newActive = new Set(context.queues.active)
			newActive.delete(event.id)
			const newSkipped = new Set(context.queues.skipped)
			newSkipped.delete(event.id)
			const newCompleted = new Set(context.queues.completed)
			newCompleted.delete(event.id)

			return {
				items: items,
				queues: {
					active: newActive,
					skipped: newSkipped,
					completed: newCompleted,
					pending: newPending,
				},
				stats: {
					active: newActive.size,
					skipped: newSkipped.size,
					completed: newCompleted.size,
					pending: newPending.size,
				},
			}
		}),
		checkAndStartUploads: enqueueActions(({ context, enqueue, self }) => {
			// const parsedConfig = config.parse(context.config)
			// Now pendingFiles is a Set of IDs, so convert to array
			const pendingFileIds = Array.from(context.queues.pending)
			const slotsAvailable =
				context.config.maxConcurrentUploads - context.queues.active.size

			if (slotsAvailable > 0 && pendingFileIds.length > 0) {
				const filesToStartIds = pendingFileIds.slice(0, slotsAvailable)
				for (const mediaFileId of filesToStartIds) {
					// Send 'upload.spawn' with only the mediaFileId
					enqueue.sendTo(
						context.parent, // Assuming 'upload' is the ID of the parent machine
						{
							type: 'upload.spawn',
							mediaFileId: mediaFileId, // Pass only the ID
						}
					)
					// Also raise an internal event for the queue to mark it as starting
					enqueue.raise({
						type: 'upload.start',
						mediaFileId,
					}) // Only ID needed for internal queue update
				}
			}
		}),
		// Send abort to the specific file actor
		// This action now sends a request TO THE PARENT to abort a file
		requestAbortFromParent: enqueueActions(
			({ context, event, enqueue }) => {
				assertEvent(event, 'upload.abort')
				enqueue.sendTo(
					context.parent, // Send to the parent (uploadMachine)
					{
						type: 'queue.request.abort', // New event type for parent
						mediaFileId: event.mediaFileId,
					}
				)
			}
		),
		updateConfig: assign(({ context, event }) => {
			assertEvent(event, 'config.update')
			// const parsedConfig = config.parse(event.config)
			return {
				config: event.config,
			}
		}),
		logQueueState: log(({ context }) => ({
			active: context.queues.active.size,
			skipped: context.queues.skipped.size,
			pending: context.queues.pending.size,
			completed: context.queues.completed.size,
			items: context.items.size,
		})),
	},
	guards: {
		canStartMoreUploads: ({ context }) =>
			context.queues.active.size < context.config.maxConcurrentUploads &&
			context.queues.pending.size > 0,
		isFilePending: ({ context, event }) => {
			assertEvent(event, 'upload.start')
			return context.queues.pending.has(event.mediaFileId)
		},
	},
}).createMachine({
	id: 'queue',
	initial: 'active',
	context: ({ input }) => ({
		config: input.config, // Initial config passed from parent
		parent: input.parent,
		items: new Map(),
		queues: {
			active: new Set(),
			skipped: new Set(),
			completed: new Set(),
			pending: new Set(),
		},
		stats: {
			active: 0,
			completed: 0,
			pending: 0,
			skipped: 0,
		},
	}),

	states: {
		active: {
			on: {
				'config.update': {
					actions: ['updateConfig', 'checkAndStartUploads'],
				},
				'queue.add': {
					actions: [
						'addFileToPending',
						'checkAndStartUploads',
						'logQueueState',
					],
				},
				'upload.start': {
					guard: 'canStartMoreUploads',
					actions: [
						'addFileToActive',
						'markFileAsUploading',
						'logQueueState',
					],
				},
				'upload.done': {
					actions: [
						'markFileAsDone',
						'checkAndStartUploads',
						'logQueueState',
					],
				},
				'upload.aborted': {
					actions: ['markFileAsAborted', 'checkAndStartUploads'],
				},
				'progress.change': {
					actions: 'updateFileProgress',
				},
				'upload.remove': {
					actions: ['removeFile', 'logQueueState'],
				},
				'upload.abort': {
					actions: ['requestAbortFromParent', 'logQueueState'],
				},
			},
		},
	},
})

export { queueMachine }
