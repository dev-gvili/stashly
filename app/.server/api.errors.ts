/**
 * @file Defines a custom ApiError class and related utilities for consistent API error handling.
 */

/**
 * Enum for application-specific API error codes.
 * This provides a clear, readable way to identify specific error scenarios.
 */
export enum ApiErrorCode {
	// Add your app-specific error codes here
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
	UPDATE_QUOTA_FAILED = 'UPDATE_QUOTA_FAILED',
	CREATE_QUOTA_FAILED = 'CREATE_QUOTA_FAILED',
	DELETE_QUOTA_FAILED = 'DELETE_QUOTA_FAILED',

	// Drive-related errors
	DRIVE_NOT_FOUND = 'DRIVE_NOT_FOUND',
	CREATE_DRIVE_FAILED = 'CREATE_DRIVE_FAILED',
	DELETE_DRIVE_FAILED = 'DELETE_DRIVE_FAILED',
	UPDATE_DRIVE_FAILED = 'UPDATE_DRIVE_FAILED',

	// User-related errors
	INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
	USER_NOT_FOUND = 'USER_NOT_FOUND',

	// General client/server errors
	INVALID_INPUT = 'INVALID_INPUT',
	UNAUTHORIZED = 'UNAUTHORIZED',
	FORBIDDEN = 'FORBIDDEN',
	NOT_FOUND = 'NOT_FOUND',
	INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
	BAD_GATEWAY = 'BAD_GATEWAY',
	SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
}

/**
 * A mapping from ApiErrorCode to a default user-friendly message and HTTP status code.
 */
const ERROR_DETAILS: Record<
	ApiErrorCode,
	{ message: string; statusCode: number }
