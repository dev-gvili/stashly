/**
 * @file Defines a custom ApiError class and related utilities for consistent API error handling.
 */
import { data } from 'react-router'

/**
 * Enum for application-specific API error codes.
 * This provides a clear, readable way to identify specific error scenarios.
 */
export enum StashlyErrorCode {
  // Add your app-specific error codes here

  // S3-related errors
  DELETE_OBJECT_FAILED = 'DELETE_OBJECT_FAILED',
  RENAME_OBJECT_FAILED = 'RENAME_OBJECT_FAILED',
  COPY_OBJECT_FAILED = 'COPY_OBJECT_FAILED',
  MOVE_OBJECT_FAILED = 'MOVE_OBJECT_FAILED',
  CREATE_BUCKET_FAILED = 'CREATE_BUCKET_FAILED',
  DELETE_BUCKET_FAILED = 'DELETE_BUCKET_FAILED',
  SET_BUCKET_CORS_FAILED = 'SET_BUCKET_CORS_FAILED',
  APPLY_BUCKET_POLICY_FAILED = 'APPLY_BUCKET_POLICY_FAILED',
  ENABLE_BUCKET_VERSIONING_FAILED = 'ENABLE_BUCKET_VERSIONING_FAILED',
  BUCKET_CORS_NOT_FOUND = 'BUCKET_CORS_NOT_FOUND',
  EMPTY_BUCKET_FAILED = 'EMPTY_BUCKET_FAILED',


  // Storage-related errors
  STORAGE_PLAN_NOT_FOUND = 'STORAGE_PLAN_NOT_FOUND',
  CREATE_STORAGE_PLAN_FAILED = 'CREATE_STORAGE_PLAN_FAILED',
  DELETE_STORAGE_PLAN_FAILED = 'DELETE_STORAGE_PLAN_FAILED',
  UPDATE_STORAGE_PLAN_FAILED = 'UPDATE_STORAGE_PLAN_FAILED',

  // Subscription-related errors
  SUBSCRIPTION_NOT_FOUND = 'SUBSCRIPTION_NOT_FOUND',
  CREATE_SUBSCRIPTION_FAILED = 'CREATE_SUBSCRIPTION_FAILED',
  DELETE_SUBSCRIPTION_FAILED = 'DELETE_SUBSCRIPTION_FAILED',
  UPDATE_SUBSCRIPTION_FAILED = 'UPDATE_SUBSCRIPTION_FAILED',
  CANCEL_SUBSCRIPTION_FAILED = 'CANCEL_SUBSCRIPTION_FAILED',

  // Upload-related errors
  CREATE_UPLOAD_FAILED = 'CREATE_UPLOAD_FAILED',
  COMPLETE_UPLOAD_FAILED = 'COMPLETE_UPLOAD_FAILED',
  ABORT_UPLOAD_FAILED = 'ABORT_UPLOAD_FAILED',
  PRESIGNED_URL_FAILED = 'PRESIGNED_URL_FAILED',
  UPLOAD_FAILED = 'UPLOAD_FAILED',
  DOWNLOAD_FAILED = 'DOWNLOAD_FAILED',

  // Collection-related errors
  ADD_ITEM_TO_COLLECTION_FAILED = 'ADD_ITEM_TO_COLLECTION_FAILED',
  ADD_ITEMS_TO_COLLECTION_FAILED = 'ADD_ITEMS_TO_COLLECTION_FAILED',
  REMOVE_ITEM_FROM_COLLECTION_FAILED = 'REMOVE_ITEM_FROM_COLLECTION_FAILED',
  REMOVE_ITEMS_FROM_COLLECTION_FAILED = 'REMOVE_ITEMS_FROM_COLLECTION_FAILED',
  COLLECTION_NOT_FOUND = 'COLLECTION_NOT_FOUND',
  CREATE_COLLECTION_FAILED = 'CREATE_COLLECTION_FAILED',
  TRASH_COLLECTION_FAILED = 'TRASH_COLLECTION_FAILED',
  CLEAR_COLLECTION_FAILED = 'CLEAR_COLLECTION_FAILED',
  RENAME_COLLECTION_FAILED = 'RENAME_COLLECTION_FAILED',
  DELETE_COLLECTION_FAILED = 'DELETE_COLLECTION_FAILED',
  RESTORE_COLLECTION_FAILED = 'RESTORE_COLLECTION_FAILED',

