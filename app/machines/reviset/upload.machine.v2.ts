// upload.machine.ts
import {
	assign,
	setup,
	assertEvent,
	enqueueActions,
	type AnyActorRef,
} from 'xstate'
import { fileMachine } from './file.machine'
import { queueMachine } from './queue.machine'
import type { UploadManagerData, UploadManagerEvents, User } from '../machine.types'

// The parent machine's context, acting as the single source of truth.
type UploadManagerContext = Omit<UploadManagerData, 'queues'> & {
	queueRef: AnyActorRef
}

let initialData: UploadManagerContext = {
	config: {
		bucketName: '',
		ownerId: '',
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
		addFileToContextAndQueue: enqueueActions(
			({ context, enqueue, event }) => {
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
			}
		),

		// Spawns a new file actor and assigns it to the context.
		spawnAndAssignFileActor: assign(({ spawn, context, event }) => {
			assertEvent(event, 'upload.spawn')

			// Get the full MediaFile object from the central map using the ID.
			const mediaFile = context.mediaFiles.get(event.mediaFileId)
			if (!mediaFile) {
				console.error(
					`Media file with ID ${event.mediaFileId} not found.`
				)
				return {}
			}

			// Spawn a new file actor with the necessary input.
			const fileActor = spawn('fileMachine', {
				id: `file-${mediaFile.id}`,
				input: { mediaFile, bucket: context.config.bucketName },
			})

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
					const newMediaFiles = new Map(context.mediaFiles).set(
						mediaFile.id,
						{
							...mediaFile,
							status: 'uploading',
						}
					)
					enqueue.assign({ mediaFiles: newMediaFiles })
				}
				// Forward the event to the queue machine
				enqueue.sendTo(context.queueRef, event)
			}
		),

		// Marks a file as done in the context and removes the actor.
		markFileAsDoneInContext: enqueueActions(
			({ context, enqueue, event }) => {
				assertEvent(event, 'upload.done')
				// Update the status in the central mediaFiles map
				const mediaFile = context.mediaFiles.get(event.mediaFileId)
				if (mediaFile) {
					const newMediaFiles = new Map(context.mediaFiles).set(
						mediaFile.id,
						{
							...mediaFile,
							status: 'done',
							etag: event.etag,
							versionId: event.versionId,
						}
					)
					enqueue.assign({ mediaFiles: newMediaFiles })
				}
				// Forward the event to the queue machine
				enqueue.sendTo(context.queueRef, event)
			}
		),

		// ... (other actions for aborting, etc., would follow the same pattern) ...
	},
}).createMachine({
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
