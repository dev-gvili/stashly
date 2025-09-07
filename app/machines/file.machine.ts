import {
	assign,
	setup,
	assertEvent,
	enqueueActions,
	log,
	type ErrorActorEvent,
	type DoneActorEvent,
	fromPromise,
	sendTo,
} from 'xstate'
import type {
	MediaFileData,
	MediaFileStatus,
	MediaFileEvents,
	MediaFileInput,
	MediaFile,
} from './machine.types'
import { createItem, multipart, api } from './file.actors'
import { toCategory } from '@/utils/converters'

// ====================================================== //
// ==================== Custom Actors =================== //
// ====================================================== //

const create = fromPromise<
	Awaited<ReturnType<typeof api.createMultipartUpload>>,
	{ bucket: string; key: string; metadata?: Record<string, string> }
>(async ({ input: { bucket, key, metadata } }) => {
	return await api.createMultipartUpload(bucket, key, metadata)
})

const complete = fromPromise<
	Awaited<ReturnType<typeof api.completeMultipartUpload>>,
	Parameters<typeof api.completeMultipartUpload>[0]
>(async ({ input }) => {
	return await api.completeMultipartUpload(input)
})

// ====================================================== //
// Machine                                                //
// ====================================================== //

const fileMachine = setup({
	types: {
		input: {} as MediaFileInput,
		context: {} as MediaFileData,
		events: {} as MediaFileEvents,
		output: {} as {
			mediaFile: MediaFile
			uploadId: string
		},
	},
	actions: {
		UPDATE_PROGRESS: assign(({ context, event }) => {
			assertEvent(event, 'progress')
			return {
				mediaFile: {
					...context.mediaFile,
					progress: event.progress,
				},
			}
		}),
		SEND_PARENT_PROGRESS_CHANGED: enqueueActions(
			({ context, event, enqueue }) => {
				assertEvent(event, 'progress')
				enqueue.sendParent({
					type: 'progress.change',
					mediaFileId: context.mediaFile.id,
					progress: event.progress,
				})
			}
		),
		SEND_PARENT_UPLOAD_ABORTED: enqueueActions(({ context, enqueue }) => {
			enqueue.sendParent({
				type: 'upload.aborted',
				mediaFile: context.mediaFile,
			})
		}),
		NOTIFY_QUOTA: sendTo(
			({ system }) => system.get('quotaService'),
			({ context }) => ({
				type: '@quota.update.used',
				userId: '',
				fileSizeInBytes: context.mediaFile.file.size,
			})
		),
		// enqueue.sendParent({
		// 	type: 'upload.done',
		// 	mediaFile: context.mediaFile,
		// })
		SEND_PARENT_UPLOAD_DONE: enqueueActions(
			({ context, enqueue }) => {
				enqueue.sendParent({
					type: 'upload.done',
					mediaFile: context.mediaFile,
				})
			}
		),
		SEND_PARENT_UPLOAD_STARTED: enqueueActions(({ context, enqueue }) => {
			enqueue.sendParent({
				type: 'upload.started',
				mediaFileId: context.mediaFile.id,
			})
		}),
		// not in used, just an idea.
		notifyParent: enqueueActions(({ context, enqueue, event }) => {
			enqueue.sendParent({
				type: event.type,
				mediaFileId: context.mediaFile.id,
			})
		}),
		SEND_PARENT_REMOVE_UPLOAD: enqueueActions(({ context, enqueue }) => {
			enqueue.sendParent({
				type: 'upload.remove',
				id: context.mediaFile.id,
			})
		}),
		ABORT_UPLOAD: enqueueActions(({ context, enqueue }) => {
			enqueue.sendTo(context.uploadRef!, {
				type: 'abort',
			})
		}),
		stopActor: enqueueActions(({ context, enqueue }) => {
			enqueue.stopChild(context.uploadRef!)
		}),
		CHANGE_STATUS_TO_UPLOADING: assign(({ context }) => ({
			mediaFile: {
				...context.mediaFile,
				status: 'uploading' as MediaFileStatus,
			},
		})),
		CHANGE_STATUS_TO_DONE: assign(({ context }) => {
			return {
				mediaFile: {
					...context.mediaFile,
					status: 'done' as MediaFileStatus,
				},
			}
		}),
		CHANGE_STATUS_TO_ABORTED: assign(({ context }) => ({
			mediaFile: {
				...context.mediaFile,
				status: 'aborted' as MediaFileStatus,
			},
		})),
		SAVE_ERROR: assign({
			error: ({ event }) => {
				return (event as unknown as ErrorActorEvent<unknown, string>)
					.error as Error
			},
		}),
		SAVE_UPLOAD_ID: assign({
			uploadId: ({ event }) => {
				return (
					event as unknown as DoneActorEvent<{ uploadId: string }>
				).output.uploadId
			},
		}),
		SAVE_UPLOAD_URL: assign({
			mediaFile: ({ context, event }) => {
				return {
					...context.mediaFile,
					url: (event as unknown as DoneActorEvent<{ url: string }>)
						.output.url,
				}
			},
		}),
		UPDATE_MEDIAFILE: assign({
			mediaFile: ({ context, event }) => {
				return {
					...context.mediaFile,
					...(
						event as unknown as DoneActorEvent<{
							eytag: string
							versionId: string
						}>
					).output,
					status: 'done' as MediaFileStatus,
				}
			},
		}),
		START_UPLOAD_SERVICE: enqueueActions(({ context, event, enqueue }) => {
			enqueue.assign(({ spawn }) => {
				let actor = spawn('upload', {
					id: '@s3.multipart.upload',
					input: {
						file: context.mediaFile.file,
						key: context.mediaFile.file.name,
						uploadId: context.uploadId,
					},
				})
				return { uploadRef: actor }
			})
		}),
		CONSOLE_LOG: log(({ context, event }) =>
			console.log({ context, event })
		),
	},
	actors: {
		createItem,
		create,
		upload: multipart,
		complete,
	},
}).createMachine({
	context: ({ input }) => ({
		...input,
		uploadId: '',
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
				id: '@s3.multipart.create',
				src: 'create',
				input: ({ context }) => ({
					metadata: {
						subscriptionId: context.user.subscriptionId,
						storagePlanId: context.user.storagePlanId,
						uploadedById: context.user.id,
						category: toCategory(context.mediaFile.file),
					},
					key: context.mediaFile.file.name,
					bucket: context.bucketName,
				}),
				onDone: {
					target: 'uploading',
					actions: 'SAVE_UPLOAD_ID',
				},
				onError: {
					target: 'error',
					actions: 'SAVE_ERROR',
				},
			},
		},
		uploading: {
			entry: [
				'CHANGE_STATUS_TO_UPLOADING',
				'START_UPLOAD_SERVICE',
				'SEND_PARENT_UPLOAD_STARTED',
			],
			on: {
				progress: {
					actions: [
						'UPDATE_PROGRESS',
						'SEND_PARENT_PROGRESS_CHANGED',
					],
				},
				abort: {
					actions: [console.log, 'ABORT_UPLOAD'],
				},
				aborted: {
					target: 'aborted',
					actions: 'CHANGE_STATUS_TO_ABORTED',
				},
				done: {
					target: 'completingUpload',
				},
			},
		},
		completingUpload: {
			invoke: {
				id: '@s3.multipart.complete',
				src: 'complete',
				input: ({ context, event }) => {
					assertEvent(event, 'done')
					return {
						parts: event.parts,
						key: context.mediaFile.file.name,
						uploadId: context.uploadId,
					}
				},
				onDone: {
					target: 'success',
					actions: ['UPDATE_MEDIAFILE', 'NOTIFY_QUOTA'],
				},
				onError: {
					target: 'error',
					actions: 'SAVE_ERROR',
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
					actions: 'CONSOLE_LOG',
				},
				onError: {
					target: 'error',
					actions: 'SAVE_ERROR',
				},
			},
		},
		aborted: {
			after: {
				700: {
					target: 'pending',
				},
			},
			entry: 'SEND_PARENT_UPLOAD_ABORTED',
		},
		success: {
			entry: 'SEND_PARENT_UPLOAD_DONE',
			// type: 'final',
			output: ({ context }) => ({
				mediaFile: context.mediaFile,
				uploadId: context.uploadId,
			}),
		},
		error: {
			entry: 'CONSOLE_LOG',
			type: 'final',
		},
	},
})

export { fileMachine }
