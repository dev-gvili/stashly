import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { ChevronRightIcon } from '@/components/icons'
import { cn } from '@/utils/styles'

export interface QuickSignInButtonProps
  extends Omit<React.ComponentProps<typeof Button>, 'children'> {
  name: string
  email: string
  initials: string
  avatarSrc?: string
  pending?: boolean
}

/** "Continue as …" — the remembered account, one click back in. */
export function QuickSignInButton({
  name,
  email,
  initials,
  avatarSrc,
  pending = false,
  className,
  ...props
}: QuickSignInButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      aria-busy={pending}
      className={cn(
        'h-auto w-full justify-start gap-3 rounded-xl border-sidebar-border! bg-card! px-3.5 py-3 text-left shadow-none hover:border-border! hover:bg-card!',
        className
      )}
      {...props}
    >
      <Avatar className="size-8.5">
        {avatarSrc ? <AvatarImage src={avatarSrc} alt="" /> : null}
        <AvatarFallback className="bg-primary/15 font-sans text-xs font-semibold text-primary">
          {initials}
        </AvatarFallback>
      </Avatar>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-sans text-sm font-medium text-foreground">
          {pending ? 'Signing in…' : 'Continue as ' + name}
        </span>
        <span className="truncate font-mono text-xs font-normal text-muted-foreground">{email}</span>
      </span>
      <ChevronRightIcon className="size-4 text-muted-foreground" />
    </Button>
  )
}
