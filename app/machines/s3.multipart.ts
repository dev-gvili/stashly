import { assertEvent, assign, setup } from 'xstate'
import {
	uploadParts,
	createUpload,
	presignedPartUrl,
	abortUpload,
	completeUpload,
} from '@/machines/s3.mulipart.utils'
import type {
	MultipartContext,
	MultipartEvents,
	MultipartInput,
	MultipartOutput,
} from './machine.types'

export const multipart = setup({
	types: {
		input: {} as MultipartInput,
		output: {} as MultipartOutput,
		context: {} as MultipartContext,
		events: {} as MultipartEvents,
	},
	actions: {
		assignUploadId: (_, params: { uploadId: string }) => ({
			uploadId: params.uploadId,
		}),
		assignProgress: assign({
			uploadProgress: ({ event }) => {
				assertEvent(event, '@multipart.upload.progress.change')
				return event.progress
			},
		}),
		assignUploadedParts: assign({
			uploadedParts: ({ event }) => {
				assertEvent(event, '@multipart.upload.done')
				return event.parts
			},
		}),
		assignError: assign({
			error: ({ event }) => {
				assertEvent(event, '@multipart.upload.error')
				return event.error
			},
		}),
	},
	actors: {
		createUpload,
		presignedPartUrl,
		abortUpload,
		completeUpload,
		uploadParts,
	},
}).createMachine({
	id: 'multipart',
	description:
		'This machine orchestrates the multipart upload process to S3. It handles the creation of the multipart upload, the uploading of individual parts, and the final completion or abortion of the upload.',
	context: ({ input }) => ({
		error: '',
		uploadId: '',
		file: input.file,
		uploadedParts: [],
		key: input.file.name,
		uploadProgress: {
			percentage: 0,
			speed: { unit: 'KB/s', value: 0 },
			timeLeft: { hours: 0, minutes: 0, seconds: 0 },
		},
		uploadCompleteData: {
			etag: '',
			version: '',
		},
	}),
	on: { '@multipart.upload.abort': 'abort' },
	initial: 'create',
	states: {
		create: {
			invoke: {
				id: '@multipart.create',
				src: 'createUpload',
				input: ({ context }) => ({
					key: context.key,
				}),
				onDone: {
					target: 'upload',
					actions: {
						type: 'assignUploadId',
						params: ({ event }) => event.output,
					},
				},
				onError: {
					target: 'abort',
				},
			},
			description:
				'Invokes a service to create a multipart upload, obtaining a unique uploadId from the S3 API. This uploadId is essential for subsequent upload parts and for completing or aborting the multipart upload.',
		},
		upload: {
			invoke: {
				id: '@multipart.upload',
				src: 'uploadParts',
				input: ({ context }) => ({
					file: context.file,
					key: context.key,
					uploadId: context.uploadId,
				}),
			},
			on: {
				'@multipart.upload.done': {
					target: 'complete',
					actions: { type: 'assignUploadedParts' },
				},
				'@multipart.upload.error': {
					target: 'cancelled',
					actions: { type: 'assignError' },
				},
				'@multipart.upload.progress.change': {
					actions: { type: 'assignProgress' },
				},
			},
			description:
				'In this state, the file is divided into multiple parts, each of which is pre-signed and uploaded. All successfully uploaded parts are collected into an array, which will be used in the `complete` state to finalize the multipart upload.',
		},
		abort: {
			invoke: {
				id: '@multipart.abort',
				src: 'abortUpload',
				input: ({ context }) => ({
					key: context.key,
					uploadId: context.uploadId,
				}),
				onDone: {
					target: 'cancelled',
				},
				onError: {
					target: 'cancelled',
					actions: 'assignError',
				},
			},
			description:
				'This state is entered if the multipart upload process needs to be stopped prematurely, either due to an error or a user-initiated cancellation. It sends a request to S3 to abort the multipart upload, which cleans up any uploaded parts and prevents incomplete files from being stored. This ensures that no partial or corrupted data remains on S3.',
		},
		complete: {
			invoke: {
				id: '@multipart.complete',
				src: 'completeUpload',
				input: ({ context }) => ({
					key: context.key,
					parts: context.uploadedParts,
					uploadId: context.uploadId,
				}),
				onDone: {
					target: 'done',
				},
				onError: {
					target: 'abort',
				},
			},
			description:
				'After all parts of the file have been successfully uploaded, this state finalizes the multipart upload. It sends a request to S3 with the `uploadId` and the list of all uploaded parts (including their ETags and part numbers). S3 then reassembles these parts into the complete file. This state is critical for ensuring data integrity and for making the uploaded file accessible.',
		},
		cancelled: {
			type: 'final',
			description:
				'This state indicates that the multipart upload process has been cancelled, either due to a failure or user action. This state is a final state',
		},
		done: {
			type: 'final',
			output: ({ context }) => ({
				...context.uploadCompleteData,
			}),
			description:
				'This state indicates that the multipart upload has been successfully completed and the file is now accessible in S3. This state is a final state',
		},
	},
})
