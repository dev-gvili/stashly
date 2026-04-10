import type { Route } from './+types/favorites'
import { auth } from '@/services/auth'
import { redirect } from 'react-router'
import { parseSearchParams } from '@/utils/parsers'
import z from 'zod'
import { addFavorite, removeFavorite } from '@/services/item-actions'

const ApiFavoriteSchema = z.object({
  itemId: z.string(),
  intent: z.enum(['favorite', 'unfavorite']),
})

// export const action = async ({ request }: Route.ActionArgs) => {
//   const session = await auth.api.getSession(request)
//   if (!session) throw redirect('/auth/sign-in')
//   let referer = request.headers.get('referer')
//   let url = new URL(referer || request.url)
//   const data = await parseFormData({ request, schema: ApiFavoriteSchema })
//   const favorited = await itemRepository.findFavoriteItem(
//     data.itemId,
//     session.user.id
//   )

//   try {
//     await itemRepository.unfavorite(data.itemId, session.user.id)
//     return redirect(`${url.pathname}${url.search}`)
//   } catch (e) {
//     console.error(e)
//     return { favorited: true }
//   }
// }

export const loader = async ({ request }: Route.LoaderArgs) => {
  const session = await auth.api.getSession(request)
  if (!session) throw redirect('/auth/sign-in')

  const data = parseSearchParams({ request, schema: ApiFavoriteSchema })
  try {
    switch (data.intent) {
      case 'favorite':
        await addFavorite(data.itemId, session.user.id)
        return { favorited: true }
      case 'unfavorite':
        await removeFavorite(data.itemId, session.user.id)
        return { favorited: false }
      default:
        return { favorited: false }
    }
  } catch (e) {
    console.error(e)
    return { favorited: data.intent === 'favorite' }
  }
}
