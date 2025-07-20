import {
	assign,
	setup,
	assertEvent,
	enqueueActions,
	log,
	type ErrorActorEvent,
	type DoneActorEvent,
} from 'xstate'
import type {
	MediaFileData,
	MediaFileStatus,
	MediaFileEvents,
	MediaFileInput,
} from './types'
import { createItem, requestPresignedUrl, uploadHandler } from './file.actors'

// ====================================================== //
// Machine                                                //
// ====================================================== //

const fileMachine = setup({
	types: {
		input: {} as MediaFileInput,
		context: {} as MediaFileData,
		events: {} as MediaFileEvents,
	},
	actions: {
		updateUploadProgress: assign(({ context, event }) => {
			assertEvent(event, 'progress')
			return {
				mediaFile: {
					...context.mediaFile,
					progress: event.progress,
					uploadSpeedMbps: event.uploadSpeedMbps,
					runTime: event.runTime,
					timeLeft: event.timeLeft,
				},
			}
		}),
		updateEtagAndVersion: enqueueActions(({ context, event, enqueue }) => {
			assertEvent(event, 'done')
			enqueue.assign({
				mediaFile: {
					...context.mediaFile,
					etag: event.etag,
					version: event.version,
				},
			})
		}),
		sendProgressChange: enqueueActions(({ context, event, enqueue }) => {
			assertEvent(event, 'progress')
			let { type, ...data } = event
			enqueue.sendTo(context.parentRef!, {
				type: 'progress.change',
				mediaFile: {
					...context.mediaFile,
					...data,
				},
			})
		}),
		sendUploadAborted: enqueueActions(({ context, enqueue }) => {
			enqueue.sendTo(context.parentRef!, {
				type: 'upload.aborted',
				mediaFile: context.mediaFile,
			})
		}),
		sendUploadDone: enqueueActions(({ context, enqueue }) => {
			enqueue.sendTo(context.parentRef!, {
				type: 'upload.done',
				mediaFile: context.mediaFile,
			})
		}),
		sendCleanupToParent: enqueueActions(({ context, enqueue }) => {
			enqueue.sendTo(context.parentRef!, {
				type: 'upload.remove',
				id: context.mediaFile.id,
			})
		}),
		sendAbortUpload: enqueueActions(({ context, enqueue }) => {
			enqueue.sendTo(context.uploadRef!, {
				type: 'abort',
			})
		}),
		sendCheckHeaders: enqueueActions(({ context, enqueue }) => {
			enqueue.sendTo(context.uploadRef!, {
				type: 'headers.check',
			})
		}),
		stopActor: enqueueActions(({ context, enqueue }) => {
			enqueue.stopChild(context.uploadRef!)
		}),
		markAsUploading: assign(({ context }) => ({
			mediaFile: {
				...context.mediaFile,
				status: 'uploading' as MediaFileStatus,
			},
		})),
		markAsDone: assign(({ context, event }) => {
			assertEvent(event, 'done')
			return {
				mediaFile: {
					...context.mediaFile,
					timeLeft: {
						hours: 0,
						minutes: 0,
						seconds: 0,
					},
					status: 'done' as MediaFileStatus,
				},
			}
		}),
		markAsAborted: assign(({ context }) => ({
			mediaFile: {
				...context.mediaFile,
				status: 'aborted' as MediaFileStatus,
			},
		})),
		assignError: assign({
			error: ({ event }) => {
				return (event as unknown as ErrorActorEvent<unknown, string>)
					.error as Error
			},
		}),
		assignUploadUrl: assign({
			mediaFile: ({ context, event }) => {
				return {
					...context.mediaFile,
					url: (event as unknown as DoneActorEvent<{ url: string }>)
						.output.url,
				}
			},
		}),
		spawnAndAssign: enqueueActions(({ context, event, enqueue }) => {
			enqueue.assign(({ spawn }) => {
				let actor = spawn('uploadHandler', {
					id: 's3.UploadHandler',
					input: {
						bucket: context.bucketName,
						user: context.user,
						mediaFile: context.mediaFile,
					},
				})
				return { uploadRef: actor }
			})
		}),
		logToConsole: log(({ context, event }) =>
			console.log({ context, event })
		),
	},
	actors: {
		requestPresignedUrl,
		uploadHandler,
		createItem,
	},
}).createMachine({
	context: ({ input }) => ({
		bucketName: input.bucketName,
		ownerId: input.ownerId,
		mediaFile: input.mediaFile,
		user: input.user,
		parentRef: input.parentRef,
		error: undefined,
	}),
	initial: 'pending',
	states: {
		pending: {
			on: {
				start: {
					target: 'init',
				},
			},
		},
		init: {
			invoke: {
				id: 'minio.presignedPutUrl',
				src: 'requestPresignedUrl',
				input: ({ context }) => ({
					file: context.mediaFile.file,
					bucketName: context.bucketName,
				}),
				onDone: {
					target: 'uploading',
					actions: 'assignUploadUrl',
				},
				onError: {
					target: 'error',
					actions: 'assignError',
				},
			},
		},
		uploading: {
			entry: ['markAsUploading', 'spawnAndAssign'],
			on: {
				progress: {
					actions: ['updateUploadProgress', 'sendProgressChange'],
				},
				abort: {
					actions: 'sendAbortUpload',
				},
				aborted: {
					target: 'aborted',
					actions: 'markAsAborted',
				},
				done: {
					target: 'creatingItem',
					actions: ['updateEtagAndVersion', 'markAsDone'],
				},
			},
		},
		creatingItem: {
			invoke: {
				id: 'db.create.item',
				src: 'createItem',
				input: ({ context }) => ({
					mediafile: {
						...context.mediaFile,
						ownerId: context.ownerId,
					},
				}),
				onDone: {
					target: 'success',
					actions: 'logToConsole',
				},
				onError: {
					target: 'error',
					actions: 'assignError',
				},
			},
		},
		aborted: {
			after: {
				700: {
					target: 'pending',
				},
			},
			entry: 'sendUploadAborted',
		},
		success: {
			entry: 'sendUploadDone',
		},
		error: {
			entry: 'logToConsole',
		},
	},
})

export { fileMachine }