  // Item-related errors
  ITEM_NOT_FOUND = 'ITEM_NOT_FOUND',
  LIST_ITEMS_FAILED = 'LIST_ITEMS_FAILED',
  RENAME_ITEM_FAILED = 'RENAME_ITEM_FAILED',
  CREATE_ITEM_FAILED = 'CREATE_ITEM_FAILED',
  DELETE_ITEM_FAILED = 'DELETE_ITEM_FAILED',
  UPDATE_ITEM_FAILED = 'UPDATE_ITEM_FAILED',
  COPY_ITEM_FAILED = 'COPY_ITEM_FAILED',
  MOVE_ITEM_FAILED = 'MOVE_ITEM_FAILED',

  // Share-related errors
  SHARE_NOT_FOUND = 'SHARE_NOT_FOUND',
  CREATE_SHARE_FAILED = 'CREATE_SHARE_FAILED',
  DELETE_SHARE_FAILED = 'DELETE_SHARE_FAILED',
  UPDATE_SHARE_FAILED = 'UPDATE_SHARE_FAILED',
  SHARE_FAILED = 'SHARE_FAILED',
  LIST_SHARES_FAILED = 'LIST_SHARES_FAILED',

  // Quota-related errors
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  QUOTA_NOT_FOUND = 'QUOTA_NOT_FOUND',
  QUOTA_NOT_DEFINED_FOR_USER = 'QUOTA_NOT_DEFINED_FOR_USER',
  INSUFFICIENT_QUOTA = 'INSUFFICIENT_QUOTA',
  UPDATE_QUOTA_FAILED = 'UPDATE_QUOTA_FAILED',
  CREATE_QUOTA_FAILED = 'CREATE_QUOTA_FAILED',
  DELETE_QUOTA_FAILED = 'DELETE_QUOTA_FAILED',

  // Drive-related errors
  DRIVE_NOT_FOUND = 'DRIVE_NOT_FOUND',
  CREATE_DRIVE_FAILED = 'CREATE_DRIVE_FAILED',
  DELETE_DRIVE_FAILED = 'DELETE_DRIVE_FAILED',
  UPDATE_DRIVE_FAILED = 'UPDATE_DRIVE_FAILED',

  // Lock related errors
  LOCK_FAILED = 'LOCK_FAILED',
  UNLOCK_FAILED = 'UNLOCK_FAILED',
  LOCK_NOT_FOUND = 'LOCK_NOT_FOUND',
  ITEM_LOCKED = 'ITEM_LOCKED',
  ITEM_NOT_LOCKED = 'ITEM_NOT_LOCKED',

  // User-related errors
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  USER_ALREADY_EXISTS = 'USER_ALREADY_EXISTS',
  USER_NOT_AUTHORIZED = 'USER_NOT_AUTHORIZED',

  // AI errors
  AI_MODEL_LOADING_FAILED = 'AI_MODEL_LOADING_FAILED',
  AI_PROCESSING_FAILED = 'AI_PROCESSING_FAILED',
  AI_CAPTION_GENERATION_FAILED = 'AI_CAPTION_GENERATION_FAILED',
  AI_EMBEDDING_FAILED = 'AI_EMBEDDING_FAILED',
  AI_TRANSLATION_FAILED = 'AI_TRANSLATION_FAILED',
  AI_SUMMARIZATION_FAILED = 'AI_SUMMARIZATION_FAILED',
  AI_TRANSCRIPTION_FAILED = 'AI_TRANSCRIPTION_FAILED',
  AI_AUDIO_PROCESSING_FAILED = 'AI_AUDIO_PROCESSING_FAILED',
  AI_SUGGESTION_FAILED = 'AI_SUGGESTION_FAILED',
  AI_CHAT_FAILED = 'AI_CHAT_FAILED',
  AI_IMAGE_PROCESSING_FAILED = 'AI_IMAGE_PROCESSING_FAILED',

