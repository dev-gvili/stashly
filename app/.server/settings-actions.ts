import { prisma } from '@/services/db'
import { track } from '@/services/vinktar'
import { StashlyErrorCode, toRouteError } from '@/utils/api.errors'
import type { Prisma } from '@/prisma/client'

/**
 * Returns the settings/preferences fields for a user.
 * Selects only the subset of User fields that represent preferences.
 */
export async function getUserSettings(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      displayName: true,
      email: true,
      image: true,
      emailVerified: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  if (!user) {
    throw toRouteError(StashlyErrorCode.USER_NOT_FOUND, `User not found: ${userId}`)
  }

  return user
}

/**
 * Updates the settings/preferences fields for a user.
 * Only allows updating name, displayName, and image.
 */
export async function updateUserSettings({
  userId,
  name,
  displayName,
  image,
}: {
  userId: string
  name?: string
  displayName?: string
  image?: string
}) {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) {
    throw toRouteError(StashlyErrorCode.USER_NOT_FOUND, `User not found: ${userId}`)
  }

  const data: Prisma.UserUpdateInput = {}
  if (name !== undefined) data.name = name
  if (displayName !== undefined) data.displayName = displayName
  if (image !== undefined) data.image = image

  const updated = await prisma.user.update({
    where: { id: userId },
    data,
    select: {
      id: true,
      name: true,
      displayName: true,
      email: true,
      image: true,
      emailVerified: true,
      createdAt: true,
      updatedAt: true,
    },
  })
  // Which fields changed, never their values.
  track(
    'settings_updated',
    {
      changed_keys: Object.keys(data).sort().join(','),
      changed_count: Object.keys(data).length,
    },
    { userId }
  )
  return updated
}

/** `User.name` is `VarChar(50)`. */
export const PROFILE_NAME_MAX = 50

/**
 * Trims a submitted full name and checks it fits `User.name`. Returns the
 * value to store, or the message the Profile form shows under the field.
 */
export function validateProfileName(
  raw: string
): { ok: true; name: string } | { ok: false; error: string } {
  const name = raw.trim()
  if (!name) return { ok: false, error: 'Enter your name.' }
  if (name.length > PROFILE_NAME_MAX)
    return { ok: false, error: `Use ${PROFILE_NAME_MAX} characters or fewer.` }
  return { ok: true, name }
}

// ---------------------------------------------------------------------------
// Connected accounts
// ---------------------------------------------------------------------------

export const LINK_PROVIDERS = ['github', 'google', 'microsoft'] as const
export type LinkProvider = (typeof LINK_PROVIDERS)[number]

/**
 * The email in an OIDC id token's payload, or null. Google and Microsoft sign
 * in with one; GitHub has no id token, so its accounts show no address. The
 * token was stored by better-auth from the provider, so only its claims are
 * read here, not its signature.
 */
export function emailFromIdToken(idToken: string | null | undefined): string | null {
  const payload = idToken?.split('.')[1]
  if (!payload) return null
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    return typeof claims?.email === 'string' && claims.email ? claims.email : null
  } catch {
    return null
  }
}

/**
 * The GitHub username for a stored access token, from GitHub's `/user`, or
 * null when GitHub doesn't answer in 2 s or refuses the token. GitHub signs in
 * without an id token, so this is the only way to name the account.
 */
async function githubLogin(accessToken: string | null): Promise<string | null> {
  if (!accessToken) return null
  try {
    const res = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'stashly',
      },
      signal: AbortSignal.timeout(2000),
    })
    if (!res.ok) return null
    const body = (await res.json()) as { login?: unknown }
    return typeof body.login === 'string' && body.login ? body.login : null
  } catch {
    return null
  }
}

/**
 * One row per provider: linked or not, and who it is linked as when that is
 * known: the email in a Google or Microsoft id token, the GitHub username.
 */
export async function listLinkedAccounts(userId: string) {
  const accounts = await prisma.account.findMany({
    where: { userId, providerId: { in: [...LINK_PROVIDERS] } },
    select: { providerId: true, idToken: true, accessToken: true },
  })
  return Promise.all(
    LINK_PROVIDERS.map(async (providerId) => {
      const account = accounts.find((a) => a.providerId === providerId)
      if (!account) return { providerId, connected: false, handle: null }
      const login = providerId === 'github' ? await githubLogin(account.accessToken) : null
      return {
        providerId,
        connected: true,
        handle: login ? `@${login}` : emailFromIdToken(account.idToken),
      }
    })
  )
}

