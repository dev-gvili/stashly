import { ApiError, ApiErrorCode } from './api.errors'

/**
 * A generic response handler that checks for HTTP errors and throws an ApiError if the request was not successful.
 * This centralizes error handling for all fetch calls.
 *
 * @param response - The Response object from a `fetch` call.
 * @returns A promise that resolves with the JSON body of the response if the request was successful.
 * @throws {ApiError} - Throws an ApiError if the response status is not 'ok' (i.e., not in the 200-299 range).
 */
export async function handleApiResponse(response: Response) {
	if (response.ok) {
		// If the response is successful, parse and return the JSON body.
		return response.json()
	}

	let errorBody
	try {
		// Attempt to parse the error response body, which might contain a specific error code.
		errorBody = await response.json()
	} catch (e) {
		// If the body isn't valid JSON, create a generic error.
		console.error('Could not parse error response JSON.', e)
		throw new ApiError(
			ApiErrorCode.INTERNAL_SERVER_ERROR,
			'The server returned an invalid error response.'
		)
	}

	// Use the error code from the response body, or fall back to a generic server error.
	const errorCode = errorBody.errorCode || ApiErrorCode.INTERNAL_SERVER_ERROR
	const errorMessage = errorBody.message || 'An unknown error occurred.'

	throw new ApiError(errorCode, errorMessage)
}
