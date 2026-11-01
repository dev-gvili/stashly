import { createCookie, data } from 'react-router'
import z from 'zod'
import { parseFormData } from '../../utils/parsers'
import { rethrowAsResponse } from '@/utils/api.errors'

let schema = z.object({
  id: z.string().nonempty(),
  state: z.coerce.boolean(),
})

export const action = async ({ request }: { request: Request }) => {
  const { id, state } = await parseFormData({ request, schema }).catch(rethrowAsResponse)
  const cookieName = `stashly-sidebar-${id}`
  const cookie = createCookie(cookieName, {
    maxAge: 31_536_000,
    path: '/',
    sameSite: 'lax',
    secure: false,
  })

  const serialized = await cookie.serialize(state)

  return data(
    { [cookieName]: state },
    {
      status: 200,
      headers: { 'Set-Cookie': serialized },
    }
  )
}
