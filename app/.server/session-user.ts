import { prisma } from '@/services/db'

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
>(user: U, read: ReadOnboardingFields = readOnboardingFields): Promise<U> {
  if (!needsOnboardingFields(user)) return user
  const stored = await read(user.id)
  return stored ? { ...user, ...stored } : user
}