  // General client/server errors
  INVALID_INPUT = 'INVALID_INPUT',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  GONE = 'GONE',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  BAD_GATEWAY = 'BAD_GATEWAY',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
}

/**
 * A mapping from ApiErrorCode to a default user-friendly message and HTTP status code.
 */
const ERROR_DETAILS: Record<
  StashlyErrorCode,
  { message: string; status: number }
> = {
  // General client/server errors
  [StashlyErrorCode.BAD_GATEWAY]: {
    message: 'The server received an invalid response from an upstream server.',
    status: 502,
  },
  [StashlyErrorCode.FORBIDDEN]: {
    message: 'You do not have permission.',
    status: 403,
  },
  [StashlyErrorCode.INTERNAL_SERVER_ERROR]: {
    message: 'An unexpected error occurred on the server.',
    status: 500,
  },
  [StashlyErrorCode.INVALID_INPUT]: {
    message: 'The data provided was invalid.',
    status: 400,
  },
  [StashlyErrorCode.NOT_FOUND]: {
    message: 'The requested resource could not be found.',
    status: 404,
  },
  [StashlyErrorCode.CONFLICT]: {
    message: 'The request conflicts with the current state of the resource.',
    status: 409,
  },
  [StashlyErrorCode.GONE]: {
    message: 'The requested resource is no longer available.',
    status: 410,
  },
  [StashlyErrorCode.SERVICE_UNAVAILABLE]: {
    message: 'The service is temporarily unavailable.',
    status: 503,
  },
  [StashlyErrorCode.UNAUTHORIZED]: {
    message:
      'Authentication is required and has failed or has not yet been provided.',
    status: 401,
  },

  // User-related errors
  [StashlyErrorCode.INSUFFICIENT_FUNDS]: {
    message: 'Insufficient funds for this operation.',
    status: 402,
  },
  [StashlyErrorCode.USER_NOT_FOUND]: {
    message: 'The specified user could not be found.',
    status: 404,
  },
  [StashlyErrorCode.USER_ALREADY_EXISTS]: {
    message: 'A user with this email already exists.',
    status: 409,
  },
  [StashlyErrorCode.USER_NOT_AUTHORIZED]: {
    message: 'Unauthorized.',
    status: 403,
  },

  // Lock errors
  [StashlyErrorCode.LOCK_FAILED]: {
    message: 'Failed to acquire the lock.',
    status: 500,
  },
  [StashlyErrorCode.UNLOCK_FAILED]: {
    message: 'Failed to release the lock.',
    status: 500,
  },
  [StashlyErrorCode.LOCK_NOT_FOUND]: {
    message: 'The specified lock could not be found.',
    status: 404,
  },
  [StashlyErrorCode.ITEM_LOCKED]: {
    message: 'The item is currently locked.',
    status: 409,
  },
  [StashlyErrorCode.ITEM_NOT_LOCKED]: {
    message: 'The item is not currently locked.',
    status: 409,
  },

  // Storage Plan errors
  [StashlyErrorCode.CREATE_STORAGE_PLAN_FAILED]: {
    message: 'Failed to create the storage plan.',
    status: 500,
  },
  [StashlyErrorCode.DELETE_STORAGE_PLAN_FAILED]: {
    message: 'Failed to delete the storage plan.',
    status: 500,
  },
  [StashlyErrorCode.STORAGE_PLAN_NOT_FOUND]: {
    message: 'The specified storage plan could not be found.',
    status: 404,
  },
  [StashlyErrorCode.UPDATE_STORAGE_PLAN_FAILED]: {
    message: 'Failed to update the storage plan.',
    status: 500,
  },

  // Subscription errors
  [StashlyErrorCode.CANCEL_SUBSCRIPTION_FAILED]: {
    message: 'Failed to cancel the subscription.',
    status: 500,
  },
  [StashlyErrorCode.CREATE_SUBSCRIPTION_FAILED]: {
    message: 'Failed to create the subscription.',
    status: 500,
  },
  [StashlyErrorCode.DELETE_SUBSCRIPTION_FAILED]: {
    message: 'Failed to delete the subscription.',
    status: 500,
  },
  [StashlyErrorCode.SUBSCRIPTION_NOT_FOUND]: {
    message: 'The specified subscription could not be found.',
    status: 404,
  },
  [StashlyErrorCode.UPDATE_SUBSCRIPTION_FAILED]: {
    message: 'Failed to update the subscription.',
    status: 500,
  },

  // Quota errors
  [StashlyErrorCode.CREATE_QUOTA_FAILED]: {
    message: 'Failed to create the quota.',
    status: 500,
  },
  [StashlyErrorCode.DELETE_QUOTA_FAILED]: {
    message: 'Failed to delete the quota.',
    status: 500,
  },
  [StashlyErrorCode.QUOTA_EXCEEDED]: {
    message: 'You have exceeded your storage quota.',
    status: 507,
  },
  [StashlyErrorCode.INSUFFICIENT_QUOTA]: {
    message: 'Insufficient storage quota.',
    status: 507,
  },
  [StashlyErrorCode.QUOTA_NOT_FOUND]: {
    message: 'The specified quota could not be found.',
    status: 404,
  },
  [StashlyErrorCode.QUOTA_NOT_DEFINED_FOR_USER]: {
    message: 'The user does not have a quota defined.',
    status: 404,
  },
  [StashlyErrorCode.UPDATE_QUOTA_FAILED]: {
    message: 'Failed to update the quota.',
    status: 500,
  },

  // Drive errors
  [StashlyErrorCode.CREATE_DRIVE_FAILED]: {
    message: 'Failed to create the drive.',
    status: 500,
  },
  [StashlyErrorCode.DELETE_DRIVE_FAILED]: {
    message: 'Failed to delete the drive.',
    status: 500,
  },
  [StashlyErrorCode.DRIVE_NOT_FOUND]: {
    message: 'The specified drive could not be found.',
    status: 404,
  },
  [StashlyErrorCode.UPDATE_DRIVE_FAILED]: {
    message: 'Failed to update the drive.',
    status: 500,
  },

  // Item errors
  [StashlyErrorCode.COPY_ITEM_FAILED]: {
    message: 'Failed to copy the item.',
    status: 500,
  },
  [StashlyErrorCode.CREATE_ITEM_FAILED]: {
    message: 'Failed to create the item.',
    status: 500,
  },
  [StashlyErrorCode.DELETE_ITEM_FAILED]: {
    message: 'Failed to delete the item.',
    status: 500,
  },
  [StashlyErrorCode.ITEM_NOT_FOUND]: {
    message: 'The specified item could not be found.',
    status: 404,
  },
  [StashlyErrorCode.LIST_ITEMS_FAILED]: {
    message: 'Failed to list items.',
    status: 500,
  },
  [StashlyErrorCode.MOVE_ITEM_FAILED]: {
    message: 'Failed to move the item.',
    status: 500,
  },
  [StashlyErrorCode.RENAME_ITEM_FAILED]: {
    message: 'Failed to rename the item.',
    status: 500,
  },
  [StashlyErrorCode.UPDATE_ITEM_FAILED]: {
    message: 'Failed to update the item.',
    status: 500,
  },

  // Upload/Download errors
  [StashlyErrorCode.ABORT_UPLOAD_FAILED]: {
    message: 'Failed to abort the upload.',
    status: 500,
  },
  [StashlyErrorCode.COMPLETE_UPLOAD_FAILED]: {
    message: 'Failed to complete the upload.',
    status: 500,
  },
  [StashlyErrorCode.CREATE_UPLOAD_FAILED]: {
    message: 'Failed to create the upload session.',
    status: 500,
  },
  [StashlyErrorCode.DOWNLOAD_FAILED]: {
    message: 'The download failed.',
    status: 500,
  },
  [StashlyErrorCode.PRESIGNED_URL_FAILED]: {
    message: 'Failed to generate presigned URL.',
    status: 500,
  },
  [StashlyErrorCode.UPLOAD_FAILED]: {
    message: 'The upload failed.',
    status: 500,
  },

  // Share errors
  [StashlyErrorCode.CREATE_SHARE_FAILED]: {
    message: 'Failed to create the share.',
    status: 500,
  },
  [StashlyErrorCode.DELETE_SHARE_FAILED]: {
    message: 'Failed to delete the share.',
    status: 500,
  },
  [StashlyErrorCode.LIST_SHARES_FAILED]: {
    message: 'Failed to list shares.',
    status: 500,
  },
  [StashlyErrorCode.SHARE_FAILED]: {
    message: 'Failed to share the item.',
    status: 500,
  },
  [StashlyErrorCode.SHARE_NOT_FOUND]: {
    message: 'The specified share could not be found.',
    status: 404,
  },
  [StashlyErrorCode.UPDATE_SHARE_FAILED]: {
    message: 'Failed to update the share.',
    status: 500,
  },

  // AI errors
  [StashlyErrorCode.AI_MODEL_LOADING_FAILED]: {
    message: 'Failed to load the AI model.',
    status: 503,
  },
  [StashlyErrorCode.AI_PROCESSING_FAILED]: {
    message: 'AI processing failed.',
    status: 500,
  },
  [StashlyErrorCode.AI_CAPTION_GENERATION_FAILED]: {
    message: 'AI caption generation failed.',
    status: 500,
  },
  [StashlyErrorCode.AI_EMBEDDING_FAILED]: {
    message: 'AI embedding generation failed.',
    status: 500,
  },
  [StashlyErrorCode.AI_TRANSLATION_FAILED]: {
    message: 'AI translation failed.',
    status: 500,
  },
  [StashlyErrorCode.AI_SUMMARIZATION_FAILED]: {
    message: 'AI summarization failed.',
    status: 500,
  },
  [StashlyErrorCode.AI_SUGGESTION_FAILED]: {
    message: 'AI suggestion failed.',
    status: 500,
  },
  [StashlyErrorCode.AI_CHAT_FAILED]: {
    message: 'AI chat failed.',
    status: 500,
  },
  [StashlyErrorCode.AI_TRANSCRIPTION_FAILED]: {
    message: 'AI transcription failed.',
    status: 500,
  },
  [StashlyErrorCode.AI_AUDIO_PROCESSING_FAILED]: {
    message: 'AI audio processing failed.',
    status: 500,
  },
  [StashlyErrorCode.AI_IMAGE_PROCESSING_FAILED]: {
    message: 'AI image processing failed.',
    status: 500,
  },

  // Collection errors
  [StashlyErrorCode.ADD_ITEM_TO_COLLECTION_FAILED]: {
    message: 'Failed to add item to collection.',
    status: 500,
  },
  [StashlyErrorCode.ADD_ITEMS_TO_COLLECTION_FAILED]: {
    message: 'Failed to add items to collection.',
    status: 500,
  },
  [StashlyErrorCode.REMOVE_ITEM_FROM_COLLECTION_FAILED]: {
    message: 'Failed to remove item from collection.',
    status: 500,
  },
  [StashlyErrorCode.REMOVE_ITEMS_FROM_COLLECTION_FAILED]: {
    message: 'Failed to remove items from collection.',
    status: 500,
  },
  [StashlyErrorCode.COLLECTION_NOT_FOUND]: {
    message: 'The specified collection could not be found.',
    status: 404,
  },
  [StashlyErrorCode.CREATE_COLLECTION_FAILED]: {
    message: 'Failed to create the collection.',
    status: 500,
  },
  [StashlyErrorCode.CLEAR_COLLECTION_FAILED]: {
    message: 'Failed to clear the collection.',
    status: 500,
  },
  [StashlyErrorCode.RENAME_COLLECTION_FAILED]: {
    message: 'Failed to rename the collection.',  
    status: 500,
  },
  [StashlyErrorCode.DELETE_COLLECTION_FAILED]: {
    message: 'Failed to delete the collection.',
    status: 500,
  },
  [StashlyErrorCode.RESTORE_COLLECTION_FAILED]: {
    message: 'Failed to restore the collection.',
    status: 500,
  },
  [StashlyErrorCode.TRASH_COLLECTION_FAILED]: {
    message: 'Failed to trash the collection.',
    status: 500,
  },
  [StashlyErrorCode.RENAME_OBJECT_FAILED]: {
    message: 'Failed to rename the object.',
    status: 500,
  },
  [StashlyErrorCode.COPY_OBJECT_FAILED]: {
    message: 'Failed to copy the object.',
    status: 500,
  },
  [StashlyErrorCode.MOVE_OBJECT_FAILED]: {
    message: 'Failed to move the object.',
    status: 500,
  },
  [StashlyErrorCode.DELETE_OBJECT_FAILED]: {
    message: 'Failed to delete the object.',
    status: 500,
  },
  [StashlyErrorCode.CREATE_BUCKET_FAILED]: {
    message: 'Failed to create the bucket.',
    status: 500,  
  },
  [StashlyErrorCode.DELETE_BUCKET_FAILED]: {
    message: 'Failed to delete the bucket.',
    status: 500,
  },
  [StashlyErrorCode.SET_BUCKET_CORS_FAILED]: {
    message: 'Failed to set bucket CORS configuration.',
    status: 500,
  },
  [StashlyErrorCode.APPLY_BUCKET_POLICY_FAILED]: {
    message: 'Failed to apply bucket policy.',
    status: 500,
  },
  [StashlyErrorCode.ENABLE_BUCKET_VERSIONING_FAILED]: {
    message: 'Failed to enable bucket versioning.',
    status: 500,
  },
  [StashlyErrorCode.BUCKET_CORS_NOT_FOUND]: {
    message: 'Bucket CORS configuration not found.',
    status: 404,
  },
  [StashlyErrorCode.EMPTY_BUCKET_FAILED]: {
    message: 'Failed to empty the bucket.',
    status: 500,
  },

}

