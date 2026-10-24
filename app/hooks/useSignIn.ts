import { useCallback, useState } from 'react'
import type { auth } from '@/services/auth'

export type OAuthProvider = keyof typeof auth.options.socialProviders
type PendingKey = OAuthProvider | 'quick' | 'email' | null

export interface UseSignInOptions {
  onQuickSignIn?: () => void | Promise<void>
  onProviderSignIn?: (provider: OAuthProvider) => void | Promise<void>
  onMagicLink?: (email: string) => void | Promise<void>
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** One in-flight sign-in at a time; every other entry point dims while it runs. */
export function useSignIn({
  onQuickSignIn,
  onProviderSignIn,
  onMagicLink,
}: UseSignInOptions = {}) {
  const [pending, setPending] = useState<PendingKey>(null)
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)

  const run = useCallback(
    (key: Exclude<PendingKey, null>, task?: () => void | Promise<void>) => {
      if (pending) return
      setPending(key)
      Promise.resolve(task?.()).finally(() => setPending(null))
    },
    [pending]
  )

  const quickSignIn = useCallback(() => run('quick', onQuickSignIn), [run, onQuickSignIn])

  const providerSignIn = useCallback(
    (provider: OAuthProvider) => run(provider, () => onProviderSignIn?.(provider)),
    [run, onProviderSignIn]
  )

  const changeEmail = useCallback((value: string) => {
    setEmail(value)
    setEmailError(null)
    setSentTo(null)
  }, [])

  const submitEmail = useCallback(
    (event?: React.FormEvent) => {
      event?.preventDefault()
      const value = email.trim()
      if (!EMAIL_PATTERN.test(value)) {
        setEmailError('Enter a valid email address')
        return
      }
      run('email', async () => {
        await onMagicLink?.(value)
        setSentTo(value)
      })
    },
    [email, run, onMagicLink]
  )

  return {
    pending,
    isBusy: pending !== null,
    quickSignIn,
    providerSignIn,
    email,
    emailError,
    sentTo,
    changeEmail,
    submitEmail,
  }
}
