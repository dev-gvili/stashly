import { Separator } from '@/components/ui/separator'
import { type OAuthProvider, useSignIn } from '@/hooks/useSignIn'
import { cn } from '@/utils/styles'
import { BrandLogo } from './brand-logo'
import { MagicLinkForm } from './magic-link-form'
import { OAuthProviderButtons } from './oauth-provider-buttons'
import { QuickSignInButton } from './quick-sign-in-button'
import { SignInShowcase } from './signin-showcase'

export interface RememberedUser {
  name: string
  email: string
  initials: string
  avatarSrc?: string
}

export interface SignInPageProps extends React.ComponentProps<'main'> {
  logoSrc?: string
  user?: RememberedUser
  termsHref?: string
  privacyHref?: string
  onQuickSignIn?: () => void | Promise<void>
  onProviderSignIn?: (provider: OAuthProvider) => void | Promise<void>
  /** The email form renders only when a handler is wired. */
  onMagicLink?: (email: string) => void | Promise<void>
}

export function SignInPage({
  logoSrc,
  user,
  termsHref = '/terms',
  privacyHref = '/privacy',
  onQuickSignIn,
  onProviderSignIn,
  onMagicLink,
  className,
  ...props
}: SignInPageProps) {
  const signIn = useSignIn({ onQuickSignIn, onProviderSignIn, onMagicLink })
  const providerPending =
    signIn.pending && signIn.pending !== 'quick' && signIn.pending !== 'email' ? signIn.pending : null

  return (
    <main
      className={cn('flex min-h-screen flex-wrap gap-3 bg-background p-3 text-foreground', className)}
      {...props}
    >
      <div className="flex grow basis-110 flex-col px-8 py-6">
        <BrandLogo src={logoSrc} />
        <div className="flex flex-1 items-center justify-center py-12">
          <div className="flex w-full max-w-90 flex-col gap-6">
            <header className="flex flex-col gap-2">
              <h1 className="font-sans text-3xl font-semibold tracking-tight">Welcome back</h1>
              <p className="font-sans text-base leading-normal text-muted-foreground">Sign in to your stash.</p>
            </header>

            {user ? (
              <>
                <QuickSignInButton
                  name={user.name}
                  email={user.email}
                  initials={user.initials}
                  avatarSrc={user.avatarSrc}
                  pending={signIn.pending === 'quick'}
                  onClick={signIn.quickSignIn}
                />
                <div className="flex items-center gap-3">
                  <Separator className="flex-1 bg-sidebar-border" />
                  <span className="font-sans text-xs text-muted-foreground/70">or</span>
                  <Separator className="flex-1 bg-sidebar-border" />
                </div>
              </>
            ) : null}

            <OAuthProviderButtons pending={providerPending} onSelect={signIn.providerSignIn} />

            {onMagicLink ? (
              <MagicLinkForm
                email={signIn.email}
                error={signIn.emailError}
                sentTo={signIn.sentTo}
                pending={signIn.pending === 'email'}
                onEmailChange={signIn.changeEmail}
                onSubmit={signIn.submitEmail}
              />
            ) : null}
          </div>
        </div>
        <p className="font-sans text-xs text-muted-foreground/70">
          By continuing you agree to the{' '}
          <a href={termsHref} className="font-sans text-primary hover:underline">Terms</a> and{' '}
          <a href={privacyHref} className="font-sans text-primary hover:underline">Privacy Policy</a>.
        </p>
      </div>

      <SignInShowcase />
    </main>
  )
}
