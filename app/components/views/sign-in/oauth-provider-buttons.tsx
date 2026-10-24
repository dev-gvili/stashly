import { Button } from '@/components/ui/button'
import { GithubFillIcon, GoogleFillIcon, MicrosoftFillIcon } from '@/components/icons'
import type { OAuthProvider } from '@/hooks/useSignIn'
import { cn } from '@/utils/styles'

const PROVIDERS: { id: OAuthProvider; label: string; Icon: typeof GithubFillIcon }[] = [
  { id: 'github', label: 'GitHub', Icon: GithubFillIcon },
  { id: 'google', label: 'Google', Icon: GoogleFillIcon },
  { id: 'microsoft', label: 'Microsoft', Icon: MicrosoftFillIcon },
]

export interface OAuthProviderButtonsProps extends Omit<React.ComponentProps<'div'>, 'onSelect'> {
  pending?: string | null
  onSelect: (provider: OAuthProvider) => void
}

export function OAuthProviderButtons({
  pending = null,
  onSelect,
  className,
  ...props
}: OAuthProviderButtonsProps) {
  return (
    <div className={cn('grid grid-cols-3 gap-2', className)} {...props}>
      {PROVIDERS.map(({ id, label, Icon }) => {
        const isPending = pending === id
        const dimmed = pending !== null && !isPending
        return (
          <Button
            key={id}
            type="button"
            variant="outline"
            title={'Continue with ' + label}
            aria-busy={isPending}
            data-dimmed={dimmed}
            onClick={() => onSelect(id)}
            className="h-10.5 gap-2 rounded-lg border-sidebar-border! bg-transparent! px-2 font-sans text-sm shadow-none hover:bg-secondary! data-[dimmed=true]:opacity-40"
          >
            <Icon className="size-4" />
            <span className="font-sans">{isPending ? '…' : label}</span>
            {isPending ? <span className="sr-only">{'Connecting to ' + label}</span> : null}
          </Button>
        )
      })}
    </div>
  )
}