/**
 * Custom error class for API-related errors.
 * It extends the native Error class to include an HTTP status code and a specific error code.
 */
export class StashlyError extends Error {
  public readonly status: number
  public readonly errorCode: StashlyErrorCode

  constructor(errorCode: StashlyErrorCode, message?: string) {
    // Use the provided message or fall back to the default for the given error code
    const details = ERROR_DETAILS[errorCode]
    super(message || details.message)

    // Set the prototype explicitly to ensure `instanceof` checks work correctly
    Object.setPrototypeOf(this, StashlyError.prototype)

    this.name = 'StashlyError'
    this.status = details.status
    this.cause = details.status
    this.message = message || details.message
    this.errorCode = errorCode

    // This captures the stack trace in V8 environments (like Node.js and Chrome)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, StashlyError)
    }
  }
}

/**
 * Reads an **unknown caught value** and resolves `{ status, message }`.
 *
 * This is the consuming half of the pair — {@link toRouteError} builds what an
 * action throws, this interprets what a `catch` receives. They are not
 * alternatives: an API route catches plenty it never threw (Prisma validation
 * errors, Zod failures, auth library errors, a bare `Error`), and those need to
 * resolve to *no* status rather than to garbage, so the caller can fall back to
 * 500.
 *
 * Resolution order, and what each step is for:
 *
 * 1. `errorCode` → `ERROR_DETAILS`. The code is authoritative: `INVALID_INPUT`
 *    is 400 whether or not the object also carries a `status`, so the two can
 *    never disagree.
 * 2. `init.status` — a plain `data(payload, { status })` not built by
 *    `toRouteError`.
 * 3. `status` — `StashlyError` and anything else exposing it directly.
 * 4. `statusCode` — **nothing in this codebase emits this any more** (it came
 *    from `throwGuardError`, since deleted). Kept only because some third-party
 *    libraries use that spelling, and because `api-errors.test.ts` pins it.
 *
 * Anything outside 400–599 is discarded, so a rogue value cannot become a
 * response status.
 *
 * Route handlers also can't `instanceof StashlyError` cheaply — the dot-server
 * plugin makes importing a server module into a route a build-graph question —
 * which is the other reason this duck-types rather than checking classes.
 *
 * @param error - The caught value, of unknown type.
 * @returns The resolved status (omitted when the error carried none) and message.
 *
 * @example
 * } catch (e) {
 *   const err = toErrorInfo(e)
 *   return Response.json({ error: err.message }, { status: err.status ?? 500 })
 * }
 */
