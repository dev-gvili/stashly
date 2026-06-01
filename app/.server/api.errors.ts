/**
 * @file Defines a custom ApiError class and related utilities for consistent API error handling.
 */

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
  { message: string; statusCode: number }
> = {
  // General client/server errors
  [StashlyErrorCode.BAD_GATEWAY]: {
    message: 'The server received an invalid response from an upstream server.',
    statusCode: 502,
  },
  [StashlyErrorCode.FORBIDDEN]: {
    message: 'You do not have permission to perform this action.',
    statusCode: 403,
  },
  [StashlyErrorCode.INTERNAL_SERVER_ERROR]: {
    message: 'An unexpected error occurred on the server.',
    statusCode: 500,
  },
  [StashlyErrorCode.INVALID_INPUT]: {
    message: 'The data provided was invalid.',
    statusCode: 400,
  },
  [StashlyErrorCode.NOT_FOUND]: {
    message: 'The requested resource could not be found.',
    statusCode: 404,
  },
  [StashlyErrorCode.CONFLICT]: {
    message: 'The request conflicts with the current state of the resource.',
    statusCode: 409,
  },
  [StashlyErrorCode.GONE]: {
    message: 'The requested resource is no longer available.',
    statusCode: 410,
  },
  [StashlyErrorCode.SERVICE_UNAVAILABLE]: {
    message: 'The service is temporarily unavailable.',
    statusCode: 503,
  },
  [StashlyErrorCode.UNAUTHORIZED]: {
    message:
      'Authentication is required and has failed or has not yet been provided.',
    statusCode: 401,
  },

  // User-related errors
  [StashlyErrorCode.INSUFFICIENT_FUNDS]: {
    message: 'Insufficient funds for this operation.',
    statusCode: 402,
  },
  [StashlyErrorCode.USER_NOT_FOUND]: {
    message: 'The specified user could not be found.',
    statusCode: 404,
  },
  [StashlyErrorCode.USER_ALREADY_EXISTS]: {
    message: 'A user with this email already exists.',
    statusCode: 409,
  },
  [StashlyErrorCode.USER_NOT_AUTHORIZED]: {
    message: 'The user is not authorized to perform this action.',
    statusCode: 403,
  },

  // Lock errors
  [StashlyErrorCode.LOCK_FAILED]: {
    message: 'Failed to acquire the lock.',
    statusCode: 500,
  },
  [StashlyErrorCode.UNLOCK_FAILED]: {
    message: 'Failed to release the lock.',
    statusCode: 500,
  },
  [StashlyErrorCode.LOCK_NOT_FOUND]: {
    message: 'The specified lock could not be found.',
    statusCode: 404,
  },
  [StashlyErrorCode.ITEM_LOCKED]: {
    message: 'The item is currently locked.',
    statusCode: 409,
  },
  [StashlyErrorCode.ITEM_NOT_LOCKED]: {
    message: 'The item is not currently locked.',
    statusCode: 409,
  },

  // Storage Plan errors
  [StashlyErrorCode.CREATE_STORAGE_PLAN_FAILED]: {
    message: 'Failed to create the storage plan.',
    statusCode: 500,
  },
  [StashlyErrorCode.DELETE_STORAGE_PLAN_FAILED]: {
    message: 'Failed to delete the storage plan.',
    statusCode: 500,
  },
  [StashlyErrorCode.STORAGE_PLAN_NOT_FOUND]: {
    message: 'The specified storage plan could not be found.',
    statusCode: 404,
  },
  [StashlyErrorCode.UPDATE_STORAGE_PLAN_FAILED]: {
    message: 'Failed to update the storage plan.',
    statusCode: 500,
  },

  // Subscription errors
  [StashlyErrorCode.CANCEL_SUBSCRIPTION_FAILED]: {
    message: 'Failed to cancel the subscription.',
    statusCode: 500,
  },
  [StashlyErrorCode.CREATE_SUBSCRIPTION_FAILED]: {
    message: 'Failed to create the subscription.',
    statusCode: 500,
  },
  [StashlyErrorCode.DELETE_SUBSCRIPTION_FAILED]: {
    message: 'Failed to delete the subscription.',
    statusCode: 500,
  },
  [StashlyErrorCode.SUBSCRIPTION_NOT_FOUND]: {
    message: 'The specified subscription could not be found.',
    statusCode: 404,
  },
  [StashlyErrorCode.UPDATE_SUBSCRIPTION_FAILED]: {
    message: 'Failed to update the subscription.',
    statusCode: 500,
  },

  // Quota errors
  [StashlyErrorCode.CREATE_QUOTA_FAILED]: {
    message: 'Failed to create the quota.',
    statusCode: 500,
  },
  [StashlyErrorCode.DELETE_QUOTA_FAILED]: {
    message: 'Failed to delete the quota.',
    statusCode: 500,
  },
  [StashlyErrorCode.QUOTA_EXCEEDED]: {
    message: 'You have exceeded your storage quota.',
    statusCode: 507,
  },
  [StashlyErrorCode.INSUFFICIENT_QUOTA]: {
    message: 'Insufficient storage quota.',
    statusCode: 507,
  },
  [StashlyErrorCode.QUOTA_NOT_FOUND]: {
    message: 'The specified quota could not be found.',
    statusCode: 404,
  },
  [StashlyErrorCode.QUOTA_NOT_DEFINED_FOR_USER]: {
    message: 'The user does not have a quota defined.',
    statusCode: 404,
  },
  [StashlyErrorCode.UPDATE_QUOTA_FAILED]: {
    message: 'Failed to update the quota.',
    statusCode: 500,
  },

  // Drive errors
  [StashlyErrorCode.CREATE_DRIVE_FAILED]: {
    message: 'Failed to create the drive.',
    statusCode: 500,
  },
  [StashlyErrorCode.DELETE_DRIVE_FAILED]: {
    message: 'Failed to delete the drive.',
    statusCode: 500,
  },
  [StashlyErrorCode.DRIVE_NOT_FOUND]: {
    message: 'The specified drive could not be found.',
    statusCode: 404,
  },
  [StashlyErrorCode.UPDATE_DRIVE_FAILED]: {
    message: 'Failed to update the drive.',
    statusCode: 500,
  },

  // Item errors
  [StashlyErrorCode.COPY_ITEM_FAILED]: {
    message: 'Failed to copy the item.',
    statusCode: 500,
  },
  [StashlyErrorCode.CREATE_ITEM_FAILED]: {
    message: 'Failed to create the item.',
    statusCode: 500,
  },
  [StashlyErrorCode.DELETE_ITEM_FAILED]: {
    message: 'Failed to delete the item.',
    statusCode: 500,
  },
  [StashlyErrorCode.ITEM_NOT_FOUND]: {
    message: 'The specified item could not be found.',
    statusCode: 404,
  },
  [StashlyErrorCode.LIST_ITEMS_FAILED]: {
    message: 'Failed to list items.',
    statusCode: 500,
  },
  [StashlyErrorCode.MOVE_ITEM_FAILED]: {
    message: 'Failed to move the item.',
    statusCode: 500,
  },
  [StashlyErrorCode.RENAME_ITEM_FAILED]: {
    message: 'Failed to rename the item.',
    statusCode: 500,
  },
  [StashlyErrorCode.UPDATE_ITEM_FAILED]: {
    message: 'Failed to update the item.',
    statusCode: 500,
  },

  // Upload/Download errors
  [StashlyErrorCode.ABORT_UPLOAD_FAILED]: {
    message: 'Failed to abort the upload.',
    statusCode: 500,
  },
  [StashlyErrorCode.COMPLETE_UPLOAD_FAILED]: {
    message: 'Failed to complete the upload.',
    statusCode: 500,
  },
  [StashlyErrorCode.CREATE_UPLOAD_FAILED]: {
    message: 'Failed to create the upload session.',
    statusCode: 500,
  },
  [StashlyErrorCode.DOWNLOAD_FAILED]: {
    message: 'The download failed.',
    statusCode: 500,
  },
  [StashlyErrorCode.PRESIGNED_URL_FAILED]: {
    message: 'Failed to generate presigned URL.',
    statusCode: 500,
  },
  [StashlyErrorCode.UPLOAD_FAILED]: {
    message: 'The upload failed.',
    statusCode: 500,
  },

  // Share errors
  [StashlyErrorCode.CREATE_SHARE_FAILED]: {
    message: 'Failed to create the share.',
    statusCode: 500,
  },
  [StashlyErrorCode.DELETE_SHARE_FAILED]: {
    message: 'Failed to delete the share.',
    statusCode: 500,
  },
  [StashlyErrorCode.LIST_SHARES_FAILED]: {
    message: 'Failed to list shares.',
    statusCode: 500,
  },
  [StashlyErrorCode.SHARE_FAILED]: {
    message: 'Failed to share the item.',
    statusCode: 500,
  },
  [StashlyErrorCode.SHARE_NOT_FOUND]: {
    message: 'The specified share could not be found.',
    statusCode: 404,
  },
  [StashlyErrorCode.UPDATE_SHARE_FAILED]: {
    message: 'Failed to update the share.',
    statusCode: 500,
  },

  // AI errors
  [StashlyErrorCode.AI_MODEL_LOADING_FAILED]: {
    message: 'Failed to load the AI model.',
    statusCode: 503,
  },
  [StashlyErrorCode.AI_PROCESSING_FAILED]: {
    message: 'AI processing failed.',
    statusCode: 500,
  },
  [StashlyErrorCode.AI_CAPTION_GENERATION_FAILED]: {
    message: 'AI caption generation failed.',
    statusCode: 500,
  },
  [StashlyErrorCode.AI_EMBEDDING_FAILED]: {
    message: 'AI embedding generation failed.',
    statusCode: 500,
  },
  [StashlyErrorCode.AI_TRANSLATION_FAILED]: {
    message: 'AI translation failed.',
    statusCode: 500,
  },
  [StashlyErrorCode.AI_SUMMARIZATION_FAILED]: {
    message: 'AI summarization failed.',
    statusCode: 500,
  },
  [StashlyErrorCode.AI_SUGGESTION_FAILED]: {
    message: 'AI suggestion failed.',
    statusCode: 500,
  },
  [StashlyErrorCode.AI_CHAT_FAILED]: {
    message: 'AI chat failed.',
    statusCode: 500,
  },
  [StashlyErrorCode.AI_TRANSCRIPTION_FAILED]: {
    message: 'AI transcription failed.',
    statusCode: 500,
  },
  [StashlyErrorCode.AI_AUDIO_PROCESSING_FAILED]: {
    message: 'AI audio processing failed.',
    statusCode: 500,
  },
  [StashlyErrorCode.AI_IMAGE_PROCESSING_FAILED]: {
    message: 'AI image processing failed.',
    statusCode: 500,
  },

  // Collection errors
  [StashlyErrorCode.ADD_ITEM_TO_COLLECTION_FAILED]: {
    message: 'Failed to add item to collection.',
    statusCode: 500,
  },
  [StashlyErrorCode.ADD_ITEMS_TO_COLLECTION_FAILED]: {
    message: 'Failed to add items to collection.',
    statusCode: 500,
  },
  [StashlyErrorCode.REMOVE_ITEM_FROM_COLLECTION_FAILED]: {
    message: 'Failed to remove item from collection.',
    statusCode: 500,
  },
  [StashlyErrorCode.REMOVE_ITEMS_FROM_COLLECTION_FAILED]: {
    message: 'Failed to remove items from collection.',
    statusCode: 500,
  },
  [StashlyErrorCode.COLLECTION_NOT_FOUND]: {
    message: 'The specified collection could not be found.',
    statusCode: 404,
  },
  [StashlyErrorCode.CREATE_COLLECTION_FAILED]: {
    message: 'Failed to create the collection.',
    statusCode: 500,
  },
  [StashlyErrorCode.CLEAR_COLLECTION_FAILED]: {
    message: 'Failed to clear the collection.',
    statusCode: 500,
  },
  [StashlyErrorCode.RENAME_COLLECTION_FAILED]: {
    message: 'Failed to rename the collection.',  
    statusCode: 500,
  },
  [StashlyErrorCode.DELETE_COLLECTION_FAILED]: {
    message: 'Failed to delete the collection.',
    statusCode: 500,
  },
  [StashlyErrorCode.RESTORE_COLLECTION_FAILED]: {
    message: 'Failed to restore the collection.',
    statusCode: 500,
  },
  [StashlyErrorCode.TRASH_COLLECTION_FAILED]: {
    message: 'Failed to trash the collection.',
    statusCode: 500,
  },
  [StashlyErrorCode.RENAME_OBJECT_FAILED]: {
    message: 'Failed to rename the object.',
    statusCode: 500,
  },
  [StashlyErrorCode.COPY_OBJECT_FAILED]: {
    message: 'Failed to copy the object.',
    statusCode: 500,
  },
  [StashlyErrorCode.MOVE_OBJECT_FAILED]: {
    message: 'Failed to move the object.',
    statusCode: 500,
  },
  [StashlyErrorCode.DELETE_OBJECT_FAILED]: {
    message: 'Failed to delete the object.',
    statusCode: 500,
  },
  [StashlyErrorCode.CREATE_BUCKET_FAILED]: {
    message: 'Failed to create the bucket.',
    statusCode: 500,  
  },
  [StashlyErrorCode.DELETE_BUCKET_FAILED]: {
    message: 'Failed to delete the bucket.',
    statusCode: 500,
  },
  [StashlyErrorCode.SET_BUCKET_CORS_FAILED]: {
    message: 'Failed to set bucket CORS configuration.',
    statusCode: 500,
  },
  [StashlyErrorCode.APPLY_BUCKET_POLICY_FAILED]: {
    message: 'Failed to apply bucket policy.',
    statusCode: 500,
  },
  [StashlyErrorCode.ENABLE_BUCKET_VERSIONING_FAILED]: {
    message: 'Failed to enable bucket versioning.',
    statusCode: 500,
  },
  [StashlyErrorCode.BUCKET_CORS_NOT_FOUND]: {
    message: 'Bucket CORS configuration not found.',
    statusCode: 404,
  },
  [StashlyErrorCode.EMPTY_BUCKET_FAILED]: {
    message: 'Failed to empty the bucket.',
    statusCode: 500,
  },

}

/**
 * Custom error class for API-related errors.
 * It extends the native Error class to include an HTTP status code and a specific error code.
 */
export class StashlyError extends Error {
  public readonly statusCode: number
  public readonly errorCode: StashlyErrorCode

  constructor(errorCode: StashlyErrorCode, message?: string) {
    // Use the provided message or fall back to the default for the given error code
    const details = ERROR_DETAILS[errorCode]
    super(message || details.message)

    // Set the prototype explicitly to ensure `instanceof` checks work correctly
    Object.setPrototypeOf(this, StashlyError.prototype)

    this.name = 'StashlyError'
    this.statusCode = details.statusCode
    this.message = message || details.message
    this.errorCode = errorCode

    // This captures the stack trace in V8 environments (like Node.js and Chrome)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, StashlyError)
    }
  }
}
