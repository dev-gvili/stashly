import type { ActorRefFrom, AnyActorRef } from 'xstate'
import { z } from 'zod'
import { fileMachine } from '../machines/reviset/file.machine'
import { itemFilterSchema } from '@/utils/filters/item.filters'
import type { quotaMachine } from '../machines/quota/quota.machine'

const UPLOAD = 'upload'
const QUEUE = 'queue'
const PROGRESS = 'progress'
const MULTIPART = '@multipart'
const QUOTA = '@quota'
const SUBSCRIPTION = '@subscription'

// ====================================================== //
// ===================== Event Utils ==================== //
// ====================================================== //

/**
 * Creates a Zod literal schema for a given event identifier string.
 *
 * @param eventId The event identifier string.
 * @returns A Zod literal schema for the event identifier.
 */
const createEventIdentifierSchema = <TEventId extends string>(
  eventId: TEventId
) => z.literal(eventId)

/**
 * Constructs a standardized, dot-separated event identifier string for XState machines.
 * This function builds a string by joining the provided parts with dots,
 * automatically filtering out any optional parts that are not provided.
 * The returned string will always be prefixed with `@`.
 *
 * @example
 * const eventId = buildEventIdentifier({
 *   machine: 'upload',
 *   category: 'queues',
 *   entity: 'pending',
 *   action: 'add'
 * });
 * // eventId: "@upload.queues.pending.add"
 *
 * @param parts An object containing the components of the event name.
 * @returns The event identifier string (e.g., "@machine.category.entity.action").
 */
const buildEventIdentifier = <
  TPrefix extends string = 'stashly',
  TMachine extends string = '',
  TCategory extends string = '',
  TEntity extends string = '',
  TAction extends string = '',
>({
  prefix,
  machine,
  category,
  entity,
  action,
}: {
  prefix?: TPrefix
  machine: TMachine
  category?: TCategory
  entity?: TEntity
  action: TAction
}) => {
  const parts = [prefix, machine, category, entity, action]
    .filter(Boolean)
    .join('.') as `@${TPrefix}.${TMachine}.${TCategory}.${TEntity}.${TAction}`

  return createEventIdentifierSchema(parts) as z.ZodLiteral<typeof parts>
}

// ====================================================== //
// ================== Shared Schema ===================== //
// ====================================================== //

const id = z
  .string()
  .regex(
    /^(?:acc|ia|aa|ca|cra|dela|ea|mva|cpa|rna|rsa|sha|va|act|at|aud|coll|ci|cmt|drv|file|fld|img|vid|ado|pht|fav|inv|item|li|meta|ntf|perm|qot|srch|sess|sl|sp|sub|tag|thumb|trsh|ti|usr|ver|iv|ws|wm|prv|fs|view)_[A-Za-z0-9_-]{22}$/
  )
const createdAt = z.date()
const updatedAt = z.date()
const file = z.file()
const timeLeft = z.object({
  hours: z.number(),
  minutes: z.number(),
  seconds: z.number(),
})
const speed = z.object({
  value: z.number(),
  unit: z.literal('KB/s').or(z.literal('MB/s')),
})

/**
 * Zod schema to validate S3 presigned URLs.
 * Ensures the URL uses HTTPS and contains required AWS SigV4 query parameters.
 *
 * Parameters validated include:
 * - X-Amz-Algorithm
 * - X-Amz-Credential
 * - X-Amz-Date
 * - X-Amz-Expires
 * - X-Amz-SignedHeaders
 * - X-Amz-Signature
 *
 * These parameters are essential for AWS to authenticate and authorize access to the S3 resource.
 * @example
 * ```ts
 * const validUrl = "https://my-bucket.s3.amazonaws.com/my-object?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAIOSFODNN7EXAMPLE%2F20231101%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20231101T000000Z&X-Amz-Expires=3600&X-Amz-SignedHeaders=host&X-Amz-Signature=EXAMPLESIGNATURE1234567890abcdef";
 * presignedUrl.parse(validUrl); // No error, valid presigned URL
 * ```
 */
