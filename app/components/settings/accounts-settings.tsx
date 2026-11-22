import { authClient } from '@/.client/auth'
import { GithubFillIcon, GoogleFillIcon, LoaderIcon, MicrosoftFillIcon } from '@/components/icons'
import useConfirm from '@/hooks/useConfirm'
import { cn } from '@/utils/styles'
import { Button } from '@/ui/button'
import { Card } from '@/ui/card'
import { Tooltip } from '@/ui/tooltip'
import { useEffect, useState, type ComponentType, type SVGProps } from 'react'
import { useFetcher, useLocation, useSearchParams } from 'react-router'
import { SETTINGS_CARD } from './settings-layout'

type ProviderId = 'github' | 'google' | 'microsoft'

const PROVIDERS: Record<ProviderId, { name: string; icon: ComponentType<SVGProps<SVGSVGElement>> }> = {
  github: { name: 'GitHub', icon: GithubFillIcon },
  google: { name: 'Google', icon: GoogleFillIcon },
  microsoft: { name: 'Microsoft', icon: MicrosoftFillIcon },
}

interface LinkedAccount {
  providerId: ProviderId
  connected: boolean
  /** "@login" for GitHub, the email for Google and Microsoft, when known. */
  handle: string | null
}

/**
 * Connected accounts: one row per sign-in provider. Connect runs better-auth's
 * OAuth link flow and comes back here; Disconnect asks first and is disabled
 * on the only linked provider (the action refuses it too). A failed link or
 * unlink is reported in a line under the card, read once from the URL after
 * the round trip and then removed from it.
 */
export function AccountsSettings({ accounts }: { accounts: LinkedAccount[] }) {
  const connectedCount = accounts.filter((a) => a.connected).length
  const [searchParams, setSearchParams] = useSearchParams()
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    const failed = searchParams.get('link_error')
    if (!failed && !searchParams.has('linked')) return
    const name = PROVIDERS[failed as ProviderId]?.name
    setMessage(
      failed
        ? `Couldn't connect ${name ?? 'that provider'}. It may be linked to another Stashly account or use a different email.`
        : null
    )
    const next = new URLSearchParams(searchParams)
    next.delete('linked')
    next.delete('link_error')
    next.delete('error')
    setSearchParams(next, { replace: true, preventScrollReset: true })
  }, [searchParams, setSearchParams])

  return (
    <div className="flex flex-col gap-3">
      <Card className={cn(SETTINGS_CARD, 'gap-0 overflow-hidden p-0')}>
        {accounts.map((account) => (
          <AccountRow
            key={account.providerId}
            account={account}
            onlyOne={account.connected && connectedCount <= 1}
            onError={setMessage}
          />
        ))}
      </Card>
      {message && (
        <p role="status" className="text-xs text-muted-foreground">
          {message}
        </p>
      )}
    </div>
  )
}

function AccountRow({
  account,
  onlyOne,
  onError,
}: {
  account: LinkedAccount
  onlyOne: boolean
  onError: (message: string | null) => void
}) {
  const { name, icon: Icon } = PROVIDERS[account.providerId]
  const fetcher = useFetcher<{ ok: true } | { error: string }>()
  const { open } = useConfirm()
  const { pathname } = useLocation()
  const [linking, setLinking] = useState(false)
  const unlinking = fetcher.state !== 'idle'

  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data && 'error' in fetcher.data) onError(fetcher.data.error)
  }, [fetcher.state, fetcher.data, onError])

  const connect = async () => {
    setLinking(true)
    onError(null)
    const back = `${window.location.origin}${pathname}`
    const { error } = await authClient.linkSocial({
      provider: account.providerId,
      callbackURL: `${back}?linked=${account.providerId}`,
      errorCallbackURL: `${back}?link_error=${account.providerId}`,
    })
    // On success the browser is already leaving for the provider.
    if (error) {
      setLinking(false)
      onError(`Couldn't connect ${name}.`)
    }
  }

  const disconnect = () =>
    open({
      title: `Disconnect ${name}?`,
      description: `You won't be able to sign in with ${name} until you connect it again.`,
      confirmText: 'Disconnect',
      variant: 'destructive',
      onConfirm: () => {
        onError(null)
        fetcher.submit({ intent: 'unlink_account', providerId: account.providerId }, { method: 'post' })
      },
    })

  const status = account.connected
    ? account.handle
      ? `Connected as ${account.handle}`
      : 'Connected'
    : 'Not connected'

  return (
    <div className="flex items-center gap-4 border-b border-input px-5 py-4 last:border-b-0">
      <div className="grid size-8.5 shrink-0 place-items-center rounded-md bg-secondary text-secondary-foreground">
        <Icon aria-hidden className="size-5" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm text-foreground">{name}</span>
        <span className="truncate text-xs text-muted-foreground">{status}</span>
      </div>
      {!account.connected ? (
        <Button variant="outline" size="sm" disabled={linking} onClick={connect}>
          {linking && <LoaderIcon aria-hidden className="size-4 animate-spin" />}
          Connect
        </Button>
      ) : onlyOne ? (
        // A disabled button gets no pointer events: the wrapper carries the tooltip.
        <Tooltip content="Connect another provider first — this is your only way to sign in." asChild>
          <span tabIndex={0} className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            <Button variant="outline" size="sm" disabled>
              Disconnect
            </Button>
          </span>
        </Tooltip>
      ) : (
        <Button variant="outline" size="sm" disabled={unlinking} onClick={disconnect}>
          {unlinking && <LoaderIcon aria-hidden className="size-4 animate-spin" />}
          Disconnect
        </Button>
      )}
    </div>
  )
}
