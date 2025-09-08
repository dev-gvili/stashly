import type { ActorRefFrom, AnyActorRef } from 'xstate'
import { z } from 'zod'
import { fileMachine } from './file.machine'
import {
	StoragePlanType,
	SubscriptionEventType,
	SubscriptionStatus,
	SubscriptionType,
} from '../.server/prisma/enums'
import { Prisma } from '../.server/prisma/client'

export const uploadProgress = z.object({
	percentage: z.number(),
	timeLeft: z.object({
		hours: z.number(),
		minutes: z.number(),
		seconds: z.number(),
	}),
	speed: z.object({
		value: z.number(),
		unit: z.literal('KB/s').or(z.literal('MB/s')),
	}),
})

export const user = z.object({
	bucket: z.string(),
	createdAt: z.date(),
	driveId: z.string(),
	email: z.string(),
	emailVerified: z.boolean(),
	id: z.string(),
	image: z.string().nullish(),
	name: z.string(),
	storagePlanId: z.string(),
	subscriptionId: z.string(),
	updatedAt: z.date(),
})

export const mediaFileStatus = z.enum([
	'aborted',
	'done',
	'uploading',
	'paused',
	'skipped',
	'pending',
])
export let mediafileUploadInfo = z.object({
	'x-amz-version-id': z.string(),
	'x-amz-request-id': z.string(),
	Etag: z.string().transform((value) => value.replaceAll('"', '')),
})