export const presignedUrl = z
  .url({
    protocol: /^https$/,
    // hostname: /^[a-z0-9-]+\.fly\.storage\.tigris\.dev$/i,
  })
  .refine(
    (urlString) => {
      // General JS URL parsing
      const url = new URL(urlString)

      // Must have the standard SigV4 presign params
      const required = [
        'X-Amz-Algorithm',
        'X-Amz-Credential',
        'X-Amz-Date',
        'X-Amz-Expires',
        'X-Amz-SignedHeaders',
        'X-Amz-Signature',
      ] as const

      if (!required.every((k) => url.searchParams.has(k))) return false

      // Optional: lock algorithm (matches your example)
      const algorithm = url.searchParams.get('X-Amz-Algorithm')
      if (algorithm !== 'AWS4-HMAC-SHA256') return false // must match

      // Optional: basic sanity checks
      const expires = url.searchParams.get('X-Amz-Expires')
      if (!expires || !/^\d+$/.test(expires)) return false // positive integer

      const credential = url.searchParams.get('X-Amz-Credential')
      if (!credential) return false // ensure it's present

      const amzDate = url.searchParams.get('X-Amz-Date')
      if (!amzDate || !/^\d{8}T\d{6}Z$/.test(amzDate)) return false // YYYYMMDD'T'HHMMSS'Z'

      const sig = url.searchParams.get('X-Amz-Signature')
      if (!sig || !/^[0-9a-f]{64}$/i.test(sig)) return false // 64 hex chars

      return true
    },
    { error: 'Not a valid S3 presigned URL' }
  )
export const status = z.enum([
  'aborted',
  'done',
  'uploading',
  'paused',
  'skipped',
  'pending',
  'validating',
  'queued',
])

const storagePlanType = z.enum([
  'free',
  'basic',
  'standard',
  'premium',
  'custom',
])

const subscriptionStatus = z.enum([
  'active',
  'canceled',
  'incomplete',
  'incomplete_expired',
  'past_due',
  'trialing',
])

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

