import { authMiddleware } from '@/services/middleware/auth'
import { sessionContext } from '@/services/middleware/context'
import { data } from 'react-router'
import { parseSearchParams } from '@/utils/parsers'
import { parseOrRespond } from '@/utils/api.errors'
import { searchActivities } from '@/services/activity-actions'
import { z } from 'zod'
import type { Route } from './+types/activities'

const schema = z.object({
  itemId: z.string().optional(),
  cursor: z.string().optional(),
  take: z.coerce.number().min(1).max(50).default(20),
})

export const middleware: Route.MiddlewareFunction[] = [authMiddleware]

export async function loader({ request, context }: Route.LoaderArgs) {
  const session = context.get(sessionContext)

  const params = parseOrRespond(() => parseSearchParams({ request, schema }))

  const result = await searchActivities({
    itemId: params.itemId ? { equals: params.itemId } : undefined,
    cursor: params.cursor,
    take: params.take,
    strategy: 'cursor',
    orderBy: { time: { observedAt: 'desc' } },
    include: {
      time: true,
      item: true,
      action: {
        include: {
          create: true,
          rename: true,
          move: true,
          delete: true,
          restore: true,
          copy: true,
          share: true,
          version: true,
          comment: true,
          permission: true,
          upload: true,
          pin: true,
          edit: true,
        },
      },
      access: true,
    },
  })

  let parsedResult = z.looseObject({
    item: z.looseObject({
      id: z.string(),
      name: z.string(),
      size: z.coerce.number().min(0),
      inclusiveSize: z.coerce.number().min(0),
    }),
  })
  let dataResult = parsedResult.array().parse(result.data)
  return data({ data: dataResult })
}