export function toErrorInfo(error: unknown): {
  status?: number
  message?: string
} {
  const e = error as {
    errorCode?: unknown
    status?: unknown
    statusCode?: unknown
    message?: unknown
    // React Router's `data(payload, { status })` — the status lives on `init`,
    // and the payload, not `message`, carries the text. Actions throw this so
    // the status survives into production: RR sanitizes thrown `Error`s but not
    // `DataWithResponseInit`, which is not an Error subclass.
    type?: unknown
    data?: unknown
    init?: { status?: unknown }
  }

  const isData = e?.type === 'DataWithResponseInit'

  // `errorCode` wins. ERROR_DETAILS is the single source of truth for what a
  // code means over HTTP, so INVALID_INPUT resolves to 400 whether or not the
  // thrown object also carries a `status`. Reading an attached field first
  // would let the two disagree — which is the class of bug this whole helper
  // exists to prevent.
  const code = e?.errorCode
  const fromCode =
    typeof code === 'string' && code in ERROR_DETAILS
      ? ERROR_DETAILS[code as StashlyErrorCode].status
      : undefined

  const raw =
    fromCode ??
    (isData
      ? e?.init?.status
      : typeof e?.status === 'number'
        ? e.status
        : e?.statusCode)
  const status =
    typeof raw === 'number' && raw >= 400 && raw <= 599 ? raw : undefined

  // A `data()` payload is the message itself, or `{ error }` (`rethrowAsResponse`).
  const payload = isData ? e?.data : undefined
  const text = isData
    ? typeof payload === 'object' && payload !== null
      ? (payload as { error?: unknown }).error
      : payload
    : e?.message

  return {
    status,
    message: typeof text === 'string' ? text : undefined,
  }
}

