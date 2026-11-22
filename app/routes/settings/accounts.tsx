import { AccountsSettings } from '@/components/settings/accounts-settings'
import { SettingsSectionError } from '@/components/settings/settings-layout'
import { settingsHandle, settingsMeta } from '@/components/settings/settings-sections'
import { settingsAccountsInput } from '@/schemas/api.schemas'
import { sessionContext } from '@/services/middleware/context'
import { listLinkedAccounts, unlinkAccount } from '@/services/settings-actions'
import { rethrowAsResponse, toErrorInfo } from '@/utils/api.errors'
import { parseFormData } from '@/utils/parsers'
import { data } from 'react-router'
import type { Route } from './+types/accounts'

export const handle = settingsHandle('accounts')
export const meta = () => settingsMeta('accounts')

export async function loader({ context }: Route.LoaderArgs) {
  const session = context.get(sessionContext)
  return { accounts: await listLinkedAccounts(session.user.id) }
}

/**
 * Unlink only. Linking is better-auth's OAuth round trip, started in the
 * browser (`authClient.linkSocial`) so its state cookie is set on the
 * redirect; it returns here with `?linked=` or `?link_error=`.
 */
export async function action({ request, context }: Route.ActionArgs) {
  const session = context.get(sessionContext)
  const input = await parseFormData({ request, schema: settingsAccountsInput }).catch(
    rethrowAsResponse
  )
  try {
    await unlinkAccount({ userId: session.user.id, providerId: input.providerId })
    return { ok: true as const, providerId: input.providerId }
  } catch (e) {
    const err = toErrorInfo(e)
    return data(
      { error: err.message ?? "Couldn't disconnect", providerId: input.providerId },
      { status: err.status ?? 500 }
    )
  }
}

export default function AccountsRoute({ loaderData }: Route.ComponentProps) {
  return <AccountsSettings accounts={loaderData.accounts} />
}

export function ErrorBoundary() {
  return <SettingsSectionError sectionId="accounts" />
}
