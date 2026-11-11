import { Button } from '@/ui/button'
import { cn } from '@/utils/styles'
import {authClient} from '@/.client/auth'
import {
  CircleIcon,
  GithubFillIcon,
  GoogleFillIcon,
  MicrosoftFillIcon,
} from '@/components/icons'
import type { auth } from '@/services/auth'

type Providers = keyof typeof auth.options.socialProviders
interface AuthButtonProps extends React.ComponentProps<typeof Button> {
  provider: Providers
}

const toProviderIcon = (provider: Providers) => {
  switch (provider) {
    case 'github':
      return <GithubFillIcon className="size-6" />
    case 'google':
      return <GoogleFillIcon className="size-6" />
    case 'microsoft':
      return <MicrosoftFillIcon className="size-6" />
    default:
      return <CircleIcon className="size-6" />
  }
}
const AuthButton = ({
  provider,
  className,
  children,
  variant = 'outline',
  ...props
}: AuthButtonProps) => {
  return (
    <Button
      variant={variant}
      size="icon"
      aria-label={`Sign in with ${provider}`}
      className={cn('border-dashed border-border', className)}
      {...props}
      onClick={() => {
        authClient.signIn.social({
          provider,
        })
      }}
    >
      {toProviderIcon(provider)}
      {children}
    </Button>
  )
}

export { AuthButton }