export const authSession = z.object({
  id: id,
  createdAt: z.date(),
  updatedAt: z.date(),
  userId: z.string(),
  rootId: z.string(),
  driveId: z.string(),
  expiresAt: z.date(),
  token: z.string(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
})
export const user = z.object({
  id: z.string().nonempty(),
  createdAt: z.date(),
  updatedAt: z.date(),
  email: z.email().nonoptional(),
  emailVerified: z.boolean(),
  name: z.string(),
  image: z.url().nullish(),
  bucket: z.string(),
  subscriptionId: z.string(),
  storagePlanId: z.string(),
  driveId: z.string(),
  rootId: z.string(),
  role: z.string().nullish(),
})

export const authSchema = z.object({
  data: z.object({
    session: authSession,
    user: user,
  }),
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

export let processingStatus = z.enum([
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
])

export let mediafile = z.object({
  error: z.string().optional(),
  etag: z.string().optional(),
  file: z.file(),
  id: z.string(),
  key: z.string(),
  location: z.url().optional(),
  ownerId: z.string().optional(),
  progress: uploadProgress,
  status: status,
  processingStatus: processingStatus.optional(),
  processingError: z.string().optional(),
  // AI model outputs
  caption: z.string().optional(),
  transcription: z.string().optional(),
  summary: z.string().optional(),
  embedding: z.array(z.number()).optional(),
})

export let uiConfig = z.object({
  displayDuration: z.boolean().default(false),
  displayCount: z.boolean().default(false),
})

export let config = z
  .object({
    user: user,
    maxFileSize: z.number().default(10000000000).optional(),
    maxConcurrentUploads: z.number().default(5).optional(),
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
  quotaActor: z.custom<ActorRefFrom<typeof quotaMachine>>().optional(),
  fileActors: z.map(z.string(), z.custom<ActorRefFrom<typeof fileMachine>>()),
  error: z.string().optional(),
})

// ====================================================== //
// Upload Manager Events                                  //
// ====================================================== //
let uploadQueuesPendingAdd = z.object({
  type: z.literal(`upload.queues.pending.add`),
  mediaFile: mediafile,
})
let uploadAdd = z.object({
  type: z.literal(`${UPLOAD}.add`),
  mediaFile: mediafile,
  skipQuotaCheck: z.boolean().optional(),
})
let uploadSpawn = z.object({
  type: z.literal(`${UPLOAD}.spawn`),
  mediaFile: mediafile,
  skipQuotaCheck: z.boolean().optional(),
})
let uploadDone = z.object({
  type: z.literal(`${UPLOAD}.done`),
  mediaFile: mediafile,
})
let uploadActive = z.object({
  type: z.literal(`${UPLOAD}.active`),
  mediaFile: mediafile,
})
let uploadStart = z.object({
  type: z.literal(`${UPLOAD}.start`),
  mediaFile: mediafile,
})
let uploadAbort = z.object({
  type: z.literal(`${UPLOAD}.abort`),
  mediaFileId: z.string(),
})
let uploadAborted = z.object({
  type: z.literal(`${UPLOAD}.aborted`),
  mediaFile: mediafile,
})
let uploadStarted = z.object({
  type: z.literal(`${UPLOAD}.started`),
  mediaFileId: z.string(),
})
let uploadProgressChange = z.object({
  type: z.literal(`${PROGRESS}.change`),
  mediaFileId: z.string(),
  progress: uploadProgress,
})
let uploadConfig = z.object({
  type: z.literal(`${UPLOAD}.config`),
  config: config.partial(),
})
let uploadRemove = z.object({
  type: z.literal(`${UPLOAD}.remove`),
  id: z.string(),
})
let uploadError = z.object({
  type: z.literal(`${UPLOAD}.error`),
})
let uploadClose = z.object({
  type: z.literal(`${UPLOAD}.close`),
})
let uploadOpen = z.object({
  type: z.literal(`${UPLOAD}.open`),
})
let requestAbortFromParent = z.object({
  type: z.literal(`${QUEUE}.request.abort`),
  mediaFile: mediafile,
})

let uploadPause = z.object({
  type: z.literal(`${UPLOAD}.pause`),
  mediaFileId: z.string(),
})

let uploadResume = z.object({
  type: z.literal(`${UPLOAD}.resume`),
  mediaFileId: z.string(),
})

let uploadPaused = z.object({
  type: z.literal(`${UPLOAD}.paused`),
  mediaFile: mediafile,
})

let uploadResumed = z.object({
  type: z.literal(`${UPLOAD}.resumed`),
  mediaFile: mediafile,
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
  uploadPause,
  uploadResume,
  uploadPaused,
  uploadResumed,
])

export let fileMachineContext = z.object({
  user: user,
  mediaFile: mediafile,
  presignedUrl: z.url().optional(),
  uploadId: z.string(),
  error: z.string(),
  manager: z.custom<AnyActorRef>().optional(), // actor reference to the upload manager (parent) (e.g., uploadManagerMachine)
  quota: z.custom<AnyActorRef>().optional(), // actor to handle quota related operations (e.g., quotaMachine)
  worker: z.custom<AnyActorRef>().optional(), // actor representing the processing worker (e.g., Web Worker)
  skipQuotaCheck: z.boolean().optional(), // when true, skip per-file quota check (used for batch/folder uploads)
})

export let mediafileMachineInput = z.object({
  user,
  mediaFile: mediafile,
  manager: z.custom<AnyActorRef>(),
  skipQuotaCheck: z.boolean().optional(),
})

let mediafileRemove = z.object({
  type: z.literal('remove'),
})
let mediafileAbort = z.object({
  type: z.literal('abort'),
})
let mediafileAborted = z.object({
  type: z.literal('@multipart.upload.aborted'),
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
  type: z.literal('@multipart.upload.done'),
  parts: z.array(z.object({ ETag: z.string(), PartNumber: z.number() })),
})
let mediafileProgress = z.object({
  type: z.literal('@multipart.upload.progress'),
  progress: uploadProgress,
})
let mediaFileUploadCompleted = z.object({
  type: z.literal('completed'),
  etag: z.string(),
  versionId: z.string(),
})
let imageProcessingCompleted = z.object({
  type: z.literal('PROCESSING.DONE'),
  caption: z.string(),
  embedding: z.array(z.number()),
})
let imageProcessingFailed = z.object({
  type: z.literal('PROCESSING.FAILED'),
  error: z.string(),
})
let imageProcessingAbort = z.object({
  type: z.literal('PROCESSING.ABORT'),
})

let mediafilePause = z.object({
  type: z.literal('pause'),
})

let mediafileResume = z.object({
  type: z.literal('resume'),
})

let mediafilePaused = z.object({
  type: z.literal('@multipart.upload.paused'),
})

let mediafileResumed = z.object({
  type: z.literal('@multipart.upload.resumed'),
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
  imageProcessingCompleted,
  imageProcessingFailed,
  imageProcessingAbort,
  mediafilePause,
  mediafileResume,
  mediafilePaused,  
  mediafileResumed,
])

// ====================================================== //
// ====================== Multipart ===================== //
// ====================================================== //

export let uploadFile = z.object({
  id,
  file,
  key: z.string(),
})

export let multipartInput = uploadFile

export let multipartPart = z.object({
  ETag: z.string(),
  PartNumber: z.number(),
})

export let multipartParts = z.array(multipartPart)

export let multipartUpload = z.object({
  id,
  file,
  key: z.string(),
  uploadId: z.string().nonempty(),
})

export let output = z.object({
  etag: z.string(),
  version: z.string().optional(),
})

let multipartUploadProgress = z.object({
  type: z.literal(`@multipart.upload.progress`),
  progress: uploadProgress,
})

let multipartUploadError = z.object({
  type: z.literal(`@multipart.upload.error`),
  error: z.string(),
})

let multipartUploadAbort = z.object({
  type: z.literal(`@multipart.upload.abort`),
})

let multipartUploadAborted = z.object({
  type: z.literal(`@multipart.upload.aborted`),
})

let multipartUploadDone = z.object({
  type: z.literal(`@multipart.upload.done`),
  parts: multipartParts,
})
let multipartUploadCreate = z.object({
  type: z.literal(`@multipart.upload.create`),
  uploadId: z.string(),
})

let multipartUploadPause = z.object({
  type: z.literal(`@multipart.upload.pause`),
})

let multipartUploadResume = z.object({
  type: z.literal(`@multipart.upload.resume`),
})

export let multipartContext = z
  .object({
    error: z.string(),
    uploadId: z.string(),
    parts: multipartParts,
    progress: uploadProgress,
    output: output,
  })
  .safeExtend(uploadFile.shape)

export let multipartEvents = z.discriminatedUnion('type', [
  multipartUploadProgress,
  multipartUploadAbort,
  multipartUploadAborted,
  multipartUploadDone,
  multipartUploadError,
  multipartUploadCreate,
  multipartUploadPause,
  multipartUploadResume,
])

// ====================================================== //
// ======================== Quota ======================= //
// ====================================================== //

let quotaStatus = z
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
  status: quotaStatus,
})

let quotaFindEvent = z.object({
  type: z.literal(`${QUOTA}.find`),
  userId: z.string(),
})

let quotaCheckEvent = z.object({
  type: z.literal(`${QUOTA}.check`),
  userId: z.string(),
  itemId: z.string(),
  dataSize: z.bigint(),
})

let quotaVerifyEvent = z.object({
  type: z.literal(`${QUOTA}.verify`),
  userId: z.string(),
  dataSize: z.bigint(),
})

let quotaUpdateEvent = z.object({
  type: z.literal(`${QUOTA}.update`),
  action: z.string(),
  userId: z.string(),
  dataSize: z.bigint(),
})

export let quotaEvents = z.discriminatedUnion('type', [
  quotaFindEvent,
  quotaCheckEvent,
  quotaVerifyEvent,
  quotaUpdateEvent,
])

export let quotaContext = z.object({
  quota,
  replayTo: z.custom<AnyActorRef>().optional(),
  error: z.string().optional(),
})

export let quotaOutput = z.object({ quota })

// ====================================================== //
// ==================== Subscription ==================== //
// ====================================================== //

let baseSubscription = z.object({
  id: z.string(),
  userId: z.string(),
  storagePlanId: z.string().optional(),
  stripeCustomerId: z.string().optional(),
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
  id: z.string(),
  type: storagePlanType,
  storageLimit: z.coerce.bigint(),
  subscriptions: z.array(baseSubscription).optional(),
})

// Subscription full schema including relations
let subscription = baseSubscription.extend({
  storagePlan: storagePlan.nullable(),
})

let subscriptionFindEvent = z.object({
  type: z.literal(`${SUBSCRIPTION}.find`),
  userId: z.string(),
})
let subscriptionCreateEvent = z.object({
  type: z.literal(`${SUBSCRIPTION}.create`),
  userId: z.string(),
  storagePlanType: storagePlanType,
})

let subscriptionUpdateEvent = z.object({
  type: z.literal(`${SUBSCRIPTION}.update`),
  subscription: baseSubscription.partial(),
  userId: z.string(),
})

let subscriptionCancelEvent = z.object({
  type: z.literal(`${SUBSCRIPTION}.cancel`),
  userId: z.string(),
})

let subscriptionRetryEvent = z.object({
  type: z.literal(`${SUBSCRIPTION}.retry`),
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

// ====================================================== //
// ===================== Pagination ===================== //
// ====================================================== //

export let paginationCursorInput = z
  .object({
    strategy: z.literal('cursor'),
    include: itemFilterSchema.shape.include,
    orderBy: itemFilterSchema.shape.orderBy,
  })
  .extend(itemFilterSchema.shape)

export let paginationOffsetInput = z
  .object({
    strategy: z.literal('offset'),
    page: z.number(),
    skip: z.number(),
    include: itemFilterSchema.shape.include,
    orderBy: itemFilterSchema.shape.orderBy.default({ name: 'asc' }),
  })
  .extend(itemFilterSchema.omit({ cursor: true }).shape)

export let paginationInput = z.discriminatedUnion('strategy', [
  paginationCursorInput,
  paginationOffsetInput,
])

export let paginationCursorData = z.object({
  data: z.array(z.unknown()),
  metadata: z.object({
    count: z.number(),
    previousCursor: z.string().optional(),
    nextCursor: z.string().optional(),
    take: z.number(),
    isComplete: z.boolean(),
  }),
})

export let paginationOffsetData = z.object({
  data: z.array(z.unknown()),
  metadata: z.object({
    count: z.number(),
    pages: z.number(),
    page: z.number(),
    take: z.number(),
    isComplete: z.boolean(),
    strategy: z.literal('offset'),
  }),
})

export let paginationData = z.discriminatedUnion('strategy', [
  paginationCursorData,
  paginationOffsetData,
])

// ====================================================== //
// ============= Stash Pipeline Machine ================= //
// ====================================================== //

// Worker-originated events (bridge retypes 'result' by task)
const workerProgress = z.object({
  type: z.literal('WORKER.PROGRESS'),
  data: z.unknown().nullable(),
})
const workerStatus = z.object({
  type: z.literal('WORKER.STATUS'),
  status: z.string(),
})
const workerLanguageDetected = z.object({
  type: z.literal('WORKER.LANGUAGE_DETECTED'),
  language: z.string(),
  confidence: z.number(),
})
const workerAudioDuration = z.object({
  type: z.literal('WORKER.AUDIO_DURATION'),
  seconds: z.number(),
})
const workerPartialResult = z.object({
  type: z.literal('WORKER.PARTIAL_RESULT'),
  task: z.string(),
  payload: z.unknown(),
})
const workerResultTranscription = z.object({
  type: z.literal('WORKER.RESULT.TRANSCRIPTION'),
  text: z.string(),
})
const workerResultSummarization = z.object({
  type: z.literal('WORKER.RESULT.SUMMARIZATION'),
  text: z.string(),
})
const workerResultCorrection = z.object({
  type: z.literal('WORKER.RESULT.CORRECTION'),
  correctedTranscript: z.string(),
})
const workerResultExtractKeywords = z.object({
  type: z.literal('WORKER.RESULT.EXTRACT_KEYWORDS'),
  keywords: z.array(z.string()),
})
const workerResultGenerateTags = z.object({
  type: z.literal('WORKER.RESULT.GENERATE_TAGS'),
  tags: z.array(z.string()),
})
const workerErrorEvent = z.object({
  type: z.literal('WORKER.ERROR'),
  message: z.string(),
})

// Component-sent events
const pipelineAudioUpload = z.object({
  type: z.literal('AUDIO_UPLOAD'),
  audio: z.instanceof(Float32Array),
  sampleRate: z.number(),
  duration: z.number(),
  fileName: z.string(),
  fileType: z.string(),
  fileSize: z.number(),
  contentHint: z.enum(['music', 'speech', 'auto']).optional(),
})
const pipelineSummarize = z.object({ type: z.literal('SUMMARIZE') })
const pipelineExtractKeywords = z.object({
  type: z.literal('EXTRACT_KEYWORDS'),
})
const pipelineGenerateTags = z.object({ type: z.literal('GENERATE_TAGS') })
const pipelineCancel = z.object({ type: z.literal('CANCEL') })
const pipelineReset = z.object({ type: z.literal('RESET') })

export const pipelineEvents = z.discriminatedUnion('type', [
  workerProgress,
  workerStatus,
  workerLanguageDetected,
  workerPartialResult,
  workerResultTranscription,
  workerResultSummarization,
  workerResultCorrection,
  workerResultExtractKeywords,
  workerResultGenerateTags,
  workerErrorEvent,
  pipelineAudioUpload,
  pipelineSummarize,
  pipelineExtractKeywords,
  pipelineGenerateTags,
  pipelineCancel,
  pipelineReset,
])

export const pipelineContextSchema = z.object({
  executionProvider: z.enum(['webgpu', 'wasm', 'unknown']),
  gpuInfo: z.string().nullable(),
  fileInfo: z
    .object({
      name: z.string(),
      type: z.string(),
      size: z.string(),
      duration: z.number(),
    })
    .nullable(),
  pendingAudio: z
    .object({
      audio: z.instanceof(Float32Array),
      sampleRate: z.number(),
      duration: z.number(),
      contentHint: z.enum(['music', 'speech', 'auto']).optional(),
    })
    .nullable(),
  modelName: z.string().nullable(),
  loadingPhases: z.array(z.string()),
  progress: z.record(z.string(), z.number()).nullable(),
  detectedLanguage: z
    .object({ language: z.string(), confidence: z.number() })
    .nullable(),
  audioDuration: z.number(),
  transcriptProgress: z.unknown().nullable(),
  pendingTranscript: z.string().nullable(),
  transcript: z.string(),
  correctedTranscript: z.string(),
  summary: z.string(),
  keywords: z.array(z.string()),
  generatedTags: z.array(z.string()),
  error: z.string().nullable(),
})
