// userOnboarding.server.ts
import { createActor } from 'xstate'
import type { User } from 'better-auth'
import { onboardingMachine } from '@/machines/onboard/onboard.machine'

export async function onboardNewUser(user: User) {
  const onboardingActor = createActor(onboardingMachine, {
    input: { user },
  })

  return new Promise<void>((resolve, reject) => {
    onboardingActor.subscribe({
      next: (state) => {
      },
      complete: () => {
        const snapshot = onboardingActor.getSnapshot()
        if (snapshot.value === 'failure') {
          const error =
            snapshot.context.error instanceof Error
              ? snapshot.context.error
              : new Error('Onboarding process failed')
          reject(error)
        } else {
          resolve()
        }
      },
      error: (err) => {
        console.error('Onboarding actor errored unexpectedly:', err)
        reject(err)
      },
    })

    onboardingActor.start()
  })
}