/**
 * Unlinks a sign-in provider. Refused when it is the user's only account,
 * since they could then never sign in again; the Settings UI disables the
 * button too, but this is the check that holds.
 */
export async function unlinkAccount({
  userId,
  providerId,
}: {
  userId: string
  providerId: LinkProvider
}) {
  const removed = await prisma.$transaction(async (tx) => {
    // Two unlinks at once would each count two accounts and leave none:
    // the user row lock makes the count and the delete one step per user.
    await tx.$queryRaw`SELECT id FROM "user" WHERE id = ${userId} FOR UPDATE`
    const accounts = await tx.account.findMany({
      where: { userId },
      select: { id: true, providerId: true },
    })
    const target = accounts.find((a) => a.providerId === providerId)
    if (!target) return false
    if (accounts.length <= 1)
      throw toRouteError(
        StashlyErrorCode.CONFLICT,
        'Connect another provider first — this is your only way to sign in.'
      )
    await tx.account.delete({ where: { id: target.id } })
    return true
  })
  if (removed) track('account_unlinked', { provider: providerId }, { userId })
  return removed
}

// ---------------------------------------------------------------------------
// Notification and AI preferences (UserPreference, one row per user)
// ---------------------------------------------------------------------------

export const NOTIFICATION_PREF_COLUMNS = {
  comments: 'notifyComments',
  shares: 'notifyShares',
  ai: 'notifyAi',
  weekly: 'notifyWeekly',
} as const

export const AI_PREF_COLUMNS = {
  transcribe: 'aiTranscribe',
  transcribeVideo: 'aiTranscribeVideo',
  caption: 'aiCaption',
  index: 'aiIndex',
} as const

export type NotificationPrefKey = keyof typeof NOTIFICATION_PREF_COLUMNS
export type AiPrefKey = keyof typeof AI_PREF_COLUMNS
type PrefColumn =
  | (typeof NOTIFICATION_PREF_COLUMNS)[NotificationPrefKey]
  | (typeof AI_PREF_COLUMNS)[AiPrefKey]

/** The schema defaults; a user with no `UserPreference` row has exactly these. */
export const PREFERENCE_DEFAULTS: Record<PrefColumn, boolean> = {
  notifyComments: true,
  notifyShares: true,
  notifyAi: false,
  notifyWeekly: true,
  aiTranscribe: true,
  aiTranscribeVideo: true,
  aiCaption: true,
  aiIndex: true,
}

async function readPreferenceRow(userId: string) {
  const row = await prisma.userPreference.findUnique({ where: { userId } })
  return { ...PREFERENCE_DEFAULTS, ...(row ?? {}) }
}

export async function getNotificationPreferences(userId: string) {
  const row = await readPreferenceRow(userId)
  return Object.fromEntries(
    Object.entries(NOTIFICATION_PREF_COLUMNS).map(([key, column]) => [key, row[column]])
  ) as Record<NotificationPrefKey, boolean>
}

export async function getAiPreferences(userId: string) {
  const row = await readPreferenceRow(userId)
  return Object.fromEntries(
    Object.entries(AI_PREF_COLUMNS).map(([key, column]) => [key, row[column]])
  ) as Record<AiPrefKey, boolean>
}

async function writePreference(userId: string, column: PrefColumn, value: boolean) {
  await prisma.userPreference.upsert({
    where: { userId },
    create: { userId, [column]: value },
    update: { [column]: value },
  })
}

export async function setNotificationPreference({
  userId,
  key,
  value,
}: {
  userId: string
  key: NotificationPrefKey
  value: boolean
}) {
  await writePreference(userId, NOTIFICATION_PREF_COLUMNS[key], value)
  track('preference_updated', { group: 'notifications', key, enabled: value }, { userId })
}

export async function setAiPreference({
  userId,
  key,
  value,
}: {
  userId: string
  key: AiPrefKey
  value: boolean
}) {
  await writePreference(userId, AI_PREF_COLUMNS[key], value)
  track('preference_updated', { group: 'ai', key, enabled: value }, { userId })
}
