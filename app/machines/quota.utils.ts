import type { QuotaApiRouteOutput } from '../routes/api/api.types'
import { quota } from './schema.zod'

/**
 * Default fetch initialization for API requests.
 */
export const FetchInit: RequestInit = {
	method: 'POST',
	headers: { 'Content-Type': 'application/json' },
}

/**
 * Transforms raw quota data from an API response into the application's internal format using a Zod schema.
 * This ensures the data is validated and that numeric fields are correctly parsed as BigInts.
 *
 * @param data - The raw quota data from the API response.
 * @returns The transformed quota data, conforming to the internal schema.
 */
export function parseQuota(data: QuotaApiRouteOutput) {
	return quota.parse(data)
}
/**
 * Queries the quota for a user based on an action and data size.
 * This function is used to check if the user has enough free quota for operations like uploads.
 *
 * @param userId - The ID of the user.
 * @param action - The action being performed (e.g., 'items-uploaded').
 * @param dataSize - The size of the data being processed.
 * @returns The updated quota information after the operation.
 */

export async function updateQuota({
	userId, action, dataSize,
}: {
	userId: string
	action: string
	dataSize: bigint
}) {
	const res = await fetch('/api/quota', {
		...FetchInit,
		body: JSON.stringify({
			userId,
			action,
			dataSize,
		}),
	})
	let quotaData = await res.json()
	return parseQuota(quotaData)
}
