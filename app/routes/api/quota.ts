import { quotaApiRouteInput, quotaApiRouteOutput } from '@/schemas/api.schemas'
import { authMiddleware } from '@/services/middleware/auth'
import { sessionContext } from '@/services/middleware/context'
import {
  checkFreeQuota,
  findQuota,
  verifyFreeQuota,
} from '@/services/quota-actions'
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

  switch (input.action) {
    case 'find-quota': {
      const quota = await findQuota({
        userId: user.id,
      })
      return quotaApiRouteOutput.parse(quota)
    }
    case 'verify-free-quota': {
      const quota = await findQuota({
        userId: user.id,
      })
      return verifyFreeQuota(quota, input.dataSize)
    }
    case 'check-free-quota': {
      const quota = await findQuota({
        userId: user.id,
      })
      return checkFreeQuota(input.itemId, quota, input.dataSize)
    }
  }
}
