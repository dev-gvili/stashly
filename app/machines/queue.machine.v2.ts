import { setup } from "xstate"

/**
 * The 'queueMachine' manages the queue and concurrency.
 * It's a child actor of the `uploadMachine`.
 */
export const queueMachine = setup({
	types: {
		input: {} as { config: UploadManagerConfig; parent: AnyActorRef },
		context: {} as {
			config: UploadManagerConfig
			parent: AnyActorRef
			queues: { pending: Set<string>; active: Set<string> }
		},
		events: {} as UploadManagerEvents,
	},
	actions: {
		// An action to send a signal to the parent to start a file upload
		// This is the core of the queue logic: it tells the parent "I have a pending file, and you have a free slot, start the upload!"
		signalParentToStartUpload: sendTo(
			({ context }) => context.parent,
			({ context }) => {
				const nextFileId = Array.from(context.queues.pending)[0]
				return { type: 'upload.spawn', mediaFileId: nextFileId }
			}
		),
		addFileToPending: assign(({ context, event }) => {
			assertEvent(event, 'upload.add')
			context.queues.pending.add(event.mediaFile.id)
		}),
		addFileToActive: assign(({ context, event }) => {
			assertEvent(event, 'upload.start')
			context.queues.pending.delete(event.mediaFileId)
			context.queues.active.add(event.mediaFileId)
		}),
		markFileAsDone: assign(({ context, event }) => {
			assertEvent(event, 'upload.done')
			context.queues.active.delete(event.mediaFileId)
			context.queues.completed.add(event.mediaFileId)
		}),
	},
	guards: {
		canStartMoreUploads: ({ context }) =>
			context.queues.active.size < context.config.maxConcurrentUploads &&
			context.queues.pending.size > 0,
	},
}).createMachine({
	id: 'queue',
	initial: 'active',
	context: ({ input }) => ({
		config: input.config,
		parent: input.parent,
		queues: {
			active: new Set(),
			pending: new Set(),
			completed: new Set(),
			skipped: new Set(),
		},
	}),
	states: {
		active: {
			always: {
				guard: 'canStartMoreUploads',
				actions: ['signalParentToStartUpload'],
			},
			on: {
				'queue.add': {
					actions: ['addFileToPending'],
				},
				'upload.spawn': {
					actions: ['addFileToActive'],
				},
				'upload.done': {
					actions: ['markFileAsDone'],
				},
			},
		},
	},
})
