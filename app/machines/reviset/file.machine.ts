// file.machine.ts
import {
	assign,
	setup,
	assertEvent,
	fromPromise,
	log,
	type AnyActorRef,
	type DoneActorEvent,
	sendTo,
	type ErrorActorEvent,
} from 'xstate'
import type {
	MediaFileData,
	MediaFileStatus,
	MediaFileEvents,
	MediaFileInput,
} from '../machine.types'
import {
	completeUpload,
	createUpload,
	uploadParts as multipartActor,
} from '../s3.mulipart.utils'
import {
	check as checkQuota,
	updateUsed as updateUsedQuota,
} from '../quota.actors'

// ====================================================== //
// =================== Custom Actors ==================== //
// ====================================================== //
// Actors are separated to allow for a clearer machine definition
// and easier testing/mocking.

// ====================================================== //
// Machine                                                //
// ====================================================== //

export const fileMachine = setup({
	types: {
		input: {} as MediaFileInput,
		context: {} as MediaFileData,
		events: {} as MediaFileEvents,
	},
	// Machine-specific actions
	actions: {
		// Saves the upload ID from the create multipart upload actor
		assignUploadId: (_, params: { uploadId: string }) => ({
			uploadId: params.uploadId,
		}),
		// Saves the error message to the context
		assignError: assign({
			error: ({ event }) => {
				return (event as unknown as ErrorActorEvent<unknown, string>)
					.error as Error
			},
		}),
		// Assigns the multipart actor reference to the context
		assignUploadRef: assign({
			uploadRef: ({ spawn, context, self }) =>
				spawn('multipart', {
					id: `upload-${context.mediaFile.id}`,
					input: {
						file: context.mediaFile.file,
						key: context.mediaFile.file.name,
						uploadId: context.uploadId!,
					},
				}),
		}),
		// Removes the multipart actor from the context
		removeUploadRef: assign({
			uploadRef: undefined,
		}),
		// Sends a 'upload.started' event to the parent manager.
		sendUploadStartedToParent: sendTo('parentRef', ({ context }) => ({
			type: 'upload.started',
			mediaFileId: context.mediaFile.id,
		})),
		// Sends a 'upload.done' event to the parent manager.
		sendUploadDoneToParent: sendTo('parentRef', ({ context }) => ({
			type: 'upload.done',
			mediaFileId: context.mediaFile.id,
		})),
		// Sends an 'upload.aborted' event to the parent manager.
		sendUploadAbortedToParent: sendTo('parentRef', ({ context }) => ({
			type: 'upload.aborted',
			mediaFileId: context.mediaFile.id,
		})),
		// Marks the file status as 'uploading'
		markAsUploading: assign({
			mediaFile: ({ context }) => ({
				...context.mediaFile,
				status: 'uploading' as MediaFileStatus,
			}),
		}),
		// Marks the file status as 'done' and updates metadata
		markAsDone: assign(({ context, event }) => {
			assertEvent(event, 'completed')
			return {
				mediaFile: {
					...context.mediaFile,
					status: 'done' as MediaFileStatus,
					etag: event.etag,
					version: event.versionId,
				},
			}
		}),
		// Marks the file status as 'aborted'
		markAsAborted: assign({
			mediaFile: ({ context }) => ({
				...context.mediaFile,
				status: 'aborted' as MediaFileStatus,
			}),
		}),
	},
	// Machine-specific actors
	actors: {
		// Invokes the multipart actor to handle the actual upload
		multipart: multipartActor,
		// Invokes the check quota service
		checkQuota,
		// Invokes the update quota service
		updateUsedQuota,
		// Invokes the create multipart upload service
		createMultipartUpload: createUpload,
		// Invokes the complete multipart upload service
		completeMultipartUpload: completeUpload,
	},
}).createMachine({
	id: 'fileUpload',
	initial: 'initializing',
	context: ({ input }) => ({
		...input,
		uploadId: '',
		error: undefined,
		mediaFile: {
			...input.mediaFile,
			status: 'pending' as MediaFileStatus,
		},
		uploadRef: undefined,
	}),
	states: {
		// Initializing state: a transient state to perform initial setup
		initializing: {
			always: 'checkingQuota',
		},
		// CheckingQuota state: checks if the user has enough storage space
		checkingQuota: {
			entry: log('Checking quota...'),
			invoke: {
				id: 'checkQuota',
				src: 'checkQuota',
				input: ({ context }) => ({
					userId: context.user.id,
					fileSizeInBytes: BigInt(context.mediaFile.file.size),
				}),
				onDone: {
					target: 'creatingUpload',
					actions: log('Quota check passed. Creating upload...'),
				},
				onError: {
					target: 'error',
					actions: ['assignError', log('Quota check failed.')],
				},
			},
		},
		// CreatingUpload state: initiates a multipart upload on S3 to get an upload ID
		creatingUpload: {
			invoke: {
				id: 'createMultipartUpload',
				src: 'createMultipartUpload',
				input: ({ context }) => ({
					bucket: context.bucketName,
					key: context.mediaFile.file.name,
					metadata: {
						ownerId: context.user.id,
						fileName: context.mediaFile.file.name,
					},
				}),
				onDone: {
					target: 'uploading',
					actions: [
						{
							type: 'assignUploadId',
							params: ({ event }) => event.output,
						},
						log('Multipart upload created.'),
					],
				},
				onError: {
					target: 'error',
					actions: [
						'assignError',
						log('Failed to create multipart upload.'),
					],
				},
			},
		},
		// Uploading state: handles the actual file transfer
		uploading: {
			entry: [
				'assignUploadRef',
				'markAsUploading',
				'sendUploadStartedToParent',
				log('Starting upload...'),
			],
			on: {
				// Forward progress events from the multipart actor to the parent manager
				progress: {
					actions: sendTo('parentRef', ({ event }) => ({
						type: 'progress.change',
						progress: event.progress,
					})),
				},
				// When the multipart actor completes, move to the next state
				'upload.done': {
					target: 'completingUpload',
					actions: log('Multipart upload done. Completing...'),
				},
				// Handle an abort event from the parent
				'upload.abort': {
					actions: [
						sendTo('uploadRef', { type: 'abort' }),
						log('Aborting upload...'),
					],
				},
				// When the multipart actor has been aborted, move to the aborted state
				'upload.aborted': {
					target: 'aborted',
					actions: ['markAsAborted', 'sendUploadAbortedToParent'],
				},
				// When the multipart actor has an error, move to the error state
				'upload.error': {
					target: 'error',
					actions: ['assignError', log('Multipart upload error.')],
				},
			},
			exit: ['removeUploadRef'],
		},
		// CompletingUpload state: finalizes the multipart upload on S3
		completingUpload: {
			entry: log('Completing multipart upload...'),
			invoke: {
				id: 'completeMultipartUpload',
				src: 'completeMultipartUpload',
				input: ({ context, event }) => {
					assertEvent(event, 'done')
					return {
						key: context.mediaFile.file.name,
						uploadId: context.uploadId!,
						parts: event.parts,
					}
				},
				onDone: {
					target: 'updatingQuota',
					actions: ['markAsDone', log('Multipart upload completed.')],
				},
				onError: {
					target: 'error',
					actions: [
						'assignError',
						log('Failed to complete multipart upload.'),
					],
				},
			},
		},
		// UpdatingQuota state: updates the user's storage quota in the database
		updatingQuota: {
			entry: log('Updating quota...'),
			invoke: {
				id: 'updateUsedQuota',
				src: 'updateUsedQuota',
				input: ({ context }) => ({
					userId: context.user.id,
					fileSizeInBytes: BigInt(context.mediaFile.file.size),
				}),
				onDone: {
					target: 'success',
					actions: [
						'sendUploadDoneToParent',
						log('Quota updated successfully.'),
					],
				},
				onError: {
					target: 'error',
					actions: ['assignError', log('Failed to update quota.')],
				},
			},
		},
		// Aborted state: when the upload is intentionally cancelled
		aborted: {
			type: 'final',
			description: 'The upload has been aborted.',
		},
		// Success state: final state after a successful upload
		success: {
			type: 'final',
			description: 'The upload and quota update are complete.',
		},
		// Error state: final state after a failure
		error: {
			type: 'final',
			description: 'An error occurred during the upload process.',
		},
	},
})