/**
 * Rethrows a request parser's error as a `data()` response with its status, so
 * a malformed request answers 400 instead of escaping the handler as a 500
 * (tech-debt item 48). Chain it onto `parseFormData` / `parseSearchParams`.
 *
 * `'json'` (API routes) throws `{ success: false, error }`, the shape their
 * callers read; `'text'` (page loaders) throws the message itself, which is
 * what the error boundary shows from `error.data`.
 *
 * `parseSearchParams` is synchronous, so it goes through `parseOrRespond`.
 *
 * @example
 * const input = await parseFormData({ request, schema }).catch(rethrowAsResponse)
 */
export function rethrowAsResponse(error: unknown, shape: 'json' | 'text' = 'json'): never {
  const err = toErrorInfo(error)
  const status = err.status ?? 400
  const message = err.message ?? 'Invalid request'
  throw shape === 'json'
    ? data({ success: false, error: message }, { status })
    : data(message, { status })
}

/**
 * Runs a synchronous parser and turns its error into a response, as
 * `rethrowAsResponse` does for the async `parseFormData`.
 *
 * @example
 * const query = parseOrRespond(() => parseSearchParams({ request, schema }))
 * const filters = parseOrRespond(() => parseSearchParams({ request, schema }), 'text')
 */
export function parseOrRespond<T>(parse: () => T, shape: 'json' | 'text' = 'json'): T {
  try {
    return parse()
  } catch (e) {
    rethrowAsResponse(e, shape)
  }
}

