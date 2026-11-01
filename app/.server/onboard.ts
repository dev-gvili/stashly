// userOnboarding.server.ts
import { createActor } from 'xstate'
import { log } from '@/services/log'
import type { User } from 'better-auth'
import { onboardingMachine } from '@/machines/onboard/onboard.machine'

/** Runs in progress, by user id: a second caller joins the first. */
const running = new Map<string, Promise<void>>()

/**
 * Runs the onboarding machine for a user. Called by better-auth's create hook
 * and again by `withOnboardingFields` for an account a failed run left
 * incomplete; each step reuses what an earlier run made. Two calls for one user
 * in this process share a run (one Node process serves the app).
 */
export function onboardNewUser(user: User): Promise<void> {
  const inFlight = running.get(user.id)
  if (inFlight) return inFlight
  const run = runOnboarding(user).finally(() => running.delete(user.id))
  running.set(user.id, run)
  return run
}

async function runOnboarding(user: User) {
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
        log.error('onboarding actor failed', { user_id: user.id, error: err })
        reject(err)
      },
    })

    onboardingActor.start()
  })
}
