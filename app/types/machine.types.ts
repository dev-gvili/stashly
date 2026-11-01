import { z } from 'zod'
import {
  config,
  fileMachineContext,
  mediafile,
  mediafileUploadInfo,
  uiConfig,
  uploadManagerSchema,
  uploadManagerEvents,
  mediafileEvents,
  mediafileMachineInput,
  user,
  uploadProgress,
  multipartEvents,
  output,
  multipartContext,
  multipartPart,
  multipartParts,
  multipartInput,
  quotaContext,
  quotaEvents,
  quotaOutput,
  dbContext,
  dbEvents,
  dbOutcomeEvents,
  dbItemPayload,
  dbHashInput,
  dbHashOutput,
  dbResponse,
  subscriptionEvents,
  subscriptionOutput,
  pipelineEvents,
  pipelineContextSchema,
  type subscriptionInput,
  type subscriptionContext,
  type uploadFile,
  type status,
  type authSession,
  type authSchema,
  type processingStatus,
} from '@/schemas/machine.schemas'

// ====================================================== //
// ==================== Shared Types ==================== //
// ====================================================== //

export type User = z.infer<typeof user>
export type Session = z.infer<typeof authSession>
export type AuthSchema = z.infer<typeof authSchema>
export type Config = z.infer<typeof config>
export type UIConfig = z.infer<typeof uiConfig>
export type UploadProgress = z.infer<typeof uploadProgress>
export type Status = z.infer<typeof status>

// ====================================================== //
// =============== MediaFile Machine Types ============== //
// ====================================================== //

export type MediaFileInput = z.infer<typeof mediafileMachineInput>
export type MediaFileEvents = z.infer<typeof mediafileEvents>
export type MediaFileData = z.infer<typeof fileMachineContext>
export type MediaFileStatus = z.infer<typeof status>
export type MediaFileUploadInfo = z.infer<typeof mediafileUploadInfo>
export type MediaFile = z.infer<typeof mediafile>
export type ProcessingStatus = z.infer<typeof processingStatus>

// ====================================================== //
// ================ Upload Machine Types ================ //
// ====================================================== //

export type UploadManagerData = z.infer<typeof uploadManagerSchema>
export type UploadManagerEvents = z.infer<typeof uploadManagerEvents>
/** What the upload manager emits to listeners (`actor.on`), not events it takes. */
export type UploadManagerEmitted = {
  type: 'items.created'
  /** Listing rows as `/api/items` sent them; `reviveCardItem` restores their types. */
  items: Record<string, unknown>[]
}

// ====================================================== //
// =============== Multipart Machine Types ============== //
// ====================================================== //

export type MultipartEvents = z.infer<typeof multipartEvents>
export type MultipartOutput = z.infer<typeof output>
export type MultipartContext = z.infer<typeof multipartContext>
export type MultipartPart = z.infer<typeof multipartPart>
export type MultipartParts = z.infer<typeof multipartParts>
export type MultipartInput = z.infer<typeof multipartInput>
export type UploadFile = z.infer<typeof uploadFile>

// ====================================================== //
// ================= Quota Machine Types ================ //
// ====================================================== //

export type QuotaEvents = z.infer<typeof quotaEvents>
export type QuotaContext = z.infer<typeof quotaContext>
export type QuotaOutput = z.infer<typeof quotaOutput>

// ====================================================== //
// ================== DB Machine Types ================== //
// ====================================================== //

export type DbEvents = z.infer<typeof dbEvents>
/** Only the ways a run can end — what `toOutcome` is allowed to return. */
export type DbOutcomeEvents = z.infer<typeof dbOutcomeEvents>
export type DbContext = z.infer<typeof dbContext>
export type DbResponse = z.infer<typeof dbResponse>
/** The argument `createUploadedItem` takes — see `createUploadItemFields`. */
export type DbItemPayload = z.infer<typeof dbItemPayload>
export type DbHashInput = z.infer<typeof dbHashInput>
export type DbHashOutput = z.infer<typeof dbHashOutput>

// ====================================================== //
// ================ OnBoard Machine Types =============== //
// ====================================================== //

// export type OnBoardEvents = z.infer<typeof onBoardEvents>
// export type OnBoardContext = z.infer<typeof onBoardContext>
// export type OnBoardOutput = z.infer<typeof onBoardOutput>
// export type OnBoardInput = z.infer<typeof onBoardInput>

// ====================================================== //
// ================= Queue Machine Types ================ //
// ====================================================== //

// ====================================================== //
// ============= Subscription Machine Types ============= //
// ====================================================== //

export type SubscriptionEvents = z.infer<typeof subscriptionEvents>
export type SubscriptionContext = z.infer<typeof subscriptionContext>
export type SubscriptionOutput = z.infer<typeof subscriptionOutput>
export type SubscriptionInput = z.infer<typeof subscriptionInput>

// ====================================================== //
// ============= Stash Pipeline Machine Types =========== //
// ====================================================== //

export type PipelineEvents = z.infer<typeof pipelineEvents>
export type PipelineContext = z.infer<typeof pipelineContextSchema>
export type PipelineState =
  | 'checking_hardware'
  | 'idle'
  | 'detecting_language'
  | 'transcribing'
  | 'ready'
  | 'summarizing'
  | 'correcting_text'
  | 'extracting_keywords'
  | 'generating_tags'
  | 'error'

/** Serializable state snapshot posted from the worker to the main thread on every transition. */
export type WorkerSnapshot = {
  value: string
  context: Omit<PipelineContext, 'pendingAudio' | 'pendingTranscript'>
}

export const initialWorkerSnapshot: WorkerSnapshot = {
  value: 'checking_hardware',
  context: {
    executionProvider: 'unknown',
    gpuInfo: null,
    fileInfo: null,
    modelName: null,
    loadingPhases: [],
    progress: null,
    detectedLanguage: null,
    audioDuration: 0,
    transcriptProgress: null,
    transcript: '',
    correctedTranscript: '',
    summary: '',
    keywords: [],
    generatedTags: [],
    error: null,
  },
}

// ====================================================== //
// ============= Thumbnail Pipeline Types =============== //
// ====================================================== //

/** 0=color placeholder, 1=tiny blurhash, 2=full resize, 3=smart crop */
export type ThumbnailStage = 0 | 1 | 2 | 3
