import type { ActorRefFrom, AnyActorRef } from 'xstate'
import { z } from 'zod'
import { fileMachine } from './file.machine'
import type { User } from 'better-auth'

const user = z.object({
	id: z.string(),
	name: z.string(),
	emailVerified: z.boolean(),
	email: z.string(),
	createdAt: z.date(),
	updatedAt: z.date(),
	image: z.string().nullish(),
	bucket: z.string(),
})

export let mediaFileStatus = z
	.literal('pending')
	.or(z.literal('aborted'))
	.or(z.literal('done'))
	.or(z.literal('uploading'))
	.or(z.literal('paused'))
	.or(z.literal('skipped'))
	.default('pending')

export let mediafileUploadInfo = z.object({
	'x-amz-version-id': z.string(),
	'x-amz-request-id': z.string(),
	etag: z.string().transform((value) => value.replaceAll('"', '')),
})

export let timeLeft = z.object({
	hours: z.number().default(0),
	minutes: z.number().default(0),
	seconds: z.number().default(0),
})

export let mediafile = z
	.object({
		id: z.string(),
		ownerId: z.string().optional(),
		file: z.instanceof(File),
		progress: z.number().min(0).max(100).default(0),
		uploadSpeedMbps: z.number().default(0),
		timeLeft: timeLeft,
		runTime: z.number().default(0),
		status: mediaFileStatus,
		url: z.string(),
		etag: mediafileUploadInfo.shape.etag.optional(),
		version: mediafileUploadInfo.shape['x-amz-version-id'].optional(),
		error: z.string().optional(),
	})
	.strict()

export let uiConfig = z.object({
	displayDuration: z.boolean().default(false),
	displayCount: z.boolean().default(false),
})

export let config = z
	.object({
		bucketName: z.string(),
		ownerId: z.string(),
		user: user,
		maxFileSize: z.number().default(10000000000),
		maxConcurrentUploads: z.number().default(5),
		acceptedMimeTypes: z
			.string()
			.array()
			.transform((value) => z.util.joinValues(value, ','))
			.optional(),
		ui: uiConfig.optional(),
	})
	.strict()

export let uploadManagerSchema = z.object({
	config: config,
	mediaFiles: z.map(z.string(), mediafile),
	queues: z.object({
		active: z.set(z.string()),
		skipped: z.set(z.string()),
		completed: z.set(z.string()),
		pending: z.map(z.string(), mediafile),
	}),
	uploads: z.map(z.string(), z.custom<ActorRefFrom<typeof fileMachine>>()),
	error: z.string().optional(),
})

// ====================================================== //
// Upload Manager Events                                  //
// ====================================================== //
let uploadQueuesPendingAdd = z.object({
	type: z.literal('upload.queues.pending.add'),
	mediaFile: mediafile,
})
let uploadAdd = z.object({
	type: z.literal('upload.add'),
	mediaFile: mediafile,
})
let uploadSpawn = z.object({
	type: z.literal('upload.spawn'),
	mediaFile: mediafile,
})
let uploadDone = z.object({
	type: z.literal('upload.done'),
	mediaFile: mediafile,
})
let uploadActive = z.object({
	type: z.literal('upload.active'),
	mediaFile: mediafile,
})
let uploadStart = z.object({
	type: z.literal('upload.start'),
	mediaFile: mediafile,
})
let uploadAbort = z.object({
	type: z.literal('upload.abort'),
	mediaFile: mediafile,
})
let uploadAborted = z.object({
	type: z.literal('upload.aborted'),
	mediaFile: mediafile,
})
let uploadProgressChange = z.object({
	type: z.literal('progress.change'),
	mediaFile: mediafile,
})
let uploadConfig = z.object({
	type: z.literal('upload.config'),
	config: config.partial(),
	user: user.partial()
})
let uploadRemove = z.object({
	type: z.literal('upload.remove'),
	id: z.string(),
})
let uploadError = z.object({
	type: z.literal('upload.error'),
})
let uploadClose = z.object({
	type: z.literal('upload.close'),
})
let uploadOpen = z.object({
	type: z.literal('upload.open'),
})

export let uploadManagerEvents = z.discriminatedUnion('type', [
	uploadConfig,
	uploadRemove,
	uploadError,
	uploadClose,
	uploadOpen,
	uploadSpawn,
	uploadAborted,
	uploadActive,
	uploadProgressChange,
	uploadStart,
	uploadAdd,
	uploadQueuesPendingAdd,
	uploadDone,
	uploadAbort,
])

export let fileMachineContext = z.object({
	bucketName: z.string(),
	ownerId: z.string().optional(),
	user: user,
	mediaFile: mediafile,
	error: z.instanceof(Error).optional(),
	parentRef: z.custom<AnyActorRef>().optional(),
	uploadRef: z.custom<AnyActorRef>().optional(),
})

export let mediafileMachineInput = z.object({
	bucketName: z.string(),
	ownerId: z.string().optional(),
	mediaFile: mediafile,
	user:user,
	parentRef: z.custom<AnyActorRef>(),
})

let mediafileRemove = z.object({
	type: z.literal('remove'),
})
let mediafileAbort = z.object({
	type: z.literal('abort'),
})
let mediafileAborted = z.object({
	type: z.literal('aborted'),
})
let mediafileStart = z.object({
	type: z.literal('start'),
})
let mediafileInit = z.object({
	type: z.literal('init'),
	file: z.instanceof(File),
})
let mediafileUpload = z.object({
	type: z.literal('upload'),
	file: z.instanceof(File),
})
let mediafileDone = z.object({
	type: z.literal('done'),
	etag: z.string(),
	version: z.string(),
})
let mediafileProgress = z.object({
	type: z.literal('progress'),
	progress: z.number(),
	uploadSpeedMbps: z.number(),
	timeLeft: timeLeft,
	runTime: z.number().default(0),
})

export let mediafileEvents = z.discriminatedUnion('type', [
	mediafileRemove,
	mediafileAbort,
	mediafileAborted,
	mediafileStart,
	mediafileInit,
	mediafileUpload,
	mediafileDone,
	mediafileProgress,
])
