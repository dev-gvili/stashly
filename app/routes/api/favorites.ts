import type { Route } from './+types/favorites'
import { auth } from '@/services/auth'
import { data, redirect } from 'react-router'
import { parseFormData } from '@/utils/parsers'
import { toZodArraySchema } from '@/utils/converters'
import { removeQueryParam } from '@/utils/query-params'
import z from 'zod'
import { addFavorite, addFavorites, removeFavorite } from '@/services/item-actions'

const ApiFavoriteSchema = z.discriminatedUnion('intent', [
  z.object({ intent: z.literal('favorite'), itemId: z.string() }),
  z.object({ intent: z.literal('unfavorite'), itemId: z.string() }),
  z.object({
    intent: z.literal('favorite_items'),
    selectedItems: toZodArraySchema(z.string()),
  }),
])

export const action = async ({ request }: Route.ActionArgs) => {
    const session = await auth.api.getSession({
    headers: request.headers,
  })
  if (!session) throw redirect('/auth/sign-in')

  const parsedData = await parseFormData({ request, schema: ApiFavoriteSchema })

  try {
    switch (parsedData.intent) {
      case 'favorite': {
        await addFavorite(parsedData.itemId, session.user.id)
        return data({ favorited: true })
      }
      case 'unfavorite': {
        await removeFavorite(parsedData.itemId, session.user.id)
        return data({ favorited: false })
      }
      case 'favorite_items': {
        await addFavorites(parsedData.selectedItems, session.user.id)
        // Clear the multi-select query param so the toolbar selection resets,
        // mirroring the bulk actions on /api/items.
        const referer = request.headers.get('referer')
        const url = new URL(referer || request.url)
        const searchParams = removeQueryParam(url.searchParams, 'selectedItems')
        return redirect(`${url.pathname}?${searchParams.toString()}`)
      }
    }
  } catch (e) {
    const err = e as { statusCode?: number; message?: string }
    return data(
      { error: err.message ?? 'Favorite action failed' },
      { status: err.statusCode ?? 500 }
    )
  }
}