/**
 * Builds a throwable that carries a `StashlyError`'s status and message all the
 * way to the browser, including in production.
 *
 * A thrown `StashlyError` does not survive: React Router's `sanitizeError`
 * replaces anything `instanceof Error` with `new Error('Unexpected Server
 * Error')` outside development, stripping status, errorCode and message. It
 * does that *before* rendering, so even the server-side ErrorBoundary sees the
 * flattened version — which is why this cannot be fixed in the boundary.
 *
 * `data()` returns a `DataWithResponseInit`, which is deliberately not an Error
 * subclass, so it passes through untouched and becomes an `ErrorResponse` with
 * the status intact (`dataWithResponseInitToErrorResponse`).
 *
 * Note the message arrives as `error.data`, not `error.statusText` — the latter
 * defaults to `'Internal Server Error'` regardless of status.
 *
 * ## Which errors should use this
 *
 * 4xx codes — the user caused it and needs to be told what. 5xx codes keep
 * throwing `StashlyError` so React Router *does* sanitize them: a
 * `MOVE_ITEM_FAILED` message can carry a folder id, a Prisma constraint name or
 * an S3 key, none of which belongs in a browser.
 *
 * One deliberate exception: `INSUFFICIENT_QUOTA` is 507, but "you need 2.1 GB
 * of free space" is exactly what the user must see, so those sites use this
 * too. The status class is a good rule, not a law — judge by whether the
 * message is *for* the user.
 *
 * @example
 * throw toRouteError(StashlyErrorCode.FORBIDDEN, 'You do not have read access')
 */
