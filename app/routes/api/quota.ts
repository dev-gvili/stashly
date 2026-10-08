import { quotaApiRouteInput, quotaApiRouteOutput } from '@/schemas/api.schemas'
import { auth } from '@/services/auth'
import {
  checkFreeQuota,
  findQuota,
  verifyFreeQuota,
} from '@/services/quota-actions'
import { data, redirect } from 'react-router'
import type { Route } from './+types/upload'

export async function action({ request }: Route.ActionArgs) {
    const session = await auth.api.getSession({
    headers: request.headers,
  })
  if (!session) throw redirect('/auth/sign-in')
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
