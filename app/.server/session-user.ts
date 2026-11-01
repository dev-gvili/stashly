import { prisma } from '@/services/db'
import { log } from '@/services/log'

/** The `User.bucket` column default: no bucket of the user's own yet. */
const PLACEHOLDER_BUCKET = 'default-bucket'

type OnboardingFields = {
  bucket?: string | null
  rootId?: string | null
  driveId?: string | null
}

/** Whether a session's user is missing what onboarding writes. */
export function needsOnboardingFields(user: OnboardingFields): boolean {
  return (
    !user.rootId ||
    !user.driveId ||
    !user.bucket ||
    user.bucket === PLACEHOLDER_BUCKET
  )
}

type ReadOnboardingFields = (
  userId: string
) => Promise<Required<OnboardingFields> | null>

const readOnboardingFields: ReadOnboardingFields = (userId) =>
  prisma.user.findUnique({
    where: { id: userId },
    select: { bucket: true, rootId: true, driveId: true },
  })

/**
 * Copy the `set-cookie` headers a server-side `getSession` produced onto the
 * response that goes back to the browser.
 *
 * `auth.api.getSession` refreshes the 5-minute session cache cookie when it
 * has expired, but only into its own returned headers. Nothing in the browser
 * calls `get-session`, so unless the middleware forwards it the cache is
 * written once at sign-in and every request reads the database again five
 * minutes later. A response whose headers are immutable (some redirects) is
 * returned as it is; the next request refreshes the cookie instead.
 */
export function forwardSetCookies(response: Response, from: Headers): Response {
  const cookies = from.getSetCookie()
  if (cookies.length === 0) return response
  try {
    for (const cookie of cookies) response.headers.append('set-cookie', cookie)
  } catch {
    // Immutable headers: nothing to forward to.
  }
  return response
}

/**
 * Fill a session user's `bucket`, `rootId` and `driveId` from the database when
 * the session doesn't carry them.
 *
 * With the session cookie cache on, better-auth caches a new user's session
 * from the row it just created, before `onboardNewUser` has written those
 * three fields to the database. Without this, uploads in a new account's first
 * five minutes would see no bucket. Every other session already carries them,
 * so this reads nothing.
 *
 * @example
 * const user = await withOnboardingFields(session.user)
 */
export async function withOnboardingFields<
  U extends OnboardingFields & { id: string },
>(
  user: U,
  read: ReadOnboardingFields = readOnboardingFields,
  onboard: Onboard = runOnboarding
): Promise<U> {
  if (!needsOnboardingFields(user)) return user
  const stored = await read(user.id)
  if (!stored) return user
  if (!needsOnboardingFields(stored)) return { ...user, ...stored }

  // Onboarding runs once, in better-auth's create hook, and a run that failed
  // left the row without a bucket, root or drive for good (tech-debt item 22).
  // Run it again; every step reuses what the failed run made. After a failure,
  // wait `ONBOARDING_RETRY_MS` before the next try rather than one per request.
  const failedAt = onboardingFailedAt.get(user.id)
  if (failedAt && Date.now() - failedAt < ONBOARDING_RETRY_MS) return { ...user, ...stored }
  try {
    await onboard(user)
    onboardingFailedAt.delete(user.id)
  } catch (error) {
    onboardingFailedAt.set(user.id, Date.now())
    log.error('onboarding re-run failed', { user_id: user.id, error })
    return { ...user, ...stored }
  }
  const repaired = await read(user.id)
  return { ...user, ...(repaired ?? stored) }
}

type Onboard = (user: { id: string }) => Promise<void>

/** How long a failed onboarding re-run waits before the next one. */
const ONBOARDING_RETRY_MS = 60_000
const onboardingFailedAt = new Map<string, number>()

// Imported when needed: onboard.ts reaches the machine, item-actions and s3,
// which a session read for an onboarded user never needs.
const runOnboarding: Onboard = async (user) => {
  const { onboardNewUser } = await import('./onboard')
  await onboardNewUser(user as Parameters<typeof onboardNewUser>[0])
}