> = {
	// General client/server errors
	[ApiErrorCode.BAD_GATEWAY]: {
		message:
			'The server received an invalid response from an upstream server.',
		statusCode: 502,
	},
	[ApiErrorCode.FORBIDDEN]: {
		message: 'You do not have permission to perform this action.',
		statusCode: 403,
	},
	[ApiErrorCode.INTERNAL_SERVER_ERROR]: {
		message: 'An unexpected error occurred on the server.',
		statusCode: 500,
	},
	[ApiErrorCode.INVALID_INPUT]: {
		message: 'The data provided was invalid.',
		statusCode: 400,
	},
	[ApiErrorCode.NOT_FOUND]: {
		message: 'The requested resource could not be found.',
		statusCode: 404,
	},
	[ApiErrorCode.SERVICE_UNAVAILABLE]: {
		message: 'The service is temporarily unavailable.',
		statusCode: 503,
	},
	[ApiErrorCode.UNAUTHORIZED]: {
		message:
			'Authentication is required and has failed or has not yet been provided.',
		statusCode: 401,
	},

	// User-related errors
	[ApiErrorCode.INSUFFICIENT_FUNDS]: {
		message: 'Insufficient funds for this operation.',
		statusCode: 402,
	},
	[ApiErrorCode.USER_NOT_FOUND]: {
		message: 'The specified user could not be found.',
		statusCode: 404,
	},

	// Storage Plan errors
	[ApiErrorCode.CREATE_STORAGE_PLAN_FAILED]: {
		message: 'Failed to create the storage plan.',
		statusCode: 500,
	},
	[ApiErrorCode.DELETE_STORAGE_PLAN_FAILED]: {
		message: 'Failed to delete the storage plan.',
		statusCode: 500,
	},
	[ApiErrorCode.STORAGE_PLAN_NOT_FOUND]: {
		message: 'The specified storage plan could not be found.',
		statusCode: 404,
	},
	[ApiErrorCode.UPDATE_STORAGE_PLAN_FAILED]: {
		message: 'Failed to update the storage plan.',
		statusCode: 500,
	},

	// Subscription errors
	[ApiErrorCode.CANCEL_SUBSCRIPTION_FAILED]: {
		message: 'Failed to cancel the subscription.',
		statusCode: 500,
	},
	[ApiErrorCode.CREATE_SUBSCRIPTION_FAILED]: {
		message: 'Failed to create the subscription.',
		statusCode: 500,
	},
	[ApiErrorCode.DELETE_SUBSCRIPTION_FAILED]: {
		message: 'Failed to delete the subscription.',
		statusCode: 500,
	},
	[ApiErrorCode.SUBSCRIPTION_NOT_FOUND]: {
		message: 'The specified subscription could not be found.',
		statusCode: 404,
	},
	[ApiErrorCode.UPDATE_SUBSCRIPTION_FAILED]: {
		message: 'Failed to update the subscription.',
		statusCode: 500,
	},

	// Quota errors
	[ApiErrorCode.CREATE_QUOTA_FAILED]: {
		message: 'Failed to create the quota.',
		statusCode: 500,
	},
	[ApiErrorCode.DELETE_QUOTA_FAILED]: {
		message: 'Failed to delete the quota.',
		statusCode: 500,
	},
	[ApiErrorCode.QUOTA_EXCEEDED]: {
		message: 'You have exceeded your storage quota.',
		statusCode: 403,
	},
	[ApiErrorCode.QUOTA_NOT_FOUND]: {
		message: 'The specified quota could not be found.',
		statusCode: 404,
	},
	[ApiErrorCode.UPDATE_QUOTA_FAILED]: {
		message: 'Failed to update the quota.',
		statusCode: 500,
	},

	// Drive errors
	[ApiErrorCode.CREATE_DRIVE_FAILED]: {
		message: 'Failed to create the drive.',
		statusCode: 500,
	},
	[ApiErrorCode.DELETE_DRIVE_FAILED]: {
		message: 'Failed to delete the drive.',
		statusCode: 500,
	},
	[ApiErrorCode.DRIVE_NOT_FOUND]: {
		message: 'The specified drive could not be found.',
		statusCode: 404,
	},
	[ApiErrorCode.UPDATE_DRIVE_FAILED]: {
		message: 'Failed to update the drive.',
		statusCode: 500,
	},

	// Item errors
	[ApiErrorCode.COPY_ITEM_FAILED]: {
		message: 'Failed to copy the item.',
		statusCode: 500,
	},
	[ApiErrorCode.CREATE_ITEM_FAILED]: {
		message: 'Failed to create the item.',
		statusCode: 500,
	},
	[ApiErrorCode.DELETE_ITEM_FAILED]: {
		message: 'Failed to delete the item.',
		statusCode: 500,
	},
	[ApiErrorCode.ITEM_NOT_FOUND]: {
		message: 'The specified item could not be found.',
		statusCode: 404,
	},
	[ApiErrorCode.LIST_ITEMS_FAILED]: {
		message: 'Failed to list items.',
		statusCode: 500,
	},
	[ApiErrorCode.MOVE_ITEM_FAILED]: {
		message: 'Failed to move the item.',
		statusCode: 500,
	},
	[ApiErrorCode.RENAME_ITEM_FAILED]: {
		message: 'Failed to rename the item.',
		statusCode: 500,
	},
	[ApiErrorCode.UPDATE_ITEM_FAILED]: {
		message: 'Failed to update the item.',
		statusCode: 500,
	},

	// Upload/Download errors
	[ApiErrorCode.ABORT_UPLOAD_FAILED]: {
		message: 'Failed to abort the upload.',
		statusCode: 500,
	},
	[ApiErrorCode.COMPLETE_UPLOAD_FAILED]: {
		message: 'Failed to complete the upload.',
		statusCode: 500,
	},
	[ApiErrorCode.CREATE_UPLOAD_FAILED]: {
		message: 'Failed to create the upload session.',
		statusCode: 500,
	},
	[ApiErrorCode.DOWNLOAD_FAILED]: {
		message: 'The download failed.',
		statusCode: 500,
	},
	[ApiErrorCode.PRESIGNED_URL_FAILED]: {
		message: 'Failed to generate presigned URL.',
		statusCode: 500,
	},
	[ApiErrorCode.UPLOAD_FAILED]: {
		message: 'The upload failed.',
		statusCode: 500,
	},

	// Share errors
	[ApiErrorCode.CREATE_SHARE_FAILED]: {
		message: 'Failed to create the share.',
		statusCode: 500,
	},
	[ApiErrorCode.DELETE_SHARE_FAILED]: {
		message: 'Failed to delete the share.',
		statusCode: 500,
	},
	[ApiErrorCode.LIST_SHARES_FAILED]: {
		message: 'Failed to list shares.',
		statusCode: 500,
	},
	[ApiErrorCode.SHARE_FAILED]: {
		message: 'Failed to share the item.',
		statusCode: 500,
	},
	[ApiErrorCode.SHARE_NOT_FOUND]: {
		message: 'The specified share could not be found.',
		statusCode: 404,
	},
	[ApiErrorCode.UPDATE_SHARE_FAILED]: {
		message: 'Failed to update the share.',
		statusCode: 500,
	},
}

/**
 * Custom error class for API-related errors.
 * It extends the native Error class to include an HTTP status code and a specific error code.
 */
export class ApiError extends Error {
	public readonly statusCode: number
	public readonly errorCode: ApiErrorCode

	constructor(errorCode: ApiErrorCode, message?: string) {
		// Use the provided message or fall back to the default for the given error code
		const details = ERROR_DETAILS[errorCode]
		super(message || details.message)

		// Set the prototype explicitly to ensure `instanceof` checks work correctly
		Object.setPrototypeOf(this, ApiError.prototype)

		this.name = 'ApiError'
		this.statusCode = details.statusCode
		this.errorCode = errorCode

		// This captures the stack trace in V8 environments (like Node.js and Chrome)
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, ApiError)
		}
	}
}
