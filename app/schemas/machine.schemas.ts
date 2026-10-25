import type { ActorRefFrom, AnyActorRef } from 'xstate'
import { z } from 'zod'
import { fileMachine } from '../machines/reviset/file.machine'
import { itemFilterSchema } from '@/utils/filters/item.filters'
import { createUploadItemFields } from '@/schemas/api.schemas'
import { toSearchSchema } from '@/utils/converters'
import type { Prisma } from '@/prisma/browser'
import type { quotaMachine } from '../machines/quota/quota.machine'

const UPLOAD = 'upload'
const QUEUE = 'queue'
const PROGRESS = 'progress'
const MULTIPART = '@multipart'
const QUOTA = '@quota'
const DB = '@db'
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
  'itemCreated',
  // The bytes reached S3 but the row was never written. Distinct from `done`,
  // which used to absorb this case: the upload panel reported "done" for a
  // file that does not exist, and `upload-thumbnail-runner` treated it as
  // eligible and fired the thumbnail pipeline at a missing `Item`.
  'itemFailed',
  // The upload itself never finished: the quota check, creating the multipart
  // upload or completing it was refused (e.g. folder access revoked). No bytes
  // stay in S3. Not `itemFailed`, which means the bytes are there.
  'failed',
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
  uploadId: z.string().optional(),
  location: z.url().optional(),
  ownerId: z.string().optional(),
  /** The file's folder, when its upload resolved its folders first (`addBatch`). */
  parentId: z.string().optional(),
  progress: uploadProgress,
  status: status,
  thumbnail: z.string().optional(),
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
    maxConcurrentUploads: z.number().default(100).optional(),
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
  isVisible: z.boolean().default(false),
  dismissed: z.set(z.string()).default(new Set()),
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
// Sent by a file machine that reached `error`, so the manager frees its slot.
// Without it the file stayed in `queues.active` for good, and once
// `maxConcurrentUploads` files had failed no other file could start.
let uploadFailed = z.object({
  type: z.literal(`${UPLOAD}.failed`),
  mediaFile: mediafile,
  error: z.string(),
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

let uploadOpenView = z.object({
  type: z.literal(`${UPLOAD}.view.toggle`),
})

let uploadDismiss = z.object({
  type: z.literal(`${UPLOAD}.dismiss`),
  mediaFileId: z.string(),
})

let uploadCreateItemSuccess = z.object({
  type: z.literal(`${UPLOAD}.createItem.success`),
  mediaFileId: z.string(),
})

let uploadCreateItemError = z.object({
  type: z.literal(`${UPLOAD}.createItem.error`),
  mediaFileId: z.string(),
  error: z.string(),
})

let uploadThumbnail = z.object({
  type: z.literal(`${UPLOAD}.thumbnail`),
  mediaFileId: z.string(),
  thumbnail: z.string(),
})

export let uploadManagerEvents = z.discriminatedUnion('type', [
  uploadConfig,
  uploadRemove,
  uploadError,
  uploadClose,
  uploadOpen,
  uploadSpawn,
  uploadAborted,
  uploadFailed,
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
  uploadOpenView,
  uploadDismiss,
  uploadCreateItemError,
  uploadThumbnail,
  uploadCreateItemSuccess,
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

export let quotaEvents = z.discriminatedUnion('type', [
  quotaFindEvent,
  quotaCheckEvent,
  quotaVerifyEvent,
])

export let quotaContext = z.object({
  quota,
  replayTo: z.custom<AnyActorRef>().optional(),
  error: z.string().optional(),
})

export let quotaOutput = z.object({ quota })

// ====================================================== //
// ========================= DB ========================= //
// ====================================================== //

/**
 * What the machine is asked to write. `mediaFile` and `user` are the whole
 * subject of a run — everything else it needs is derived from them.
 */
let dbItemCreateEvent = z.object({
  type: z.literal(`${DB}.item.create`),
  mediaFile: mediafile,
  user: user,
})

/**
 * The built, validated payload on its way to the request. It travels as an
 * event so it lives for exactly one transition — there is no reason for a
 * body that is about to be sent to sit in context.
 */
let dbItemPostEvent = z.object({
  type: z.literal(`${DB}.item.post`),
  payload: createUploadItemFields,
})

/**
 * How a run ends. These are events rather than a stored `outcome` field: the
 * step that learns the verdict raises one in the same tick, and the machine's
 * root handler routes it to its state. Nothing has to be remembered in
 * between, and no path throws — an unhandled rejection in a spawned actor
 * stops its parent, which is what took the upload manager down.
 */
let dbItemCreated = z.object({
  type: z.literal(`${DB}.item.created`),
  mediaFileId: z.string(),
})

/** 2xx JSON that reports `success: false` — the server declined the write. */
let dbItemRefused = z.object({
  type: z.literal(`${DB}.item.refused`),
  mediaFileId: z.string(),
  error: z.string(),
})

/** A non-2xx status. */
let dbItemRejected = z.object({
  type: z.literal(`${DB}.item.rejected`),
  mediaFileId: z.string(),
  error: z.string(),
})

/** The request was answered by the sign-in page instead of the API. */
let dbSessionExpired = z.object({
  type: z.literal(`${DB}.session.expired`),
  mediaFileId: z.string(),
  error: z.string(),
})

/** The hash, the network or the body could not be handled. */
let dbItemFailed = z.object({
  type: z.literal(`${DB}.item.failed`),
  mediaFileId: z.string(),
  error: z.string(),
})

const dbOutcomeMembers = [
  dbItemCreated,
  dbItemRefused,
  dbItemRejected,
  dbSessionExpired,
  dbItemFailed,
] as const

/** Only the endings, so a helper that decides one cannot return anything else. */
export let dbOutcomeEvents = z.discriminatedUnion('type', dbOutcomeMembers)

export let dbEvents = z.discriminatedUnion('type', [
  dbItemCreateEvent,
  dbItemPostEvent,
  ...dbOutcomeMembers,
])

/** The payload the API takes, and therefore what `postItem` sends. */
export let dbItemPayload = createUploadItemFields

export let dbHashInput = z.object({ mediaFileId: z.string() })
export let dbHashOutput = z.object({ hash: z.string().optional() })

/**
 * A response flattened to plain data, body included. The body is read as text
 * up front rather than parsed as JSON, so an HTML sign-in page is a value to
 * classify instead of a `SyntaxError` thrown from inside `res.json()`.
 */
export let dbResponse = z.object({
  status: z.number(),
  ok: z.boolean(),
  redirected: z.boolean(),
  url: z.string(),
  contentType: z.string(),
  body: z.string(),
})

/**
 * Only the subject of the run and who to answer. The payload, the response and
 * the verdict each live for one transition and travel on the event that
 * carries them, so none of them is stored here.
 */
export let dbContext = z.object({
  replayTo: z.custom<AnyActorRef>().optional(),
  mediaFile: mediafile.optional(),
  user: user.optional(),
})

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

/**
 * The item search schema these machine inputs page over: `itemFilterSchema`
 * widened with cursor/take plus a typed `orderBy`/`include`. The four keys used
 * to be hand-written into `itemFilterSchema` itself; they are query shape, not
 * `where` shape, so they live here now.
 */
const itemSearchSchema = toSearchSchema<
  typeof itemFilterSchema,
  Prisma.ItemOrderByWithRelationInput,
  Prisma.ItemInclude
>({ schema: itemFilterSchema })

export let paginationCursorInput = z
  .object({
    strategy: z.literal('cursor'),
  })
  .extend(itemSearchSchema.shape)

export let paginationOffsetInput = z
  .object({
    strategy: z.literal('offset'),
    page: z.number(),
    skip: z.number(),
    include: itemSearchSchema.shape.include,
    orderBy: itemSearchSchema.shape.orderBy.default({ name: 'asc' }),
  })
  .extend(itemSearchSchema.omit({ cursor: true }).shape)

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
    strategy: z.literal('cursor'),
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
