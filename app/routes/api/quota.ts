import { redirect } from 'react-router'
import type { Route } from './+types/upload'
import { auth } from '@/services/auth'
import {
  findQuota,
  onItemsCopied,
  onItemsRestored,
  onItemsDeleted,
  verifyFreeQuota,
  checkFreeQuota,
  onItemsTrashed,
  onItemsUploaded,
  updateTotalQuota,
} from '@/services/quota'
import { quotaApiRouteInput, quotaApiRouteOutput } from './schema.zod'

export async function action({ request }: Route.ActionArgs) {
  let session = await auth.api.getSession(request)
  if (!session) throw redirect('/auth/sign-in')
  let { user } = session

  let data = await request.json()
  let { action, dataSize } = quotaApiRouteInput.parse(data)

  switch (action) {
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
      return verifyFreeQuota(quota, dataSize)
    }
    case 'check-free-quota': {
      const quota = await findQuota({
        userId: user.id,
      })
      return checkFreeQuota(data.itemId, quota, dataSize)
    }
    case 'items-uploaded': {
      const data = await onItemsUploaded({
        userId: user.id,
        dataSize,
      })
      return quotaApiRouteOutput.parse(data)
    }
    case 'items-trashed': {
      const data = await onItemsTrashed({
        userId: user.id,
        dataSize,
      })
      return quotaApiRouteOutput.parse(data)
    }
    case 'items-deleted': {
      const data = await onItemsDeleted({
        userId: user.id,
        dataSize,
      })
      return quotaApiRouteOutput.parse(data)
    }
    case 'items-copied': {
      const data = await onItemsCopied({
        userId: user.id,
        dataSize,
      })
      return quotaApiRouteOutput.parse(data)
    }
    case 'items-restored': {
      const data = await onItemsRestored({
        userId: user.id,
        dataSize,
      })
      return quotaApiRouteOutput.parse(data)
    }
    case 'update-total-quota': {
      const data = await updateTotalQuota({
        userId: user.id,
        dataSize,
      })
      return quotaApiRouteOutput.parse(data)
    }
    default: {
      // Ensure you have a proper return type here, depending on your framework's router.
      return { error: 'Invalid action' }
    }
  }
}
