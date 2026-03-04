import type { QuotaApiRouteOutput } from '@/routes/api/api.types'
import { quota } from '@/machines/schema.zod'

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
 * Updates the user's quota by sending a request to the `/api/quota` endpoint.
 * This function is used to modify the used space, for example, after an upload or deletion.
 *
 * @param input - An object containing the user ID, the action to perform (e.g., 'increment-used', 'decrement-used'), and the size of the data involved.
 * @returns The updated quota information.
 */
export async function updateQuota({
  userId,
  action,
  dataSize,
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