/**
 * Standard reason phrases for the statuses `ERROR_DETAILS` can produce.
 *
 * Only these eleven appear in the table; anything else falls back to 'Error'
 * rather than guessing. Kept beside `toRouteError` because that is the only
 * place an HTTP status line is written.
 */
const STATUS_TEXT: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  402: 'Payment Required',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  410: 'Gone',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  507: 'Insufficient Storage',
}

export function toRouteError(errorCode: StashlyErrorCode, message?: string) {
  const err = new StashlyError(errorCode, message)
  // `errorCode` and `status` are attached on top of the DataWithResponseInit so
  // callers that duck-type a StashlyError keep working — the collection action
  // tests assert `toMatchObject({ errorCode })`, and `toErrorInfo` reads
  // `status`. React Router only checks `type`/`data`/`init` when recognising
  // this (`isDataWithResponseInit`), so the extra fields are inert to it.
  return Object.assign(
    data(err.message, {
      status: err.status,
      // Without this, `data()` leaves statusText at 'Internal Server Error'
      // regardless of status — so a 403 reads as a server error in a network
      // tab. The reason phrase is used rather than the message: statusText goes
      // into the HTTP status line, which must be ISO-8859-1 and single-line, and
      // an error message is neither guaranteed.
      statusText: STATUS_TEXT[err.status] ?? 'Error',
    }),
    {
      errorCode,
      status: err.status,
      message: err.message,
    }
  )
}

export function isStashlyError(error: unknown): error is StashlyError {
  return (
    error instanceof Error &&
    'status' in error &&
    'errorCode' in error &&
    Object.values(StashlyErrorCode).includes(
      (error as StashlyError).errorCode
    )
  )
}