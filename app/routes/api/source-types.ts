import { authMiddleware } from '@/services/middleware/auth'
import { sessionContext } from '@/services/middleware/context'
import type { Route } from './+types/source-types'
import {
  getProjectConfig,
  getSourceFiles,
} from '@/services/source-resolution-actions'
import { toErrorInfo } from '@/utils/api.errors'
import { sourceTypesApiRouteInput } from '@/schemas/api.schemas'

export const middleware: Route.MiddlewareFunction[] = [authMiddleware]

/**
 * Resource route backing cross-file type resolution in the code viewer.
 * `project-config` returns a file's project root + alias config; `source-files`
 * returns the source of alias-mapped files under that root. See
 * `source-resolution-actions.ts`.
 */
export async function action({ request, context }: Route.ActionArgs) {
  const session = context.get(sessionContext)
  const { user } = session

  const input = sourceTypesApiRouteInput.parse(await request.json())

  try {
    switch (input.intent) {
      case 'project-config':
        return await getProjectConfig(user.id, input.fileId)
      case 'source-files':
        return {
          files: await getSourceFiles(user.id, input.rootId, input.logicalPaths),
        }
    }
  } catch (e) {
    const err = toErrorInfo(e)
    return Response.json(
      { error: err.message ?? 'Failed to resolve source types' },
      { status: err.status ?? 500 }
    )
  }
}
