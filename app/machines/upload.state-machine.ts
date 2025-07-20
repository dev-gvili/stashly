// import { createMachine, setup, fromPromise, assign, assertEvent } from 'xstate'
// import type { User } from 'better-auth'
// import { S3Service, type UploadProgress } from '@/services/s3.server'
// import { QuotaService } from '@/services/quota.service'

// interface UploadContext {
// 	s3Service: S3Service
// 	quotaService: QuotaService
// 	user: User
// 	file: File
// 	workspaceId?: string
// 	abortController: AbortController
// 	uploadedFileKey?: string | null
// 	uploadResult?: {
// 		key: string
// 		etag?: string
// 		versionId?: string
// 	}
// 	error?: any
// }

// type UploadEvent =
// 	| { type: 'START'; file: File; user: User }
// 	| { type: 'ABORT' }
// 	| { type: 'UPLOAD_PROGRESS'; progress: UploadProgress }

// export const fileUploadMachine = setup({
// 	types: {} as {
// 		context: UploadContext
// 		events: UploadEvent
// 	},
// 	actions: {
// 		setUploadedFileKey: ({ context, event }, { key }) => {
// 			context.uploadedFileKey = key
// 		},
// 		setUploadResult: ({ context }, { result }) => {
// 			context.uploadResult = result
// 		},
// 		setError: ({ context }, { error }) => {
// 			context.error = error
// 		},
// 		clearUploadedFileKey: ({ context }) => {
// 			context.uploadedFileKey = null
// 		},
// 	},
// 	actors: {
// 		checkQuota: fromPromise<void, UploadContext>(async ({ input }) => {
// 			await input.quotaService.checkFileUploadQuota(
// 				input.user.id,
// 				BigInt(input.file.size)
// 			)
// 		}),
// 		uploadToS3: fromPromise<
// 			{
// 				result: Awaited<
// 					ReturnType<UploadContext['s3Service']['uploadFile']>
// 				>
// 			},
// 			UploadContext
// 		>(async ({ input, self }) => {
// 			const uploadResponse = await input.s3Service.uploadFile(
// 				input.file,
// 				input.user,
// 				input.workspaceId,
// 				(progress) => self.send({ type: 'UPLOAD_PROGRESS', progress }),
// 				input.abortController
// 			)
// 			return { result: uploadResponse }
// 		}),
// 		updateQuota: fromPromise<void, UploadContext>(async ({ input }) => {
// 			await input.quotaService.updateQuotaForUpload(
// 				input.user.id,
// 				BigInt(input.file.size)
// 			)
// 		}),
// 		rollback: fromPromise<void, UploadContext>(async ({ input }) => {
// 			if (input.uploadedFileKey) {
// 				try {
// 					await input.s3Service.deleteFile(input.uploadedFileKey)
// 				} catch (err) {
// 					// Log error, manual cleanup may be required
// 				}
// 				input.uploadedFileKey = null
// 			}
// 		}),
// 	},
// }).createMachine({
// 	id: 'fileUpload',
// 	initial: 'idle',
// 	context: {
// 		user: {} as User,
// 		file: {} as File,
// 		uploadedFileKey: null,
// 		uploadResult: undefined,
// 		error: null,
// 		abortController: new AbortController(),
// 		workspaceId: undefined,
// 		s3Service: new S3Service(),
// 		quotaService: new QuotaService(),
// 	},
// 	states: {
// 		idle: {
// 			on: {
// 				START: {
//                     actions: assign(({ event }) => {
//                        assertEvent(event, 'START')
//                         return {
//                             file: event.file,
//                             user: event.user,
//                         }
//                     }),
// 					target: 'checkingQuota'
// 				},
// 			},
// 		},
// 		checkingQuota: {
// 			invoke: {
// 				src: 'checkQuota',
// 				id: 'checkQuota',
// 				input: ({ context }) => context,
// 				onDone: { target: 'uploadingToS3' },
// 				onError: {
// 					target: 'failed',
// 					actions: assign(({ event }) => ({
// 						error: event.error,
// 					})),
// 				},
// 			},
// 		},
// 		uploadingToS3: {
// 			invoke: {
// 				src: 'uploadToS3',
// 				id: 'uploadToS3',
// 				input: ({ context }) => context,
// 				onDone: {
// 					target: 'updatingQuota',
// 					actions: assign(({ context, event }) => ({
// 						uploadedFileKey: event.output.result.key,
// 						uploadResult: event.output.result,
// 					})),
// 				},
// 				onError: {
// 					target: 'rollingBack',
// 					actions: assign(({ event }) => ({
// 						error: event.error,
// 					})),
// 				},
// 			},
// 		},
// 		updatingQuota: {
// 			invoke: {
// 				src: 'updateQuota',
// 				id: 'updateQuota',
// 				input: ({ context }) => context,
// 				onDone: { target: 'completed' },
// 				onError: {
// 					target: 'rollingBack',
// 					actions: assign(({ event }) => ({
// 						error: event.error,
// 					})),
// 				},
// 			},
// 		},
// 		completed: {
// 			type: 'final',
// 		},
// 		rollingBack: {
// 			invoke: {
// 				src: 'rollback',
// 				id: 'rollback',
// 				input: ({ context }) => context,
// 				onDone: { target: 'failed' },
// 			},
// 		},
// 		failed: {
// 			type: 'final',
// 		},
// 	},
// 	on: {
// 		ABORT: {
// 			target: '.failed',
// 		},
// 		UPLOAD_PROGRESS: {
// 			actions: ({ context, event }) => {
// 				// Handle upload progress updates
// 				console.log('Upload progress:', event.progress)
// 			},
// 		},
// 	},
// })