export let mediafile = z.object({
	id: z.string(),
	ownerId: z.string().optional(),
	file: z.instanceof(File),
	progress: uploadProgress,
	status: mediaFileStatus,
	url: z.string(),
	etag: z.string().optional(),
	version: mediafileUploadInfo.shape['x-amz-version-id'].optional(),
	error: z.string().optional(),
})

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
	fileActors: z.map(z.string(), z.custom<ActorRefFrom<typeof fileMachine>>()),
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
	mediaFileId: z.string(),
})
let uploadDone = z.object({
	type: z.literal('upload.done'),
	mediaFileId: z.string(),
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
	mediaFileId: z.string(),
})
let uploadAborted = z.object({
	type: z.literal('upload.aborted'),
	mediaFile: mediafile,
})
let uploadStarted = z.object({
	type: z.literal('upload.started'),
	mediaFileId: z.string(),
})
let uploadProgressChange = z.object({
	type: z.literal('progress.change'),
	mediaFileId: z.string(),
	progress: uploadProgress,
})
let uploadConfig = z.object({
	type: z.literal('upload.config'),
	config: config.partial(),
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
let requestAbortFromParent = z.object({
	type: z.literal('queue.request.abort'),
	mediaFileId: z.string(),
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
	uploadStarted,
	requestAbortFromParent,
])

export let fileMachineContext = z.object({
	bucketName: z.string(),
	ownerId: z.string().optional(),
	user: user,
	mediaFile: mediafile,
	uploadId: z.string(),
	error: z.instanceof(Error).optional(),
	parentRef: z.custom<AnyActorRef>().optional(),
	uploadRef: z.custom<AnyActorRef>().optional(),
})

export let mediafileMachineInput = z.object({
	bucketName: z.string(),
	ownerId: z.string().optional(),
	mediaFile: mediafile,
	user: user,
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
	parts: z.array(z.object({ ETag: z.string(), PartNumber: z.number() })),
})
let mediafileProgress = z.object({
	type: z.literal('progress'),
	progress: uploadProgress,
})
let mediaFileUploadCompleted = z.object({
	type: z.literal('completed'),
	etag: z.string(),
	versionId: z.string(),
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
	mediaFileUploadCompleted,
])

// ====================================================== //
// ====================== Multipart ===================== //
// ====================================================== //

export let multipartInput = z.object({
	file: z.instanceof(File),
})

export let multipartPart = z.object({
	ETag: z.string(),
	PartNumber: z.number(),
})

export let multipartParts = z.array(multipartPart)

export let output = z.object({
	etag: z.string(),
	version: z.string().optional(),
})

let multipartProgressChange = z.object({
	type: z.literal('@multipart.upload.progress.change'),
	progress: uploadProgress,
})

let multipartUploadError = z.object({
	type: z.literal('@multipart.upload.error'),
	error: z.string(),
})

let multipartUploadAbort = z.object({
	type: z.literal('@multipart.upload.abort'),
})

let multipartUploadDone = z.object({
	type: z.literal('@multipart.upload.done'),
	parts: multipartParts,
})

export let multipartContext = z.object({
	file: z.instanceof(File),
	key: z.string(),
	error: z.string(),
	uploadId: z.string(),
	uploadedParts: multipartParts,
	uploadProgress: uploadProgress,
	uploadCompleteData: output,
})

export let multipartEvents = z.discriminatedUnion('type', [
	multipartProgressChange,
	multipartUploadAbort,
	multipartUploadDone,
	multipartUploadError,
])

// ====================================================== //
// ======================== Quota ======================= //
// ====================================================== //

let quotaState = z
	.literal('normal')
	.or(z.literal('warning'))
	.or(z.literal('critical'))
	.or(z.literal('exceeded'))

export let quota = z.object({
	id: z.string(),
	driveId: z.string(),
	deleted: z.coerce.bigint(),
	total: z.coerce.bigint(),
	used: z.coerce.bigint(),
	remaining: z.coerce.bigint(),
	state: quotaState,
})

let quotaFindEvent = z.object({
	type: z.literal('@quota.find'),
	userId: z.string(),
})

let quotaCheckEvent = z.object({
	type: z.literal('@quota.check'),
	userId: z.string(),
	dataSize: z.bigint(),
})

let quotaUpdateEvent = z.object({
	type: z.literal('@quota.update'),
	action: z.string(),
	userId: z.string(),
	dataSize: z.bigint(),
})

export let quotaEvents = z.discriminatedUnion('type', [
	quotaFindEvent,
	quotaCheckEvent,
	quotaUpdateEvent,
])

export let quotaContext = z.object({
	quota,
	error: z.instanceof(Error).optional(),
})

export let quotaOutput = z.object({ quota })

// ====================================================== //
// ==================== Subscription ==================== //
// ====================================================== //

let subscriptionEventType = z.nativeEnum(SubscriptionEventType)
let storagePlanType = z.nativeEnum(StoragePlanType).default('free')
let subscriptionStatus = z.nativeEnum(SubscriptionStatus).default('active')
let subscriptionType = z.nativeEnum(SubscriptionType).default('free')

let baseSubscriptionHistory = z.object({
	id: z.string().uuid(),
	subscriptionId: z.string().uuid(),
	changeType: subscriptionEventType,
	newPlan: storagePlanType.nullable(),
	previousPlan: storagePlanType.nullable(),
	createdAt: z.date(),
})

let baseSubscription = z.object({
	id: z.string().uuid(),
	userId: z.string().uuid(),
	storagePlanId: z.string().uuid().optional(),
	stripeCustomerId: z.string().uuid().optional(),
	type: subscriptionType,
	status: subscriptionStatus,
	storagePlanType: storagePlanType,
	isCurrent: z.boolean().default(true),
	startDate: z.date(),
	createdAt: z.date(),
	updatedAt: z.date(),
	endDate: z.date().optional(),
	metadata: z.string().optional(),
})

// StoragePlan full schema including relations
let storagePlan = z.object({
	id: z.string().uuid(),
	type: storagePlanType,
	storageLimit: z.coerce.bigint(),
	subscriptions: z.array(baseSubscription).optional(),
})

// Subscription full schema including relations
let subscription = baseSubscription.extend({
	storagePlan: storagePlan.nullable(),
})

let subscriptionFindEvent = z.object({
	type: z.literal('@subscription.find'),
	userId: z.string(),
})
let subscriptionCreateEvent = z.object({
	type: z.literal('@subscription.create'),
	userId: z.string(),
	storagePlanType: storagePlanType,
	subscriptionType: subscriptionType,
})

let subscriptionUpdateEvent = z.object({
	type: z.literal('@subscription.update'),
	subscription: baseSubscription.partial(),
	userId: z.string(),
})

let subscriptionCancelEvent = z.object({
	type: z.literal('@subscription.cancel'),
	userId: z.string(),
})

let subscriptionRetryEvent = z.object({
	type: z.literal('@subscription.retry'),
})

export let subscriptionEvents = z.discriminatedUnion('type', [
	subscriptionCreateEvent,
	subscriptionFindEvent,
	subscriptionUpdateEvent,
	subscriptionCancelEvent,
	subscriptionRetryEvent,
])

export let subscriptionContext = z.object({
	subscription: subscription,
	error: z.string().nullable(),
	userId: z.string(),
})

export let subscriptionInput = z.object({ userId: z.string() })

export let subscriptionOutput = z.object({ subscription })
