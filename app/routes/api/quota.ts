import { quotaApiRouteInput, quotaApiRouteOutput } from '@/schemas/api.schemas'
import { authMiddleware } from '@/services/middleware/auth'
import { sessionContext } from '@/services/middleware/context'
import {
  checkFreeQuota,
  findQuota,
  findQuotaForFolder,
  verifyFreeQuota,
} from '@/services/quota-actions'
import { toErrorInfo } from '@/utils/api.errors'
import { data } from 'react-router'
import type { Route } from './+types/upload'

// Resolves the session once and forwards the cache cookie it refreshed, which
// a bare `getSession` here would drop: an upload is a long run of API calls
// with no page load in between (tech-debt item 35).
export const middleware: Route.MiddlewareFunction[] = [authMiddleware]

export async function action({ request, context }: Route.ActionArgs) {
    const session = context.get(sessionContext)
  let { user } = session

  // Read-only. An unknown action — including the write actions this route used
  // to accept — or a bad size is the client's mistake: answer 400, not the 500
  // a thrown ZodError would become.
  const parsed = quotaApiRouteInput.safeParse(await request.json())
  if (!parsed.success) {
    throw data({ error: 'Invalid quota request' }, { status: 400 })
  }
  const input = parsed.data

  // A pre-check answers for the drive that would pay: the folder's. Only ever a
  // yes or no, so a collaborator learns nothing of the owner's numbers.
  const chargedQuota = async (folderId?: string) => {
    if (!folderId) return findQuota({ userId: user.id })
    try {
      return await findQuotaForFolder(user.id, folderId)
    } catch (e) {
      const err = toErrorInfo(e)
      throw data({ error: err.message }, { status: err.status ?? 500 })
    }
  }

  switch (input.action) {
    case 'find-quota': {
      const quota = await findQuota({
        userId: user.id,
      })
      return quotaApiRouteOutput.parse(quota)
    }
    case 'verify-free-quota': {
      return verifyFreeQuota(await chargedQuota(input.folderId), input.dataSize)
    }
    case 'check-free-quota': {
      return checkFreeQuota(input.itemId, await chargedQuota(input.folderId), input.dataSize)
    }
  }
}
