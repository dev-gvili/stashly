import { redirect } from 'react-router'
import { auth } from '@/services/auth'
import { getRememberedAccount } from '@/services/remembered-account'
import type { Route } from './+types/sign-in'
import { authClient } from '@/.client/auth'
import { SignInPage, ThemeModeSwitcher } from '@/components/views/sign-in'
import { toUserInitial } from '@/utils/converters'

export const meta: Route.MetaFunction = (props) => [
  { title: 'Stashly | sign-in' },
]

export async function loader({ request, context }: Route.LoaderArgs) {
  const session = await auth.api.getSession({
    query: {
      disableCookieCache: true,
    },
    headers: request.headers,
  })

  if (session) {
    return redirect(`/${session.user.id}/stash`)
  }
  return { account: await getRememberedAccount(request) }
}

export default function SignIn({ loaderData }: Route.ComponentProps) {
  const { account } = loaderData
  return (
    <>
      <SignInPage
        user={
          account
            ? {
                name: account.name,
                email: account.email,
                initials: toUserInitial(account.name),
                avatarSrc: account.image ?? undefined,
              }
            : undefined
        }
        termsHref="#"
        privacyHref="#"
        onQuickSignIn={
          account
            ? async () => {
                await authClient.signIn.social({
                  provider: account.provider,
                  loginHint: account.email,
                })
              }
            : undefined
        }
        onProviderSignIn={async (provider) => {
          await authClient.signIn.social({ provider })
        }}
      />
      <ThemeModeSwitcher className="fixed right-4 bottom-4 z-10" />
    </>
  )
}
