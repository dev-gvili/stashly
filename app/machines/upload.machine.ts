import {
	assign,
	setup,
	assertEvent,
	enqueueActions,
	and,
	not,
	sendTo,
} from 'xstate'
import { fileMachine } from './file.machine'
import type { UploadManagerData, UploadManagerEvents } from './machine.types'
import { config, mediafile, uploadProgress } from './schema.zod'
import type { User } from 'better-auth'

let initialData: UploadManagerData = {
	config: {
		bucketName: '',
		ownerId: '',
		user: undefined as unknown as User & {
			bucket: string
			subscriptionId: string
			storagePlanId: string
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

const uploadMachine = setup({
	types: {
		context: {} as UploadManagerData,
		events: {} as UploadManagerEvents,
	},
	actors: {
		fileMachine,
	},
	actions: {
		updateConfig: enqueueActions(({ enqueue, context, event }) => {
			assertEvent(event, 'upload.config')
			let parsedConfig = config.parse({
				...event.config,
				user: event.user,
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
					pending: context.queues.pending.set(
						mediaFile.id,
						mediaFile
					),
				},
			})
		}),
		addToSkippedQueue: enqueueActions(({ enqueue, context, event }) => {
			assertEvent(event, 'upload.add')
			let mediaFile = mediafile.parse(event.mediaFile)
			enqueue.assign({
				queues: {
					...context.queues,
					skipped: context.queues.skipped.add(mediaFile.id),
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
						input: {
							user: context.config.user,
							bucketName: context.config.bucketName,
							ownerId: context.config.ownerId,
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
		addFile: enqueueActions(({ context, event, enqueue }) => {
			assertEvent(event, 'upload.add')
			let mediaFile = mediafile.parse({
				...event.mediaFile,
				ownerId: context.config.ownerId,
			})
			let mediaFiles = context.mediaFiles.set(mediaFile.id, mediaFile)
			enqueue.assign({ mediaFiles })
			enqueue.raise({
				type: 'upload.spawn',
				mediaFile: event.mediaFile,
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
					parsedConfig.maxConcurrentUploads -
					context.queues.active.size
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
	},
	guards: {
		concurrentLessThenMax: ({ context }) => {
			const parsedConfig = config.safeParse(context.config)
			if (!parsedConfig.success) {
				return false
			}
			return (
				context.queues.active.size <
				parsedConfig.data.maxConcurrentUploads
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
	id: 'upload',
	initial: 'idle',
	context: {
		...initialData,
	},
	on: {
		'upload.config': {
			actions: 'updateConfig',
		},
	},
	states: {
		idle: {
			on: {
				'progress.change': {
					actions: 'updateProgress',
				},
				'upload.abort': {
					actions: 'sendAbortUpload',
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
					actions: 'startMultipartUpload',
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
					actions: 'markAsStarted'
				},
				'upload.done': {
					actions: [
						'markAsDone',
						'removeFromActiveQueue',
						'removeFromUploads',
						'uploadPendingFiles',
					],
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
