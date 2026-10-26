import { createCookie } from 'react-router'
import { createTypedCookie } from 'remix-utils/typed-cookie'
import { z } from 'zod'
import { cookieSecret } from './env'

/**
 * The account last signed in on this browser, shown on the sign-in page as
 * "Continue as …". Display-only: the quick sign-in still runs the full OAuth
 * flow for `provider`, so the cookie grants nothing on its own. It outlives
 * sign-out on purpose — that is when the sign-in page needs it.
 */
const cookie = createCookie('last-account', {
  path: '/',
  sameSite: 'lax',
  httpOnly: true,
  maxAge: 60 * 60 * 24 * 90,
  secrets: [cookieSecret()],
})

export const rememberedAccountSchema = z.object({
  name: z.string().min(1),
  email: z.string().min(1),
  image: z.string().nullable(),
  provider: z.enum(['github', 'google', 'microsoft']),
})

export type RememberedAccount = z.infer<typeof rememberedAccountSchema>

const typedCookie = createTypedCookie({
  cookie,
  schema: rememberedAccountSchema.nullable().catch(null),
})

export async function getRememberedAccount(
  request: Request
): Promise<RememberedAccount | null> {
  return (await typedCookie.parse(request.headers.get('Cookie'))) ?? null
}

/** `Set-Cookie` value for `account`, or `null` when it doesn't describe a supported OAuth sign-in. */
export async function rememberAccount(account: unknown) {
  const parsed = rememberedAccountSchema.safeParse(account)
  return parsed.success ? await typedCookie.serialize(parsed.data) : null
}
