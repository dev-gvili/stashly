import type { QuotaApiRouteOutput } from '@/types/api.types'
import { quota } from '@/schemas/machine.schemas'

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
