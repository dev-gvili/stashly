// upload.machine.ts
import {
	assign,
	setup,
	assertEvent,
	enqueueActions,
	sendTo,
	type AnyActorRef,
} from 'xstate'
import { fileMachine } from './file.machine'
import { queueMachine } from './queue.machine' // Import the new queue machine
import { quotaMachine } from './quota.machine' // Import the new queue machine
import type { UploadManagerData, UploadManagerEvents, User } from '@/types/machine.types'
import { config, mediafile, uploadProgress } from '@/schemas/machine.schemas'

type UploadManagerContext = Omit<UploadManagerData, 'queues'> & {
	queueRef?: AnyActorRef
	quotaService?: AnyActorRef
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
	fileActors: new Map(), // This will now store references to fileMachine actors
	// The 'queues' property will be managed by the queue actor
	// queues: {
	// 	active: new Set(),
	// 	skipped: new Set(),
	// 	completed: new Set(),
	// 	pending: new Map(),
	// },
}

const uploadMachine = setup({
	types: {
		context: {} as UploadManagerContext,
		events: {} as UploadManagerEvents,
	},
	actors: {
		fileMachine,
		queueMachine, // Register the queue machine as an actor
		quotaMachine,
	},
	actions: {
		updateConfig: enqueueActions(({ enqueue, context, event }) => {
			assertEvent(event, 'upload.config')

			let parsedConfig = config.safeParse(event.config)
			if (parsedConfig.success) {
				enqueue.assign({
					config: {
						...context.config,
						...parsedConfig.data,
					},
				})
				// Send updated config to the queue actor
				enqueue.sendTo('queueService', {
					type: 'config.update',
					config: parsedConfig.data,
				})
			} else {
				// Send updated config to the queue actor
				enqueue.sendTo('queueService', {
					type: 'config.update',
					config: context.config,
				})
			}
		}),
		addFileToQueue: enqueueActions(({ context, event, enqueue }) => {
			assertEvent(event, 'upload.add')
			let mediaFile = mediafile.parse({
				...event.mediaFile,
				ownerId: context.config.ownerId,
			})
			// Update local mediaFiles map for easy access
			enqueue.assign({
				mediaFiles: context.mediaFiles.set(mediaFile.id, mediaFile),
			})
			// Send the file to the queue actor
			enqueue.sendTo('queueService', {
				type: 'queue.add',
				mediaFile: mediaFile,
			})
		}),
		spawnAndAssignFileActor: enqueueActions(
			({ context, event, enqueue, self }) => {
				// Assert the event now expects mediaFileId, not full mediaFile
				assertEvent(event, 'upload.spawn')
				const mediaFileId = event.mediaFileId // Get ID

				// Retrieve the full MediaFile object from uploadMachine's own context
				const mediaFile = context.mediaFiles.get(mediaFileId)

				if (mediaFile) {
					// Check if the file exists in our global map
					enqueue.assign(({ spawn }) => {
						let actor = spawn('fileMachine', {
							id: mediaFile.id, // Use the ID from the full mediaFile
							input: {
								user: context.config.user,
								bucketName: context.config.bucketName,
								ownerId: context.config.ownerId,
								parentRef: self,
								mediaFile: mediaFile, // Pass the full mediaFile to the file actor
							},
						})
						// Store the actor reference
						let fileActors = context.fileActors.set(
							mediaFile.id,
							actor
						)
						return { fileActors }
					})
					// Send 'start' event to the newly spawned file actor
					enqueue.sendTo(mediaFile.id, { type: 'start' })
				} else {
					// Handle case where mediaFile is not found (e.g., error)
					enqueue.assign({
						error: `MediaFile with ID ${mediaFileId} not found for spawning.`,
					})
				}
			}
		),
		assignQuotaService: enqueueActions(
			({ context, event, enqueue, self }) => {
				// Check if the file exists in our global map
				enqueue.assign(({ spawn }) => {
					const quotaActor = spawn('quotaMachine', {
						systemId: 'quotaService',
					})
					return {
						quotaService: quotaActor,
					}
				})
			}
		),
		assignQueueService: enqueueActions(
			({ context, event, enqueue, self }) => {
				// Check if the file exists in our global map
				enqueue.assign(({ spawn }) => {
					const queueActor = spawn('queueMachine', {
						id: 'queueService',
						input: {
							config: context.config,
							parent: self, // If queue machine needs to send back to parent
						},
					})
					return {
						queueRef: queueActor,
					}
				})
			}
		),
		sendAbortToFileActor: enqueueActions(({ context, event, enqueue }) => {
			assertEvent(event, 'queue.request.abort') // Event type changed
			const mediaFileId = event.mediaFileId
			const fileActorRef = context.fileActors.get(mediaFileId) // Get actor ref from context

			if (fileActorRef) {
				enqueue.sendTo(event.mediaFileId, { type: 'abort' }) // Send directly to the file actor
			} else {
				console.warn(
					`UploadMachine: Attempted to abort file ${mediaFileId}, but file actor not found.`
				)
			}
		}),
		sendAbortToQueue: enqueueActions(({ context, event, enqueue }) => {
			assertEvent(event, 'upload.abort')
			// Forward the abort message to the queue actor
			enqueue.sendTo('queueService', {
				type: 'upload.abort', // Keep original event type for queueMachine
				mediaFileId: event.mediaFileId,
			})
		}),
		updateFileProgress: assign(({ context, event }) => {
			assertEvent(event, 'progress.change')
			const mediafileId = event.mediaFileId
			const progress = uploadProgress.parse(event.progress)
			const mediafileToUpdate = context.mediaFiles.get(mediafileId)
			if (mediafileToUpdate) {
				const updatedMediaFile = { ...mediafileToUpdate, progress }
				context.mediaFiles.set(mediafileId, updatedMediaFile)
			}
			return context
		}),
		markFileAsAbortedInContext: enqueueActions(
			({ context, event, enqueue }) => {
				assertEvent(event, 'upload.aborted')
				let mediaFile = mediafile.parse(event.mediaFile)
				let mediafileToUpdate = context.mediaFiles.get(mediaFile.id)
				if (mediafileToUpdate) {
					context.mediaFiles.set(mediaFile.id, {
						...mediafileToUpdate,
						status: 'aborted',
					})
				}

				enqueue.assign(context)
				enqueue.sendTo('queueService', {
					type: 'upload.aborted',
					mediaFileId: mediaFile.id,
				})
			}
		),
		markFileAsDoneInContext: enqueueActions(
			({ context, event, enqueue }) => {
				assertEvent(event, 'upload.done')
				let mediafileToUpdate = context.mediaFiles.get(
					event.mediaFileId
				)
				if (mediafileToUpdate) {
					context.mediaFiles.set(mediafileToUpdate.id, {
						...mediafileToUpdate,
						status: 'done',
					})
				}
				enqueue.assign({
					...context,
				})

				enqueue.sendTo('queueService', {
					type: 'upload.done',
					mediaFileId: event.mediaFileId,
				})
			}
		),
		markFileAsStartedInContext: assign(({ context, event }) => {
			assertEvent(event, 'upload.started')
			let mediafileToUpdate = context.mediaFiles.get(event.mediaFileId)
			if (mediafileToUpdate) {
				context.mediaFiles.set(event.mediaFileId, {
					...mediafileToUpdate,
					status: 'uploading',
				})
			}
			return context
		}),
		removeUploadActor: enqueueActions(({ context, event, enqueue }) => {
			assertEvent(event, ['upload.done'])
			// assertEvent(event, ['upload.aborted', 'upload.done'])
			const mediaFileId = event.mediaFileId
			const actorRef = context.fileActors.get(mediaFileId)
			if (actorRef) {
				enqueue.stopChild(actorRef.id)
				const newUploads = new Map(context.fileActors)
				newUploads.delete(mediaFileId)
				enqueue.assign({ fileActors: newUploads })
			}
		}),
		// Action to send relevant events to the queue actor
		sendEventToQueue: sendTo(
			'queueService',
			({ event }) => event // Cast to any because the event type might be broad
		),
	},
}).createMachine({
	id: 'upload',
	initial: 'initializing',
	context: {
		...initialData,
		queueRef: undefined, // Will hold the reference to the spawned queue
		quotaService: undefined,
	},
	on: {
		'upload.config': {
			actions: 'updateConfig',
		},
		'upload.abort': {
			actions: 'sendAbortToQueue',
		},
		'queue.request.abort': {
			actions: 'sendAbortToFileActor',
		},
		'progress.change': {
			actions: ['updateFileProgress', 'sendEventToQueue'], // Forward to queue actor
		},
		'upload.aborted': {
			actions: [
				'markFileAsAbortedInContext',
				'removeUploadActor',
				'sendEventToQueue', // Forward to queue actor
			],
		},
		'upload.started': {
			actions: ['markFileAsStartedInContext', 'sendEventToQueue'], // Forward to queue actor
		},
		'upload.done': {
			actions: [
				'markFileAsDoneInContext',
				'removeUploadActor',
				'sendEventToQueue', // Forward to queue actor
			],
		},
		'upload.remove': {
			actions: ['removeUploadActor', 'sendEventToQueue'], // Forward to queue actor
		},
		'upload.spawn': {
			actions: 'spawnAndAssignFileActor',
		},
	},
	states: {
		initializing: {
			entry: 'assignQueueService',
			always: {
				actions: 'assignQuotaService',
				target: '#upload.idle',
			}, // Move to idle after spawning queue actor
		},
		idle: {
			on: {
				'upload.add': {
					actions: 'addFileToQueue', // Send to queue actor
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
				console.log({ context, event })
			},
		},
		error: {
			entry: ({ context, event }) => {
				console.log({ context, event })
			},
		},
	},
})

export { uploadMachine }
