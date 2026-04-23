import { fromPromise } from 'xstate'
import type { QuotaInput, QuotaOutput } from '@/services/quota-actions'
import { updateQuota as update, parseQuota, FetchInit } from './quota.utils'

/**
 * An XState actor that wraps the `updateQuota` function. It's designed to be invoked
 * from a state machine to modify a user's quota based on an action like uploading,
 * copying, or deleting items.
 *
 * @param input - The input containing user ID, action, and data size.
 * @returns The updated quota information.
 */
export const updateQuota = fromPromise<
  QuotaOutput,
   {
    userId: string
    dataSize: number | bigint
    action: string
  }
>(async ({ input }) => await update(input))

/**
 * An XState actor that fetches the complete, up-to-date quota information for a
 * given user by calling the `/api/quota` endpoint.
 *
 * @param input - The input containing the user ID.
 * @returns The user's quota information.
 */
export const findQuota = fromPromise<QuotaOutput, Pick<QuotaInput, 'userId'>>(
  async ({ input }) => {
    const res = await fetch('/api/quota', {
      ...FetchInit,
      body: JSON.stringify({
        userId: input.userId,
        action: 'find-quota',
      }),
    })
    let quotaData = await res.json()
    return parseQuota(quotaData)
  }
)

/**
 * An XState actor that performs a pre-check to verify if a user has sufficient
 * free quota for a specific data size. It calls the `/api/quota` endpoint and is
 * intended to prevent operations like uploads from starting if they are guaranteed
 * to fail due to quota limits.
 *
 * @param input - The input containing the user ID and the data size to verify.
 * @returns A boolean indicating if there is enough free quota.
 */
export const verifyQuota = fromPromise<boolean, QuotaInput>(
  async ({ input }) => {
    const res = await fetch('/api/quota', {
      ...FetchInit,
      body: JSON.stringify({
        userId: input.userId,
        dataSize: input.dataSize.toString(),
        action: 'verify-free-quota',
      }),
    })

    const result = await res.json()
    return result
  }
)
export const checkQuota = fromPromise<{
  itemId: string
  result: 'allowed' | 'denied'
}, QuotaInput & { itemId: string }>(
  async ({ input }) => {
    const res = await fetch('/api/quota', {
      ...FetchInit,
      body: JSON.stringify({
        userId: input.userId,
        itemId: input.itemId,
        dataSize: input.dataSize.toString(),
        action: 'check-free-quota',
      }),
    })

    const result = await res.json()
    return result
  }
)
